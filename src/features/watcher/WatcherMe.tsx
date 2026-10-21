import { BellRing, BookOpen, ChevronRight, LogOut, Moon, Plus, Users } from 'lucide-react';
import { Avatar, Button, Header, SessionPill, StatusPill, cx, ui } from '../../components/ui';
import { MotionSetting } from '../../components/MotionSetting';
import { HELEN } from '../../data/cast';
import { useNow, useUi, useWorld } from '../../store';
import userCss from '../user/user.module.css';
import { childView, linkedIds } from './children';
import s from './watcher.module.css';

/** Watcher profile: same layout as the User's Me tab, User-only parts removed (DESIGN §6.3). */
export function WatcherMe() {
  const now = useNow(2000);
  const w = useWorld((x) => x.world);
  const { extraChild, quietUpdates, set, logout, toast, startOnboarding } = useUi();
  const views = linkedIds(extraChild).map((id) => childView(id, w, now));
  const anyActive = views.some((v) => v.session);

  return (
    <>
      <Header title="Your Profile" pill={<SessionPill active={anyActive} label={anyActive ? 'Active: someone you look after is on a Night Out' : 'Inactive: nobody is out'} />} />
      <div className={userCss.scroll} style={{ paddingBottom: 24 }}>
        <section className={cx(ui.card, userCss.profile)}>
          <Avatar person={HELEN} size={64} />
          <div>
            <p className={userCss.profileName}>{HELEN.name}</p>
            <p className={ui.muted}>{HELEN.phone}</p>
            <span className={s.roleChip}>Watcher</span>
          </div>
        </section>

        <h2 className={userCss.sectionTitle}>Looking after</h2>
        <div className={cx(ui.card, userCss.settings)} data-onboarding="watcher-me">
          {views.map((v) => (
            <button
              key={v.person.id}
              type="button"
              className={s.lookRow}
              onClick={() => set({ watcherSelected: v.person.id, watcherTab: 'map' })}
            >
              <Avatar person={v.person} size={44} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700 }}>{v.person.name}</span>
                <span className={cx(ui.muted, ui.small)}>{v.relationship}</span>
              </span>
              {v.session ? (
                <StatusPill status={v.status} label={v.status === 'SAFE' ? `On a Night Out · ${v.session.venue}` : v.status} />
              ) : (
                <StatusPill status="OUT" />
              )}
              <ChevronRight size={18} aria-hidden />
            </button>
          ))}
          <button type="button" className={s.lookRow} onClick={() => toast('Not implemented in this prototype')}>
            <span className={ui.iconBtn} aria-hidden>
              <Plus size={20} />
            </span>
            <span style={{ flex: 1, fontWeight: 650, color: 'var(--brand-ink)' }}>Add</span>
          </button>
        </div>

        <h2 className={userCss.sectionTitle}>Settings</h2>
        <div className={cx(ui.card, userCss.settings)}>
          <button
            type="button"
            className={userCss.setRow}
            role="switch"
            aria-checked={quietUpdates}
            onClick={() => set({ quietUpdates: !quietUpdates })}
          >
            <Moon size={20} aria-hidden />
            <span className={userCss.setLabel}>
              Quiet Updates
              <span className={userCss.setSub}>Includes venue changes, heading home, arrivals. Session starts and emergencies are excluded, and will always alert you.</span>
            </span>
            <span className={userCss.setValue} style={{ fontWeight: 700, color: quietUpdates ? 'var(--safe)' : undefined }}>
              {quietUpdates ? 'On' : 'Off'}
            </span>
          </button>
          <div className={userCss.setRow}>
            <BellRing size={20} aria-hidden />
            <span className={userCss.setLabel}>
              Emergency Alerts
              <span className={userCss.setSub}>Always on, sounds even on silent</span>
            </span>
            <span className={userCss.setValue}>🔒 On</span>
          </div>
          <div className={userCss.setRow}>
            <Users size={20} aria-hidden />
            <span className={userCss.setLabel}>Linked Users</span>
            <span className={userCss.setValue}>{views.length}</span>
          </div>
          <button type="button" className={userCss.setRow} onClick={startOnboarding}>
            <BookOpen size={20} aria-hidden />
            <span className={userCss.setLabel}>Replay onboarding</span>
            <ChevronRight size={18} aria-hidden />
          </button>
          <MotionSetting />
        </div>

        <Button variant="dangerOutline" block onClick={logout}>
          <LogOut size={18} /> Log out
        </Button>
      </div>
    </>
  );
}
