import { useState, type FormEvent } from 'react';
import { ArrowLeft, Lock, Plus, Trash2, X } from 'lucide-react';
import { Avatar, Button, IconButton, Modal, cx, ui } from '../../components/ui';
import { CHLOE, CONTACTS, type Person } from '../../data/cast';
import { useUi } from '../../store';
import { unlockAudio } from '../../app/sound';
import s from './auth.module.css';

/** Role rule (A2): "helen" or "watcher" in the username (case-insensitive) opens Watcher, else User. */
export const roleForUsername = (u: string) => (/helen|watcher/i.test(u) ? 'watcher' : 'user');

function Brand() {
  return (
    <div className={s.brand}>
      <div aria-hidden>
        <img src='/icon.png' className={s.logo}></img>
      </div>
      <p className={s.tagline}>Socialize in peace. Parents at ease.</p>
    </div>
  );
}

function PhoneField({ id, value, onChange, label = 'Mobile number' }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className={ui.field}>
      <label className={ui.label} htmlFor={id}>
        {label}
      </label>
      <div className={s.phoneRow}>
        <span className={s.prefix}>+65</span>
        <input id={id} className={ui.input} inputMode="tel" autoComplete="tel-national" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, type = 'text', autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string }) {
  return (
    <div className={ui.field}>
      <label className={ui.label} htmlFor={id}>
        {label}
      </label>
      <input id={id} className={ui.input} type={type} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Enter ${label}`}  />
    </div>
  );
}

function Login() {
  const { set, login, toast } = useUi.getState();
  // Pre-filled with Chloe's details to speed up recording (DESIGN §4.1). Nothing typed here is sent anywhere.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    unlockAudio();
    login(roleForUsername(username));
  };
  return (
    <form className={cx(s.page, s.loginPage)} onSubmit={submit}>
      <Brand />
      <Field id="login-user" label="Username" value={username} onChange={setUsername} autoComplete="on" />
      <Field id="login-pass" label="Password" type="password" value={password} onChange={setPassword} autoComplete="on" />
      <div className={s.loginRow}>
        <label className={s.remember}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me
        </label>
        <Button variant="text" className={s.forgot} onClick={() => toast('Password reset isn’t part of this prototype')}>
          Forgot password?
        </Button>
      </div>
      <Button variant="primary" block type="submit">
        Login
      </Button>
      <div className={s.divider}>or</div>
      <Button variant="secondary" block onClick={() => set({ authScreen: 'signup' })}>
        Create account
      </Button>
    </form>
  );
}

const RELATIONSHIPS = ['Mother', 'Father', 'Parent', 'Sibling', 'Partner', 'Guardian', 'Friend', 'Other'];
const CHILD_REL = ['Daughter', 'Son', 'Child', 'Sibling', 'Partner', 'Friend', 'Other'];

interface Nok {
  name: string;
  phone: string;
  relationship: string;
}

function UserSignup({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [noks, setNoks] = useState<Nok[]>([{ name: '', phone: '', relationship: 'Mother' }]);
  const [error, setError] = useState('');
  const upd = (i: number, p: Partial<Nok>) => setNoks(noks.map((n, j) => (j === i ? { ...n, ...p } : n)));
  const submit = () => {
    // Decision 7: at least one Next-of-Kin with a phone number is required.
    if (!noks.some((n) => n.name.trim() && n.phone.replace(/\D/g, '').length >= 8)) {
      setError('Add at least one Next-of-Kin with an 8-digit phone number.');
      return;
    }
    onDone();
  };
  return (
    <>
      <Field id="su-name" label="Name" value={name} onChange={setName} autoComplete="name" />
      <PhoneField id="su-phone" label="Phone" value={phone} onChange={setPhone} />
      <Field id="su-pass" label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
      {noks.map((n, i) => (
        <div className={s.nokCard} key={i}>
          <div className={s.nokHead}>
            <span>Next-of-Kin {noks.length > 1 ? i + 1 : ''} *</span>
            {noks.length > 1 && (
              <IconButton label={`Remove Next-of-Kin ${i + 1}`} onClick={() => setNoks(noks.filter((_, j) => j !== i))}>
                <Trash2 size={18} />
              </IconButton>
            )}
          </div>
          <Field id={`nok-name-${i}`} label="Name" value={n.name} onChange={(v) => upd(i, { name: v })} />
          <PhoneField id={`nok-phone-${i}`} label="Phone" value={n.phone} onChange={(v) => upd(i, { phone: v })} />
          <div className={ui.field}>
            <label className={ui.label} htmlFor={`nok-rel-${i}`}>
              Relationship
            </label>
            <select id={`nok-rel-${i}`} className={s.select} value={n.relationship} onChange={(e) => upd(i, { relationship: e.target.value })}>
              {RELATIONSHIPS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <button type="button" className={s.addBtn} onClick={() => setNoks([...noks, { name: '', phone: '', relationship: 'Father' }])}>
        <Plus size={18} /> Add another Next-of-Kin
      </button>
      <p className={s.hint}>We'll link them by phone number. They'll get alerts through their SafeSip Watcher account.</p>
      <div className={s.privacy}>
        <Lock size={18} style={{ flex: 'none', marginTop: 2 }} />
        <span>Your Night Buddies and Next-of-Kin can see your live location only during an active Night Out session.</span>
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <Button variant="primary" block onClick={submit}>
        Create account
      </Button>
    </>
  );
}

const PICKABLE: Person[] = [CHLOE, ...CONTACTS.filter((c) => c.id !== 'sarah').slice(0, 4)];

function WatcherSignup({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [picked, setPicked] = useState<{ id: string; relationship: string }[]>([]);
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const person = (id: string) => PICKABLE.find((p) => p.id === id)!;
  return (
    <>
      <Field id="sw-name" label="Name" value={name} onChange={setName} autoComplete="name" />
      <PhoneField id="sw-phone" label="Phone" value={phone} onChange={setPhone} />
      <Field id="sw-pass" label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
      <div className={ui.field}>
        <span className={ui.label}>Watching over…</span>
        <div className={s.chips}>
          {picked.map((p) => (
            <div className={s.chip} key={p.id}>
              <Avatar person={person(p.id)} size={36} />
              <span style={{ flex: 1, fontWeight: 650 }}>{person(p.id).name}</span>
              <select
                aria-label={`Relationship to ${person(p.id).name}`}
                value={p.relationship}
                onChange={(e) => setPicked(picked.map((x) => (x.id === p.id ? { ...x, relationship: e.target.value } : x)))}
              >
                {CHILD_REL.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <IconButton label={`Remove ${person(p.id).name}`} onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}>
                <X size={18} />
              </IconButton>
            </div>
          ))}
          <button
            type="button"
            className={s.addBtn}
            onClick={() => {
              setDraft(picked.map((p) => p.id));
              setPicker(true);
            }}
          >
            <Plus size={18} /> Tap to add
          </button>
        </div>
      </div>
      <Button variant="primary" block onClick={onDone}>
        Create Account
      </Button>
      {picker && (
        <Modal title="Who are you looking after?" onClose={() => setPicker(false)}>
          <p className={cx(ui.muted, ui.small)} style={{ marginBottom: 8 }}>
            Pick one or more people from your contacts. They'll link to you when they add your number as Next-of-Kin.
          </p>
          {PICKABLE.map((p) => (
            <label key={p.id} className={s.pickRow}>
              <input
                type="checkbox"
                checked={draft.includes(p.id)}
                onChange={(e) => setDraft(e.target.checked ? [...draft, p.id] : draft.filter((d) => d !== p.id))}
              />
              <Avatar person={p} size={40} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 650 }}>{p.name}</span>
                <span className={cx(ui.muted, ui.small)}>{p.phone}</span>
              </span>
            </label>
          ))}
          <Button
            variant="primary"
            block
            style={{ marginTop: 16 }}
            onClick={() => {
              setPicked(draft.map((id) => picked.find((p) => p.id === id) ?? { id, relationship: id === 'chloe' ? 'Daughter' : 'Child' }));
              setPicker(false);
            }}
          >
            Add {draft.length || ''} {draft.length === 1 ? 'person' : 'people'}
          </Button>
        </Modal>
      )}
    </>
  );
}

function Signup() {
  const { set, login } = useUi.getState();
  const [tab, setTab] = useState<'user' | 'watcher'>('user');
  return (
    <div className={s.page}>
      <div className={s.top}>
        <IconButton label="Back to login" onClick={() => set({ authScreen: 'login' })}>
          <ArrowLeft size={22} />
        </IconButton>
        <h1 className={s.h1}>Create account</h1>
      </div>
      <div>
        <p className={ui.label} id="you-are" style={{ marginBottom: 8 }}>
          You are a…
        </p>
        <div className={s.tabs} role="tablist" aria-labelledby="you-are">
          {(['user', 'watcher'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={cx(s.tab, tab === t && s.tabOn)} onClick={() => setTab(t)}>
              {t === 'user' ? 'User' : 'Watcher'}
            </button>
          ))}
        </div>
        <p className={s.hint} style={{ marginTop: 8 }}>
          {tab === 'user'
            ? 'You go on nights out and share your location with Night Buddies.'
            : `You watch over someone and get alerts if they need help or go missing.`}
        </p>
      </div>
      {tab === 'user' ? <UserSignup onDone={() => login('user')} /> : <WatcherSignup onDone={() => login('watcher')} />}
    </div>
  );
}

export function Auth() {
  const screen = useUi((u) => u.authScreen);
  return screen === 'login' ? <Login /> : <Signup />;
}
