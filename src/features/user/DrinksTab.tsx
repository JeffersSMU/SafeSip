import { useRef, useState } from 'react';
import { Camera, Info, Plus, Undo2 } from 'lucide-react';
import { Avatar, Button, Header, Modal, cx, ui } from '../../components/ui';
import { SARAH } from '../../data/cast';
import { DRINK_PRESETS, customStd, paceOf, type Pace } from '../../data/drinks';
import { dispatch, useNow, useUi, useWorld } from '../../store';
import { fmtTime } from '../../store/time';
import { chloePace, logDrink, nowMin, stdTotal, undoDrink } from '../../store/world';
import { UserPill } from './common';
import s from './user.module.css';

const id = () => `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function OtherSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [ml, setMl] = useState('200');
  const [abv, setAbv] = useState('5');
  const std = customStd(Number(ml) || 0, Number(abv) || 0);
  return (
    <Modal title="Other drink" onClose={onClose}>
      <div className={s.form}>
        <div className={ui.field}>
          <label className={ui.label} htmlFor="o-name">
            Name
          </label>
          <input id="o-name" className={ui.input} value={name} placeholder="e.g. Soju" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={s.btnRow}>
          <div className={ui.field}>
            <label className={ui.label} htmlFor="o-ml">
              Size (ml)
            </label>
            <input id="o-ml" className={ui.input} inputMode="numeric" value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className={ui.field}>
            <label className={ui.label} htmlFor="o-abv">
              Strength (% ABV)
            </label>
            <input id="o-abv" className={ui.input} inputMode="decimal" value={abv} onChange={(e) => setAbv(e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
        </div>
        <p className={ui.muted}>≈ {std} standard drinks</p>
        <Button
          variant="primary"
          block
          onClick={() => {
            dispatch((w, n) => logDrink(w, { id: id(), name: name.trim() || 'Other', detail: `${ml} ml · ${abv}% ABV`, std, emoji: '🥤' }, n));
            onClose();
          }}
        >
          Log it
        </Button>
      </div>
    </Modal>
  );
}

const PACE_LABEL: Record<Pace, string> = { LOW: 'LOW', MED: 'MED', HIGH: 'HIGH' };

export function DrinksTab() {
  const now = useNow(10000);
  const w = useWorld((x) => x.world);
  const photos = useUi((u) => u.photos);
  const set = useUi((u) => u.set);
  const [other, setOther] = useState(false);
  const [tip, setTip] = useState(false);
  const press = useRef<number | undefined>(undefined);
  const c = w.chloe;
  const t = nowMin(w, now);
  const total = stdTotal(c);
  const hours = c.session ? (t - c.session.startMin) / 60 : Math.max(1, c.drinks.length ? (t - Math.min(...c.drinks.map((d) => d.t))) / 60 : 1);
  const pace = c.session ? chloePace(w, now) : paceOf(total, hours);
  const sarah = w.buddies[SARAH.id];
  // Buddies only share their pace, never their drink log (change request 4). Sarah's is hardcoded.
  const sarahPace: Pace = sarah?.pace ?? 'LOW';

  const log = (p: (typeof DRINK_PRESETS)[number]) =>
    dispatch((wd, n) => logDrink(wd, { id: id(), name: p.name, detail: p.size, std: p.std, emoji: p.emoji }, n));

  return (
    <>
      <Header title="Drinks" pill={<UserPill />} />
      <div className={s.scroll}>
        {!c.session && <p className={s.note}>No active session: nothing is shared, not even your pace.</p>}
        <section className={ui.card} aria-label="Your totals">
          <h2 className={s.sectionTitle} style={{ margin: '0 0 10px' }}>
            Your totals
          </h2>
          <div className={s.totals}>
            <div>
              <span key={c.drinks.length} className={cx(s.big, c.drinks.length > 0 && s.bump)}>{c.drinks.length}</span>
              <span className={cx(ui.muted, ui.small)}>drinks</span>
            </div>
            <div>
              <span key={total} className={cx(s.big, c.drinks.length > 0 && s.bump)}>{total}</span>
              <span className={cx(ui.muted, ui.small)}>standard drinks</span>
            </div>
            <div>
              <span key={pace} className={cx(s.big, s[`p_${pace}`], c.drinks.length > 0 && s.bump)}>{PACE_LABEL[pace]}</span>
              <span className={cx(ui.muted, ui.small, s.pace)}>
                Pace
                <button
                  type="button"
                  aria-label="What does pace mean?"
                  aria-expanded={tip}
                  onClick={() => setTip(!tip)}
                  style={{ border: 0, background: 'none', padding: 4, color: 'inherit', display: 'grid' }}
                >
                  <Info size={16} />
                </button>
              </span>
            </div>
          </div>
          {tip && (
            <p className={s.tip} role="note">
              Standard drinks per hour this session. LOW &lt; 1, MED 1–2, HIGH &gt; 2. At HIGH, consider water and slowing down.
            </p>
          )}
        </section>

        <button type="button" className={s.scanCard} onClick={() => set({ fullscreen: 'camera' })}>
          <span className={s.scanIcon}>
            <Camera size={30} aria-hidden />
          </span>
          <span>
            <span style={{ display: 'block', fontWeight: 800, fontSize: 19 }}>Scan a Drink</span>
            <span style={{ opacity: 0.9, fontSize: 12 }}>Snap your drink to log it, and add a selfie to your recap!</span>
          </span>
        </button>

        <h2 className={s.sectionTitle}>Add manually</h2>
        <div className={s.grid}>
          {DRINK_PRESETS.map((p) => (
            <button key={p.key} type="button" className={s.drinkBtn} onClick={() => log(p)} aria-label={`Add ${p.name}, ${p.size}`}>
              <span className={s.plus} aria-hidden>
                <Plus size={12} strokeWidth={3} />
              </span>
              <span className={s.emoji} aria-hidden>
                {p.emoji}
              </span>
              {p.name}
            </button>
          ))}
          <button type="button" className={s.drinkBtn} onClick={() => setOther(true)} aria-label="Add another drink">
            <span className={s.plus} aria-hidden>
              <Plus size={12} strokeWidth={3} />
            </span>
            <span className={s.emoji} aria-hidden>
              ➕
            </span>
            Other
          </button>
        </div>

        <h2 className={s.sectionTitle}>Your log</h2>
        <div className={ui.card} style={{ paddingTop: 4, paddingBottom: 4 }}>
          {c.drinks.length === 0 && <p className={cx(ui.muted, s.empty)}>Nothing logged yet.</p>}
          {c.drinks.map((d) => {
            const ph = photos[d.id];
            return (
              <div
                key={d.id}
                className={s.logRow}
                onPointerDown={() => (press.current = window.setTimeout(() => dispatch((wd) => undoDrink(wd, d.id)), 650))}
                onPointerUp={() => window.clearTimeout(press.current)}
                onPointerLeave={() => window.clearTimeout(press.current)}
              >
                {ph ? (
                  <span className={s.thumbs}>
                    <img src={ph.drink} alt={`Photo of ${d.name}`} />
                    <img src={ph.selfie} alt="Selfie" />
                  </span>
                ) : (
                  <span className={s.logEmoji} aria-hidden>
                    {d.emoji}
                  </span>
                )}
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 700 }}>
                    {d.name} · {fmtTime(d.t)}
                  </span>
                  <span className={cx(ui.muted, ui.small)}>
                    {d.detail} · ≈{d.std} std
                  </span>
                </span>
                <Button variant="text" aria-label={`Undo ${d.name}`} onClick={() => dispatch((wd) => undoDrink(wd, d.id))}>
                  <Undo2 size={18} /> Undo
                </Button>
              </div>
            );
          })}
        </div>

        {c.session?.buddies.includes(SARAH.id) && sarah && (
          <>
            <h2 className={s.sectionTitle}>Buddy pace</h2>
            <div className={cx(ui.card, ui.row)}>
              <Avatar person={SARAH} size={42} />
              <span style={{ flex: 1, fontWeight: 650 }}>{SARAH.name}</span>
              <span className={ui.muted}>
                Pace <strong className={s[`p_${sarahPace}`]}>{sarahPace}</strong>
              </span>
            </div>
          </>
        )}
      </div>
      {other && <OtherSheet onClose={() => setOther(false)} />}
    </>
  );
}
