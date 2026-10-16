import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCw, X } from 'lucide-react';
import { Button, IconButton, cx } from '../../components/ui';
import { MARTINI } from '../../data/drinks';
import { dispatch, savePhotos, useUi } from '../../store';
import { logDrink } from '../../store/world';
import c from './camera.module.css';

/*
 * BeReal-style dual capture (DESIGN §5.4).
 * Mode A "flip": rear photo -> stop rear -> open front -> selfie straight away. Every iPhone, most Android.
 * Mode B "dual": both streams live at once, one shutter. Only where the device allows it; probed once
 *                and cached in localStorage.
 * "stock": bundled photos when permission is denied or there is no camera.
 * Streams are stopped on capture, cancel, tab switch and unmount.
 */

type Mode = 'flip' | 'dual' | 'stock';
type Phase = 'init' | 'rear' | 'flip' | 'front' | 'dual' | 'paused' | 'scanning' | 'result';
interface Shot {
  full: string;
  recap: string;
  thumb: string;
}

const PROBE_KEY = 'safesip.dualcam.v1';
const STOCK_DRINK = '/stock/martini.svg';
const STOCK_SELFIE = '/stock/selfie.svg';
const REAR: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
};

/** Front cameras often deliver a dark first frame while auto-exposure adjusts. */
const EXPOSURE_SETTLE_MS = 250;
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const stopStream = (st: MediaStream | null) => st?.getTracks().forEach((t) => t.stop());
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

async function attach(v: HTMLVideoElement | null, st: MediaStream) {
  if (!v) return;
  v.muted = true;
  v.playsInline = true; // iOS: otherwise opens the system fullscreen player
  v.setAttribute('playsinline', '');
  v.srcObject = st;
  try {
    await v.play();
  } catch {
    /* autoplay of a muted inline stream is allowed; ignore transient aborts */
  }
}

function drawToShots(src: CanvasImageSource, w: number, h: number, mirror: boolean): Shot {
  const make = (maxW: number, q: number) => {
    const scale = Math.min(1, maxW / w);
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * scale);
    cv.height = Math.round(h * scale);
    const ctx = cv.getContext('2d')!;
    if (mirror) {
      ctx.translate(cv.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(src, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', q);
  };
  return { full: make(1080, 0.85), recap: make(640, 0.78), thumb: make(240, 0.7) };
}

/** Capture a frame: ImageCapture.takePhoto() where supported, else drawImage from the video. */
async function grab(v: HTMLVideoElement, mirror: boolean, track?: MediaStreamTrack): Promise<Shot> {
  type IC = { takePhoto: () => Promise<Blob> };
  const ICtor = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => IC }).ImageCapture;
  if (ICtor && track && track.readyState === 'live' && !mirror) {
    try {
      const blob = await Promise.race([new ICtor(track).takePhoto(), sleep(1500).then(() => Promise.reject(new Error('timeout')))]);
      const bmp = await createImageBitmap(blob);
      const shot = drawToShots(bmp, bmp.width, bmp.height, false);
      bmp.close();
      return shot;
    } catch {
      /* fall back to the video frame */
    }
  }
  return drawToShots(v, v.videoWidth || 720, v.videoHeight || 960, mirror);
}

/** Front camera: prefer a device labelled front/user/selfie, else any other camera than the rear one. */
function pickFront(devices: MediaDeviceInfo[], rearId?: string) {
  const others = devices.filter((d) => d.deviceId && d.deviceId !== rearId);
  return (others.find((d) => /front|user|selfie|facetime/i.test(d.label)) ?? others[0])?.deviceId ?? null;
}

async function framesFlowing(videos: HTMLVideoElement[], ms: number) {
  const start = videos.map((v) => v.currentTime);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (videos.every((v, i) => v.readyState >= 2 && v.videoWidth > 0 && v.currentTime > start[i])) return true;
    await sleep(50);
  }
  return false;
}

export function DualCamera() {
  const set = useUi((u) => u.set);
  const toast = useUi((u) => u.toast);
  const rearV = useRef<HTMLVideoElement>(null);
  const frontV = useRef<HTMLVideoElement>(null);
  const rearS = useRef<MediaStream | null>(null);
  const frontS = useRef<MediaStream | null>(null);
  const frontId = useRef<string | null>(null);
  const run = useRef(0);
  const [mode, setMode] = useState<Mode>('flip');
  const [phase, setPhase] = useState<Phase>('init');
  const [drink, setDrink] = useState<Shot | null>(null);
  const [selfie, setSelfie] = useState<Shot | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const stopAll = useCallback(() => {
    stopStream(rearS.current);
    stopStream(frontS.current);
    rearS.current = null;
    frontS.current = null;
    if (rearV.current) rearV.current.srcObject = null;
    if (frontV.current) frontV.current.srcObject = null;
  }, []);

  const goStock = useCallback((why: string) => {
    setMode('stock');
    setNote(why);
    setPhase('rear');
  }, []);

  const start = useCallback(async () => {
    const token = ++run.current;
    const stale = () => token !== run.current;
    stopAll();
    setDrink(null);
    setSelfie(null);
    setNote('');
    setPhase('init');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      goStock('Camera needs HTTPS and camera support, so we’re using sample photos.');
      return;
    }
    let rear: MediaStream;
    try {
      rear = await navigator.mediaDevices.getUserMedia(REAR);
    } catch (e) {
      if (stale()) return;
      const name = (e as DOMException)?.name;
      goStock(name === 'NotAllowedError' ? 'Camera permission was denied, so we’re using sample photos.' : 'No camera found, so we’re using sample photos.');
      return;
    }
    if (stale()) return stopStream(rear);
    rearS.current = rear;
    await attach(rearV.current, rear);

    const rearTrack = rear.getVideoTracks()[0];
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    frontId.current = pickFront(devices, rearTrack.getSettings().deviceId);
    if (stale()) return;

    // Mode B probe: open the front camera while the rear stream is still live.
    const cached = localStorage.getItem(PROBE_KEY);
    if (devices.length >= 2 && frontId.current && cached !== 'no') {
      let front: MediaStream | null = null;
      try {
        front = await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: frontId.current }, width: { ideal: 640 } } });
      } catch {
        front = null;
      }
      if (stale()) return stopStream(front);
      let ok = false;
      if (front) {
        await attach(frontV.current, front);
        const live = () => rearTrack.readyState === 'live' && front!.getVideoTracks()[0]?.readyState === 'live';
        ok = live() && (await framesFlowing([rearV.current!, frontV.current!].filter(Boolean), 1000)) && live();
      }
      if (stale()) return stopStream(front);
      localStorage.setItem(PROBE_KEY, ok ? 'yes' : 'no');
      if (ok && front) {
        frontS.current = front;
        setMode('dual');
        setPhase('dual');
        return;
      }
      stopStream(front);
      if (frontV.current) frontV.current.srcObject = null;
      // Some devices end the first track when a second camera opens: reopen the rear one.
      if (rearTrack.readyState !== 'live') {
        try {
          const again = await navigator.mediaDevices.getUserMedia(REAR);
          if (stale()) return stopStream(again);
          rearS.current = again;
          await attach(rearV.current, again);
        } catch {
          goStock('The camera stopped unexpectedly, so we’re using sample photos.');
          return;
        }
      }
    }
    setMode('flip');
    setPhase('rear');
  }, [stopAll, goStock]);

  useEffect(() => {
    void start();
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        run.current++;
        stopAll();
        setPhase((p) => (p === 'scanning' || p === 'result' ? p : 'paused'));
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      run.current++;
      stopAll();
    };
  }, [start, stopAll]);

  /**
   * No countdown (change request 4): like BeReal, the selfie is taken as soon as the front camera
   * delivers frames, plus a short settle so auto-exposure isn't capturing a black first frame.
   */
  const settle = async (token: number) => {
    await sleep(EXPOSURE_SETTLE_MS);
    return token === run.current;
  };

  const toScan = () => {
    setPhase('scanning');
    window.setTimeout(() => setPhase((p) => (p === 'scanning' ? 'result' : p)), reduceMotion() ? 1200 : 2200);
  };

  const shutter = async () => {
    if (busy) return;
    setBusy(true);
    const token = run.current;
    try {
      if (mode === 'stock') {
        setDrink({ full: STOCK_DRINK, recap: STOCK_DRINK, thumb: STOCK_DRINK });
        setPhase('flip');
        await sleep(450);
        setSelfie({ full: STOCK_SELFIE, recap: STOCK_SELFIE, thumb: STOCK_SELFIE });
        toScan();
        return;
      }
      if (mode === 'dual' && rearV.current && frontV.current) {
        const [d, f] = await Promise.all([
          grab(rearV.current, false, rearS.current?.getVideoTracks()[0]),
          grab(frontV.current, true),
        ]);
        stopAll();
        setDrink(d);
        setSelfie(f);
        toScan();
        return;
      }
      // Mode A quick-flip.
      if (!rearV.current) return;
      const d = await grab(rearV.current, false, rearS.current?.getVideoTracks()[0]);
      stopStream(rearS.current);
      rearS.current = null;
      setDrink(d);
      setPhase('flip');
      let front: MediaStream | null = null;
      try {
        front = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: frontId.current ? { deviceId: { exact: frontId.current } } : { facingMode: 'user' },
        });
      } catch {
        try {
          front = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } });
        } catch {
          front = null;
        }
      }
      if (token !== run.current) return stopStream(front);
      if (!front) {
          setNote('Couldn’t open the front camera, so we used a sample selfie.');
          setSelfie({ full: STOCK_SELFIE, recap: STOCK_SELFIE, thumb: STOCK_SELFIE });
        toScan();
        return;
      }
      frontS.current = front;
      setPhase('front');
      await attach(frontV.current, front);
      await framesFlowing([frontV.current!], 1200);
      if (!(await settle(token))) return;
      const f = await grab(frontV.current!, true);
      stopAll();
      setSelfie(f);
      toScan();
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    run.current++;
    stopAll();
    set({ fullscreen: null });
  };

  const logIt = () => {
    const id = `scan-${Date.now().toString(36)}`;
    if (drink && selfie) savePhotos(id, drink.thumb, selfie.thumb, drink.recap, selfie.recap);
    dispatch((w, n) =>
      logDrink(w, { id, name: MARTINI.name, detail: `${MARTINI.size} · ~${MARTINI.abv}% ABV`, std: MARTINI.std, emoji: MARTINI.emoji, scanned: true }, n),
    );
    set({ fullscreen: null, userTab: 'drinks' });
  };

  const showRearLive = mode !== 'stock' && (phase === 'rear' || phase === 'dual' || phase === 'init');
  const showFrontLive = mode !== 'stock' && (phase === 'dual' || phase === 'front');
  const modeLabel = mode === 'dual' ? 'Dual camera' : mode === 'stock' ? 'Sample photos' : 'Quick-flip';
  const hint =
    phase === 'init'
      ? 'Opening camera…'
      : phase === 'rear' || phase === 'dual'
        ? phase === 'dual'
          ? 'Drink and you, in one shot'
          : 'Point at your drink'
        : phase === 'flip'
          ? 'Flipping…'
          : phase === 'front'
            ? 'Now you!'
            : '';

  return (
    <div className={c.cam} role="dialog" aria-modal="true" aria-label="Scan a drink">
      <div className={c.top}>
        <IconButton label="Close camera" onClick={close} className={c.close}>
          <X size={22} />
        </IconButton>
        <span className={c.mode}>{modeLabel}</span>
      </div>

      <div className={c.stage}>
        {/* Main view: rear live preview, or the frozen drink photo. */}
        <video ref={rearV} className={c.main} style={{ visibility: showRearLive ? 'visible' : 'hidden' }} muted playsInline autoPlay aria-hidden />
        {!showRearLive && (drink || mode === 'stock') && <img className={c.main} src={drink?.full ?? STOCK_DRINK} alt="Your drink" />}

        {/* Inset: front live preview or the captured selfie (mirrored like BeReal). */}
        <div className={cx(c.inset, !(showFrontLive || selfie || (mode === 'stock' && phase === 'front')) && c.insetHidden)}>
          <video ref={frontV} className={c.insetMedia} style={{ visibility: showFrontLive ? 'visible' : 'hidden', transform: 'scaleX(-1)' }} muted playsInline autoPlay aria-hidden />
          {!showFrontLive && (selfie || mode === 'stock') && <img className={c.insetMedia} src={selfie?.full ?? STOCK_SELFIE} alt="Your selfie" />}
        </div>

        {phase === 'flip' && <div className={c.flash} aria-hidden />}
        {(phase === 'scanning' || phase === 'result') && (
          <div className={cx(c.scan, phase === 'result' && c.scanDone)} aria-hidden={phase === 'result'}>
            <span className={c.corner} data-c="tl" />
            <span className={c.corner} data-c="tr" />
            <span className={c.corner} data-c="bl" />
            <span className={c.corner} data-c="br" />
            {phase === 'scanning' && <span className={c.sweep} />}
          </div>
        )}
        {phase === 'scanning' && (
          <p className={c.scanLabel} role="status">
            <Loader2 size={18} className={c.spin} aria-hidden /> Identifying your drink…
          </p>
        )}
        {phase === 'paused' && (
          <div className={c.paused}>
            <p>Camera paused while SafeSip was in the background.</p>
            <Button variant="primary" onClick={() => void start()}>
              <RefreshCw size={18} /> Resume camera
            </Button>
          </div>
        )}
        {note && phase !== 'result' && <p className={c.note}>{note}</p>}
      </div>

      {phase === 'result' ? (
        <div className={c.result}>
          <p className={c.resultTitle}>
            <span aria-hidden>{MARTINI.emoji}</span> {MARTINI.name}
          </p>
          <p className={c.resultMeta}>
            {MARTINI.size} · ~{MARTINI.abv}% ABV · ≈{MARTINI.std} standard drinks
          </p>
          <Button variant="primary" block onClick={logIt}>
            Log it
          </Button>
          <Button
            variant="text"
            block
            onClick={() => {
              close();
              set({ userTab: 'drinks' });
              toast('Pick your drink from “Add manually”');
            }}
          >
            Not right? Pick manually
          </Button>
        </div>
      ) : (
        <div className={c.bottom}>
          <p className={c.hint} aria-live="polite">
            {hint}
          </p>
          <button
            type="button"
            className={c.shutter}
            aria-label={phase === 'dual' ? 'Take both photos' : 'Take photo of your drink'}
            disabled={busy || !(phase === 'rear' || phase === 'dual')}
            onClick={() => void shutter()}
          >
            <Camera size={28} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
