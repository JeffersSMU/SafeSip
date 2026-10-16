import { useEffect, useRef, useState } from 'react';
import { Camera, Download, Home, MapPin, PartyPopper, ShieldCheck, X } from 'lucide-react';
import { Button, IconButton, Modal, cx, ui } from '../../components/ui';
import { CHLOE } from '../../data/cast';
import { dispatch, useUi, useWorld } from '../../store';
import { fmtDuration, fmtTime } from '../../store/time';
import { confirmArrival, finishSummary } from '../../store/world';
import s from './user.module.css';

/** "Have you reached home?" (heuristic B2, wording per change request 17). */
export function ArrivalModal() {
  const set = useUi((u) => u.set);
  return (
    <Modal title="Have you reached home?" center zIndex={72}>
      <div className={s.ci}>
        <Home size={40} color="var(--safe)" aria-hidden />
        <p className={ui.muted}>Confirm you're home to end your session.</p>
        <Button
          variant="safe"
          block
          onClick={() => {
            dispatch((w, n) => confirmArrival(w, true, n));
            set({ fullscreen: null });
          }}
        >
          Yes, I'm home
        </Button>
        <Button
          variant="secondary"
          block
          onClick={() => {
            dispatch((w, n) => confirmArrival(w, false, n));
            set({ fullscreen: null });
          }}
        >
          Not yet, still out
        </Button>
      </div>
    </Modal>
  );
}

/**
 * End-of-night recap. Deliberately avoids alcohol metrics (no drink counts, standard drinks or pace):
 * it celebrates the night itself — time out, places, captured moments and getting home safe.
 */
export function SummaryModal() {
  const sum = useWorld((w) => w.world.chloe.summary)!;
  const drinks = useWorld((w) => w.world.chloe.drinks);
  const photos = useUi((u) => u.photos);
  const set = useUi((u) => u.set);
  const toast = useUi((u) => u.toast);
  const trackRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<null | number>(null);

  // Moments captured tonight, keyed by the drink id (photos survive the session).
  // Prefer the mid-size capture; fall back to the thumbnail for photos saved before that existed.
  const shots = drinks
    .filter((d) => photos[d.id])
    .map((d) => {
      const ph = photos[d.id];
      return { id: d.id, drink: ph.drinkRecap ?? ph.drink, selfie: ph.selfieRecap ?? ph.selfie, t: d.t };
    });

  const outFor = fmtDuration(sum.endMin - sum.startMin);
  const stops = sum.venues.length;
  const checkInLabel =
    sum.checkInsTotal === 0 ? 'None needed' : sum.checkInsAnswered === sum.checkInsTotal ? 'All good' : `${sum.checkInsAnswered}/${sum.checkInsTotal} answered`;

  const onTrackScroll = () => {
    const el = trackRef.current;
    if (!el || shots.length === 0) return;
    setActive(Math.min(shots.length - 1, Math.round(el.scrollLeft / (el.scrollWidth / shots.length))));
  };

  const onLightScroll = () => {
    const el = lightRef.current;
    if (!el || shots.length === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setViewer(Math.min(shots.length - 1, Math.max(0, idx)));
  };

  useEffect(() => {
    if (viewer == null) return;
    const el = lightRef.current;
    if (!el) return;
    el.scrollTo({ left: viewer * el.clientWidth, behavior: 'auto' });
  }, [viewer]);

  useEffect(() => {
    if (viewer == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setViewer(null);
        return;
      }
      if (shots.length < 2) return;
      if (e.key === 'ArrowLeft') {
        setViewer((v) => (v == null ? 0 : Math.max(0, v - 1)));
      }
      if (e.key === 'ArrowRight') {
        setViewer((v) => (v == null ? 0 : Math.min(shots.length - 1, v + 1)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer, shots.length]);

  const saveShot = async (idx: number) => {
    try {
      const sh = shots[idx];
      if (!sh) return;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no ctx');
      const W = 1080;
      canvas.width = W;
      canvas.height = W;
      const bg = new Image();
      bg.crossOrigin = 'anonymous';
      bg.decoding = 'async';
      await new Promise((res, rej) => {
        bg.onload = res;
        bg.onerror = rej;
        bg.src = sh.drink;
      });
      const bw = bg.naturalWidth || bg.width;
      const bh = bg.naturalHeight || bg.height;
      const scale = Math.max(W / bw, W / bh);
      const dw = bw * scale;
      const dh = bh * scale;
      const dx = (W - dw) / 2;
      const dy = (W - dh) / 2;
      ctx.drawImage(bg, dx, dy, dw, dh);
      const fg = new Image();
      fg.crossOrigin = 'anonymous';
      fg.decoding = 'async';
      await new Promise((res, rej) => {
        fg.onload = res;
        fg.onerror = rej;
        fg.src = sh.selfie;
      });
      const fw = 320;
      const fh = 400;
      const fx = Math.round(W * 0.08);
      const fy = Math.round(W * 0.08); // top-left inset
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(fx, fy, fw, fh, 20);
        ctx.clip();
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(fx - 2, fy - 2, fw + 4, fh + 4);
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(fx, fy, fw, fh, 18);
        ctx.clip();
      }
      const sw = fg.naturalWidth || fg.width;
      const shh = fg.naturalHeight || fg.height;
      const s = Math.max(fw / sw, fh / shh);
      const fdw = sw * s;
      const fdh = shh * s;
      const fdx = fx + (fw - fdw) / 2;
      const fdy = fy + (fh - fdh) / 2;
      ctx.drawImage(fg, fdx, fdy, fdw, fdh);
      ctx.restore?.();
      if (canvas.toBlob) {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              toast('Could not save image', 'warn');
              return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `safesip-moment-${sh.id.slice(0, 6)}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast('Saved', 'safe');
          },
          'image/jpeg',
          0.9
        );
      } else {
        const url = canvas.toDataURL('image/jpeg', 0.9);
        const a = document.createElement('a');
        a.href = url;
        a.download = `safesip-moment-${sh.id.slice(0, 6)}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast('Saved', 'safe');
      }
    } catch {
      toast('Could not save image', 'warn');
    }
  };

  return (
    <>
    <Modal title="That's a wrap!" center zIndex={72}>
      <div className={s.recapHero}>
        <PartyPopper size={26} aria-hidden />
        <div>
          <p className={s.recapLead}>What a night, {CHLOE.short}!</p>
          <p className={s.recapSub}>
            {fmtTime(sum.startMin)} – {fmtTime(sum.endMin)}
          </p>
        </div>
      </div>

      <div className={s.recapTiles}>
        <div className={s.recapTile}>
          <strong>{outFor}</strong>
          <span>out &amp; about</span>
        </div>
        <div className={s.recapTile}>
          <strong>{stops}</strong>
          <span>{stops === 1 ? 'stop' : 'stops'}</span>
        </div>
        {shots.length > 0 && (
          <div className={s.recapTile}>
            <strong>{shots.length}</strong>
            <span>{shots.length === 1 ? 'memory' : 'memories'}</span>
          </div>
        )}
      </div>

      {sum.venues.length > 0 && (
        <p className={s.recapRoute}>
          <MapPin size={15} aria-hidden /> {sum.venues.join(' → ')}
        </p>
      )}

      {shots.length > 0 && (
        <section className={s.recapSection} aria-label="Photos from your night">
          <h3 className={s.recapTitle}>
            <Camera size={16} aria-hidden /> Memories in Pictures
          </h3>
          <div className={s.recapTrack} ref={trackRef} onScroll={onTrackScroll}>
            {shots.map((sh, i) => (
              <figure key={sh.id} className={s.recapCard}>
                <button type="button" className={s.recapShotBtn} onClick={() => setViewer(i)} aria-label="View photo">
                  <div className={s.recapShot}>
                    <img src={sh.drink} alt="A moment from your night" />
                    <img className={s.recapSelfie} src={sh.selfie} alt="Your selfie" />
                  </div>
                </button>
                <figcaption className={s.recapCap}>{fmtTime(sh.t)}</figcaption>
              </figure>
            ))}
          </div>
          {shots.length > 1 && (
            <div className={s.recapDots} aria-hidden>
              {shots.map((sh, i) => (
                <span key={sh.id} className={cx(s.recapDot, i === active && s.recapDotOn)} />
              ))}
            </div>
          )}
        </section>
      )}

      <div className={s.sumGrid}>
        <div className={s.sumCell}>
          <span className={cx(ui.muted, ui.small)}>Check-ins</span>
          <strong>{checkInLabel}</strong>
        </div>
        <div className={s.sumCell}>
          <span className={cx(ui.muted, ui.small)}>Home safe</span>
          <strong>{fmtTime(sum.endMin)}</strong>
        </div>
      </div>

      <p className={s.recapSafe}>
        <ShieldCheck size={16} aria-hidden /> Helen knew you were safe all night!
      </p>

      <Button
        variant="primary"
        block
        onClick={() => {
          dispatch(finishSummary);
          set({ userTab: 'map' });
        }}
      >
        Done
      </Button>
    </Modal>
    {viewer != null && shots[viewer] && (
      <div className={s.lightbox} role="dialog" aria-modal="true" aria-label="Photo viewer">
        <div className={s.lightboxHead}>
          <IconButton label="Save to device" onClick={() => saveShot(viewer)}>
            <Download size={20} />
          </IconButton>
          <IconButton label="Close" onClick={() => setViewer(null)}>
            <X size={20} />
          </IconButton>
        </div>
        <div ref={lightRef} className={s.lightboxTrack} onScroll={onLightScroll}>
          {shots.map((sh) => (
            <div key={sh.id} className={s.lightboxSlide}>
              <div className={s.lightboxShot}>
                <img src={sh.drink} alt="A moment from your night" />
                <img className={s.lightboxSelfie} src={sh.selfie} alt="Your selfie" />
              </div>
            </div>
          ))}
        </div>
        {shots.length > 1 && (
          <div className={s.lightboxDots} aria-hidden>
            {shots.map((sh, i) => (
              <span key={sh.id} className={cx(s.lightboxDot, i === viewer && s.lightboxDotOn)} />
            ))}
          </div>
        )}
      </div>
    )}
    </>
  );
}
