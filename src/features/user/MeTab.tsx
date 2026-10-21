import { useState } from 'react';
import { Bike, BookOpen, ChevronRight, Footprints, Home, LogOut, MapPin, Music, Phone, Plus, ShieldCheck, Timer, Toilet, Utensils, Wine } from 'lucide-react';
import { Avatar, Button, Header, LinkButton, Modal, cx, ui } from '../../components/ui';
import { MotionSetting } from '../../components/MotionSetting';
import { CHLOE, HELEN, NEXT_OF_KIN, personById } from '../../data/cast';
import { dispatch, useUi, useWorld } from '../../store';
import { manualCheckIn, setStatus } from '../../store/world';
import { UserPill } from './common';
import { telHref } from './PersonSheet';
import s from './user.module.css';

const QUICK = [
  { label: 'Bar', icon: <Wine size={18} /> },
  { label: 'Food', icon: <Utensils size={18} /> },
  { label: 'Ride', icon: <Bike size={18} /> },
  { label: 'Toilet', icon: <Toilet size={18} /> },
  { label: 'Home', icon: <Home size={18} /> },
  { label: 'Dance', icon: <Music size={18} /> },
];

const INTERVALS = [10, 20, 30];

function NokSheet({ onClose }: { onClose: () => void }) {
  const toast = useUi((u) => u.toast);
  return (
    <Modal title="Next-of-Kin" onClose={onClose}>
      <p className={cx(ui.muted, ui.small)} style={{ marginBottom: 10 }}>
        Next-of-Kin get a quiet update when you start a Night Out, and a loud alert if you send an SOS or miss a check-in.
      </p>
      {NEXT_OF_KIN.map((n) => {
        const p = personById(n.personId);
        return (
          <div key={p.id} className={ui.card} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            <Avatar person={p} size={44} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 700 }}>{p.name}</span>
              <span className={cx(ui.muted, ui.small)}>
                {n.relationship} · {p.phone} · Watcher linked
              </span>
            </span>
            <LinkButton variant="secondary" href={telHref(p.phone)} aria-label={`Call ${p.name}`}>
              <Phone size={18} />
            </LinkButton>
          </div>
        );
      })}
      <div className={s.btnRow}>
        <Button variant="secondary" block onClick={() => toast('Editing Next-of-Kin isn’t part of this prototype')}>
          Edit
        </Button>
        <Button variant="primary" block onClick={() => toast('Adding Next-of-Kin isn’t part of this prototype')}>
          <Plus size={18} /> Add
        </Button>
      </div>
    </Modal>
  );
}

function IntervalSheet({ onClose }: { onClose: () => void }) {
  const { checkInInterval, set } = useUi();
  return (
    <Modal title="Check-in interval" onClose={onClose}>
      <p className={cx(ui.muted, ui.small)} style={{ marginBottom: 12 }}>
        If you're apart from every Night Buddy this long, SafeSip checks in on you.
      </p>
      <div className={s.chips}>
        {INTERVALS.map((m) => (
          <button
            key={m}
            type="button"
            className={cx(s.chip, checkInInterval === m && s.chipOn)}
            aria-pressed={checkInInterval === m}
            onClick={() => {
              set({ checkInInterval: m });
              onClose();
            }}
          >
            {m} min
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function MeTab() {
  const status = useWorld((w) => w.world.chloe.status);
  const session = useWorld((w) => !!w.world.chloe.session);
  const { checkInInterval, logout, startOnboarding } = useUi();
  const [sheet, setSheet] = useState<'nok' | 'interval' | null>(null);
  return (
    <>
      <Header title="Your Profile" pill={<UserPill />} />
      <div className={s.scroll}>
        <section className={cx(ui.card, s.profile)}>
          <Avatar person={CHLOE} size={64} />
          <div>
            <p className={s.profileName}>{CHLOE.name}</p>
            <p className={ui.muted}>{CHLOE.phone}</p>
            <p className={s.statusLine} aria-live="polite">
              {status ? (
                <>
                  <MapPin size={14} aria-hidden style={{ verticalAlign: -2 }} /> Status: <strong style={{ color: 'var(--text)' }}>{status}</strong>
                </>
              ) : (
                '[Status] Tap a chip below to set a status'
              )}
            </p>
          </div>
        </section>

        <h2 className={s.sectionTitle}>Quick status</h2>
        <div className={s.chips} role="group" aria-label="Quick status, shown to your Night Buddies" data-onboarding="user-me">
          {QUICK.map((q) => (
            <button
              key={q.label}
              type="button"
              className={cx(s.chip, status === q.label && s.chipOn)}
              aria-pressed={status === q.label}
              onClick={() => dispatch((w) => setStatus(w, status === q.label ? null : q.label))}
            >
              {q.icon}
              {q.label}
            </button>
          ))}
        </div>

        <Button variant="safe" block onClick={() => dispatch(manualCheckIn)} disabled={!session}>
          <ShieldCheck size={20} /> Check in
        </Button>
        {!session && <p className={cx(ui.muted, ui.small)} style={{ marginTop: -8, textAlign: 'center' }}>Check-ins are available during a Night Out.</p>}

        <h2 className={s.sectionTitle}>Settings</h2>
        <div className={cx(ui.card, s.settings)}>
          <button type="button" className={s.setRow} onClick={() => setSheet('interval')}>
            <Timer size={20} aria-hidden />
            <span className={s.setLabel}>Check-in interval</span>
            <span className={s.setValue}>{checkInInterval} min</span>
            <ChevronRight size={18} aria-hidden />
          </button>
          <button type="button" className={s.setRow} onClick={() => setSheet('nok')}>
            <ShieldCheck size={20} aria-hidden />
            <span className={s.setLabel}>
              Next-of-Kin
              <span className={s.setSub}>
                {HELEN.name} · Mother · {HELEN.phone}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden />
          </button>
          <div className={s.setRow}>
            <Footprints size={20} aria-hidden />
            <span className={s.setLabel}>
              Share location
              <span className={s.setSub}>Only during Night Out sessions</span>
            </span>
            <span className={s.setValue} style={{ color: 'var(--safe)', fontWeight: 700 }}>
              Enabled
            </span>
          </div>
          <button type="button" className={s.setRow} onClick={startOnboarding}>
            <BookOpen size={20} aria-hidden />
            <span className={s.setLabel}>Replay onboarding</span>
            <ChevronRight size={18} aria-hidden />
          </button>
          <MotionSetting />
        </div>

        <Button variant="dangerOutline" block onClick={logout}>
          <LogOut size={18} /> Log out
        </Button>
      </div>
      {sheet === 'nok' && <NokSheet onClose={() => setSheet(null)} />}
      {sheet === 'interval' && <IntervalSheet onClose={() => setSheet(null)} />}
    </>
  );
}
