import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCw, SwitchCamera, X } from 'lucide-react';
import { Button, IconButton, cx } from '../../components/ui';
import { MARTINI } from '../../data/drinks';
import { dispatch, motionReduced, savePhotos, useUi } from '../../store';
import { logDrink } from '../../store/world';
import c from './camera.module.css';

/* BeReal-style pair capture. The selected camera takes the first shot; the opposite camera follows. */
type Mode = 'flip' | 'dual' | 'stock';
type Side = 'rear' | 'front';
type Phase = 'init' | 'ready' | 'handoff' | 'paused' | 'scanning' | 'result';
interface Shot {
  full: string;
  recap: string;
  thumb: string;
}

const PROBE_KEY = 'safesip.dualcam.v1';
const STOCK_DRINK = '/stock/martini.svg';
const STOCK_SELFIE = '/stock/selfie.svg';
const AUTO_SHOT_DELAY_MS = 2200;
const EXPOSURE_SETTLE_MS = 250;
const REAR: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
};

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const stopStream = (st: MediaStream | null) => st?.getTracks().forEach((t) => t.stop());
const reduceMotion = motionReduced;
const opposite = (side: Side): Side => (side === 'rear' ? 'front' : 'rear');
const stockShot = (side: Side): Shot => {
  const src = side === 'rear' ? STOCK_DRINK : STOCK_SELFIE;
  return { full: src, recap: src, thumb: src };
};

function constraintsFor(side: Side, frontId: string | null): MediaStreamConstraints {
  if (side === 'rear') return REAR;
  return {
    audio: false,
    video: frontId
      ? { deviceId: { exact: frontId }, width: { ideal: 640 }, height: { ideal: 960 } }
      : { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 960 } },
  };
}

async function attach(v: HTMLVideoElement | null, st: MediaStream) {
  if (!v) return;
  v.muted = true;
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.srcObject = st;
  try {
    await v.play();
  } catch {
    /* Muted inline playback is allowed; ignore transient aborts. */
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

/** Capture with ImageCapture when available, else take the current video frame. */
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
      /* Fall back to a frame from the video. */
    }
  }
  return drawToShots(v, v.videoWidth || 720, v.videoHeight || 960, mirror);
}

/** Front cameras often deliver a dark first frame while auto-exposure adjusts. */
async function settle() {
  await sleep(EXPOSURE_SETTLE_MS);
}

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
  const firstSide = useRef<Side>('rear');
  const [mode, setMode] = useState<Mode>('flip');
  const [side, setSide] = useState<Side>('rear');
  const [canFlip, setCanFlip] = useState(false);
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
    setCanFlip(false);
    setNote(why);
    setPhase('ready');
  }, []);

  const start = useCallback(async (initialSide: Side = 'rear') => {
    const token = ++run.current;
    const stale = () => token !== run.current;
    stopAll();
    setDrink(null);
    setSelfie(null);
    setNote('');
    setSide(initialSide);
    firstSide.current = initialSide;
    setPhase('init');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      goStock('Camera needs HTTPS and camera support, so we’re using sample photos.');
      return;
    }

    const assign = (which: Side, stream: MediaStream | null) => {
      if (which === 'rear') rearS.current = stream;
      else frontS.current = stream;
    };
    const videoFor = (which: Side) => (which === 'rear' ? rearV.current : frontV.current);
    let firstStream: MediaStream;
    try {
      firstStream = await navigator.mediaDevices.getUserMedia(constraintsFor(initialSide, frontId.current));
    } catch (e) {
      if (stale()) return;
      const name = (e as DOMException)?.name;
      goStock(name === 'NotAllowedError' ? 'Camera permission was denied, so we’re using sample photos.' : 'No camera found, so we’re using sample photos.');
      return;
    }
    if (stale()) return stopStream(firstStream);
    assign(initialSide, firstStream);
    await attach(videoFor(initialSide), firstStream);
    const firstTrack = firstStream.getVideoTracks()[0];
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    frontId.current = initialSide === 'front' ? firstTrack.getSettings().deviceId ?? pickFront(devices) : pickFront(devices, firstTrack.getSettings().deviceId);
    setCanFlip(devices.length >= 2 && !!frontId.current);
    if (stale()) return;

    // Try to keep both previews live on devices that support it; capture remains sequential.
    const cached = localStorage.getItem(PROBE_KEY);
    if (devices.length >= 2 && frontId.current && cached !== 'no') {
      let other: MediaStream | null = null;
      const otherSide = opposite(initialSide);
      try {
        other = await navigator.mediaDevices.getUserMedia(constraintsFor(otherSide, frontId.current));
      } catch {
        other = null;
      }
      if (stale()) return stopStream(other);
      let ok = false;
      if (other) {
        assign(otherSide, other);
        await attach(videoFor(otherSide), other);
        const rearTrack = rearS.current?.getVideoTracks()[0];
        const frontTrack = frontS.current?.getVideoTracks()[0];
        const live = () => rearTrack?.readyState === 'live' && frontTrack?.readyState === 'live';
        ok = !!live() && (await framesFlowing([rearV.current!, frontV.current!].filter(Boolean), 1000)) && !!live();
      }
      if (stale()) return stopStream(other);
      localStorage.setItem(PROBE_KEY, ok ? 'yes' : 'no');
      if (ok && other) {
        setMode('dual');
        setPhase('ready');
        return;
      }
      stopStream(other);
      assign(otherSide, null);
      if (videoFor(otherSide)) videoFor(otherSide)!.srcObject = null;
      // Some phones stop the first track when opening the second camera; reopen the selected one.
      if (firstTrack.readyState !== 'live') {
        try {
          const again = await navigator.mediaDevices.getUserMedia(constraintsFor(initialSide, frontId.current));
          if (stale()) return stopStream(again);
          assign(initialSide, again);
          await attach(videoFor(initialSide), again);
        } catch {
          goStock('The camera stopped unexpectedly, so we’re using sample photos.');
          return;
        }
      }
    }
    setMode('flip');
    setPhase('ready');
  }, [stopAll, goStock]);

  const flipCamera = async () => {
    if (busy || phase !== 'ready' || mode === 'stock' || !canFlip) return;
    const nextSide = opposite(side);
    if (mode === 'dual') {
      setSide(nextSide);
      return;
    }
    const token = ++run.current;
    setBusy(true);
    setPhase('init');
    stopAll();
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraintsFor(nextSide, frontId.current));
      if (token !== run.current) return stopStream(stream);
      if (nextSide === 'rear') rearS.current = stream;
      else frontS.current = stream;
      await attach(nextSide === 'rear' ? rearV.current : frontV.current, stream);
      setSide(nextSide);
      setPhase('ready');
    } catch {
      if (token !== run.current) return;
      setNote('Couldn’t switch cameras. Reopening the current camera…');
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraintsFor(side, frontId.current));
        if (token !== run.current) return stopStream(stream);
        if (side === 'rear') rearS.current = stream;
        else frontS.current = stream;
        await attach(side === 'rear' ? rearV.current : frontV.current, stream);
        setPhase('ready');
      } catch {
        goStock('The camera stopped unexpectedly, so we’re using sample photos.');
      }
    } finally {
      if (token === run.current) setBusy(false);
    }
  };

  useEffect(() => {
    void start('rear');
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

  const toScan = () => {
    setPhase('scanning');
    window.setTimeout(() => setPhase((p) => (p === 'scanning' ? 'result' : p)), reduceMotion() ? 1200 : 2200);
  };

  const shutter = async () => {
    if (busy || phase !== 'ready') return;
    setBusy(true);
    const token = run.current;
    const first = side;
    const second = opposite(first);
    firstSide.current = first;
    try {
      let firstShot: Shot;
      if (mode === 'stock') firstShot = stockShot(first);
      else {
        const video = first === 'rear' ? rearV.current : frontV.current;
        const stream = first === 'rear' ? rearS.current : frontS.current;
        if (!video) return;
        firstShot = await grab(video, first === 'front', stream?.getVideoTracks()[0]);
      }
      if (token !== run.current) return;
      if (first === 'rear') setDrink(firstShot);
      else setSelfie(firstShot);
      setPhase('handoff');

      if (mode !== 'dual') stopAll();
      await sleep(reduceMotion() ? 1200 : AUTO_SHOT_DELAY_MS);
      if (token !== run.current) return;

      let secondShot: Shot | null = null;
      if (mode === 'stock') {
        secondShot = stockShot(second);
      } else {
        let video = second === 'rear' ? rearV.current : frontV.current;
        let stream = second === 'rear' ? rearS.current : frontS.current;
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraintsFor(second, frontId.current));
            if (token !== run.current) return stopStream(stream);
            if (second === 'rear') rearS.current = stream;
            else frontS.current = stream;
            video = second === 'rear' ? rearV.current : frontV.current;
            await attach(video, stream);
          } catch {
            stream = null;
          }
        }
        if (video && stream && (await framesFlowing([video], 1200))) {
          await settle();
          if (token !== run.current) return;
          secondShot = await grab(video, second === 'front', stream.getVideoTracks()[0]);
        }
        if (!secondShot) {
          setNote(second === 'rear' ? 'Couldn’t capture the drink photo, so we used a sample.' : 'Couldn’t open the front camera, so we used a sample selfie.');
          secondShot = stockShot(second);
        }
      }
      if (token !== run.current) return;
      if (second === 'rear') setDrink(secondShot);
      else setSelfie(secondShot);
      stopAll();
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

  const retake = () => void start(firstSide.current);
  const showLive = mode !== 'stock' && phase === 'ready';
  const showRearLive = showLive && (side === 'rear' || mode === 'dual');
  const showFrontLive = showLive && (side === 'front' || mode === 'dual');
  const handoffShot = firstSide.current === 'rear' ? drink : selfie;
  const mainShot = phase === 'handoff' ? handoffShot : phase === 'scanning' || phase === 'result' ? drink : mode === 'stock' ? stockShot('rear') : null;
  const showPair = (phase === 'scanning' || phase === 'result') && !!selfie;
  const nextMessage = firstSide.current === 'rear' ? 'Smile now, uh I mean now' : 'Nice, now your drink';
  const modeLabel = mode === 'dual' ? 'Dual camera' : mode === 'stock' ? 'Sample photos' : 'Quick-flip';
  const hint = phase === 'init' ? 'Opening camera…' : phase === 'ready' ? (side === 'rear' ? 'Point at your drink' : 'Frame your selfie') : '';

  return (
    <div className={c.cam} role="dialog" aria-modal="true" aria-label="Scan a drink">
      <div className={c.top}>
        <IconButton label="Close camera" onClick={close} className={c.close}>
          <X size={22} />
        </IconButton>
        <div className={c.topActions}>
          {phase === 'ready' && mode !== 'stock' && canFlip && (
            <IconButton label={`Switch to ${opposite(side)} camera`} onClick={() => void flipCamera()} className={c.flipButton}>
              <SwitchCamera size={20} />
            </IconButton>
          )}
          <span className={c.mode}>{modeLabel}</span>
        </div>
      </div>

      <div className={c.stage}>
        <video ref={rearV} className={side === 'rear' ? c.main : c.secondary} style={{ visibility: showRearLive ? 'visible' : 'hidden' }} muted playsInline autoPlay aria-hidden />
        <video ref={frontV} className={side === 'front' ? c.main : c.secondary} style={{ visibility: showFrontLive ? 'visible' : 'hidden', transform: 'scaleX(-1)' }} muted playsInline autoPlay aria-hidden />
        {!showLive && mainShot && <img className={c.main} src={mainShot.full} alt={phase === 'handoff' && firstSide.current === 'front' ? 'Your selfie' : 'Your drink'} />}

        {showPair && selfie && (
          <div className={c.inset}>
            <img className={c.insetMedia} src={selfie.full} alt="Your selfie" />
          </div>
        )}

        {phase === 'handoff' && (
          <div className={c.handoff} role="status" aria-live="polite">
            <Loader2 size={34} className={c.spin} aria-hidden />
            <span>{nextMessage}</span>
          </div>
        )}
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
            <Button variant="primary" onClick={() => void start(firstSide.current)}>
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
          <Button variant="secondary" block onClick={retake}>
            <RefreshCw size={18} /> Retake photos
          </Button>
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
            aria-label={side === 'front' ? 'Take selfie' : 'Take photo of your drink'}
            disabled={busy || phase !== 'ready'}
            onClick={() => void shutter()}
          >
            <Camera size={28} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
