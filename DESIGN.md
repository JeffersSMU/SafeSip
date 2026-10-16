# SafeSip — Mobile Prototype Design Doc

Team G3T3 · Project SafeSip · v1.0, ready for build (2026-10-16)

Sources: `docs\Iter1.1 Overview.xlsx` (problem/solution), `docs\Iter1.2 Empathy.docx` (interviews), `docs\Iter1.3 Requirements.docx` (personas, scenarios), `docs\Iter1.4 Prototype.docx` (inspirations, navigation diagram, paper prototype), `docs\Iter1.5 Heuristic Evaluation.docx` (usability fixes the team committed to). Where the paper prototype and the heuristic fixes disagree, this doc follows the **heuristic fixes** (they are the later decision). Where both disagree with the brief for this build, the **brief** wins and the deviation is called out.

---

## 1. Goal and scope

Build a clickable, high-fidelity web prototype of SafeSip that:

1. Walks **Scenario 1 (Easy): Chloe's Normal Night Out with Sarah** end to end, without dead ends, so it can be screen-recorded in one take.
2. Offers two post-login experiences: **User** (Chloe) and **Watcher** (Helen).
3. Is published at a public HTTPS URL for testing on real phones.

Out of scope: real backend, real auth, real location, image recognition, push notifications, lock-screen widgets, Scenario 2 (dead device / buddy fallback), heart-rate data. All data is hardcoded.

Deferred heuristic fixes (committed in `docs\Iter1.5`, not possible in a web prototype): persistent "tracking on" OS notification (D4/E5), lock-screen check-in shortcuts (D5), low-battery escalation (D1, part of Scenario 2), lock-screen drink logging (F5, already deferred by the team).

### 1.1 Cast (from `docs\Iter1.3 Requirements.docx`)

| Role | Person | Details used in the UI |
|---|---|---|
| User | Chloe Tan, 22, SMU Business student | +65 9234 1447, lives in Yishun |
| Night Buddy | Sarah Loh, classmate | in contacts, marked Favourite / Recent |
| Next-of-Kin / Watcher | Helen Lim, 51, mother | +65 9876 5432, relationship "Mother" |
| Other contacts | Alex Reed, Dave Williams, Travis Sock, Sam Torres, Cass Murphy | contacts only, never share location in the scenario |

The paper prototype used placeholder names (Cass Murphy, Alex Reed, Sam Torres); the prototype uses the scenario cast instead so the recording matches the narrative.

### 1.2 Scenario 1 beat sheet (the critical path)

| # | Sim time | Trigger | User (Chloe) sees | Watcher (Helen) sees |
|---|---|---|---|---|
| B0 | 9:00 PM | — | Map, **Inactive** | Map, inactive: "Chloe isn't on a Night Out" |
| B1 | 9:00 PM | Chloe taps *Start Session*: Zouk, return 2:00 AM, buddy Sarah | Map → **Active**; toast "Helen has been notified" | Silent update: "Chloe is heading to Zouk with Sarah · back ~2:00 AM"; map goes active |
| B2 | 9:30 PM | Auto (director) | Toast "Arrived at Zouk · paired with Sarah"; Sarah's pin next to Chloe's | Venue: Zouk · Well-Being SAFE (with Night Buddy) |
| B3 | 11:00 PM | Auto: location changes | Prompt "Looks like you've moved to **Chupitos**. Update your venue?" → Edit Session modal pre-filled → *Confirm Edits* | Silent update: "Venue changed to Chupitos"; trail extends |
| B4 | 11:10 PM | Chloe logs drink via dual camera | Scan → "Martini · ≈2 standard drinks" → logged; pace LOW | (no change; drinks are shared with buddies, not Watcher — see A9) |
| B5 | 12:00 AM | Auto: Sarah leaves (restroom queue) | Sarah's pin drifts away; Buddies tab "Apart · 40 m" | Still SAFE |
| B6 | 12:30 AM | Auto: apart 30 min | **Vibration + Well-Being Check-in modal** → Chloe taps *I'm Okay* | Stays SAFE (a pending check-in is never shown to the Watcher) |
| B7 | 12:35 AM | Auto: Sarah returns | Toast "Sarah is back with you" | SAFE |
| B8 | 1:45 AM | Auto: 15 min before return time | Notification "Almost 2:00 AM — time to head home?" → *Book a ride* | — |
| B9 | 1:55–2:30 AM | Ride flow (Grab-partnered) Chupitos → Yishun: booked 1:55, pickup 2:00, 30 min drive | Booking → matching → driver arriving → on trip, ETA 2:30 AM; toast "Session extended to 2:30 AM" | "Chloe is heading home · ETA 2:30 AM"; live car position |
| B10 | 2:30 AM | Auto: arrived home | **"Have you arrived home?"** → *Yes, I'm home* → session summary → Map Inactive | "Chloe arrived home safely · 2:31 AM"; map inactive |

User-driven beats (B1, B3 confirm, B4, B6 answer, B9 booking, B10 confirm) are real taps. Time-driven beats are fired by the **Demo Director** (§7).

---

## 2. Global design rules

### 2.1 Light mode
Light mode only, per the brief. Caveat for the team: in a dark club a light screen is bright and draws attention. We mitigate rather than switch: off-white page (not pure white), no large pure-white fills behind modals (dimmed scrim instead), and strong contrast so the UI stays readable when the user is tipsy.

### 2.2 Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F6F6FA` | page |
| `--surface` | `#FFFFFF` | cards, sheets, navbar |
| `--text` | `#14141F` | primary text (≥ 15:1 on bg) |
| `--text-muted` | `#5B5B6E` | secondary text (≥ 6:1) |
| `--brand` | `#5B3DF5` (violet) | primary buttons, active tab, own pin |
| `--safe` | `#15803D` | SAFE status, *I'm Okay* |
| `--warn` | `#B45309` | Apart, check-in pending (User side only) |
| `--danger` | `#DC2626` | SOS, *Need Help*, MISSING |
| `--ride` | `#00A651`-ish green | ride partner accent (no real Grab logo) |
| radius | 16 px cards, 999 px pills | |
| font | Inter (system fallback), base 17 px, titles 28 px | |

### 2.3 Interaction rules
- Tap targets ≥ 48 px; primary actions ≥ 56 px tall, full width, in the thumb zone.
- Status is never colour-only: every pill has a label and an icon. User side: SAFE / APART / MISSING / SOS. Watcher side: SAFE / MISSING / SOS only.
- Modals close with **X** (top-right); in-flow screens use **← Back** (heuristic G2, team decision: keep X for modals).
- "Night Buddy" / "Buddies" everywhere; the word "Crew" is gone (heuristic C5).
- All motion (SOS glow, active-session pulse, scanning sweep, car movement easing) respects `prefers-reduced-motion`: replaced by static states.
- Vibration via `navigator.vibrate()`. **iOS Safari does not support it**, so every vibration is paired with a visual shake + optional sound; recording on iPhone will show the visual cue only.

### 2.4 Device frame
- On phones: full screen (`100dvh`, safe-area insets respected), installable as a PWA so the browser chrome disappears during recording.
- On desktop: centred 390 × 844 phone frame with a fake status bar that shows **simulated time**, so desktop recordings show the scenario clock.
- On phones the real status bar shows real time, so the simulated time is also shown in-app (session card / header chip).

---

## 3. Information architecture

```
Login ──► (any credentials) ──► User Map  |  Watcher Map   (role rule: see A2)
  └─► Create Account ──► "You are a…"  [User | Watcher] tabs
          ├─ User: name, phone, password, Next-of-Kin (name, phone, relationship, +Add), privacy note
          └─ Watcher: name, phone, password, Looking after… (+ Tap to add, one or more users)

User shell:     [ Map | Buddies | Drinks | Me ]   + floating SOS (active session) + global overlays
Watcher shell:  [ Map | Me ]

Global overlays (User): Start Session modal, Edit Session modal, End Session modal,
  Venue-change prompt, Well-Being Check-in, SOS sheet, Ride flow (full-screen stack),
  Arrival confirmation, Session summary, toasts / in-app notification banners.
```

This matches the navigation diagram in `docs\Iter1.4 Prototype.docx`, with these changes: Crew → Buddies; SOS moved from the Profile tab to a floating button; *End Session* now confirms before routing to ride booking (heuristic E4).

---

## 4. Auth screens

### 4.1 Login (paper: "Login Page")
- Logo, "SafeSip", tagline "Peer Safety Network".
- Mobile number with `+65` prefix, hint "A one-time verification code will be sent via SMS" (copy kept; no OTP screen is shown).
- Username, Password, "Forgot password?" (inert, see A10).
- **Login** (primary) / divider "or" / **Create account** (secondary).
- Validation: fields may be anything, including empty → logs straight in. Pre-filled with Chloe's details to speed up recording.

### 4.2 Create account → "You are a…"
- Segmented tabs **User | Watcher** (paper used folder tabs; same idea, larger targets).
- **User tab:** Name, Phone, Password; Next-of-Kin card (**required**, at least one): Name, **Phone (+65)**, Relationship dropdown, *+ Add* for more. Helper text: "We'll link them by phone number. They'll get alerts through their SafeSip Watcher account." Privacy note under NoK: "Your Night Buddies and Next-of-Kin can see your live location only during an active Night Out session." (heuristic F1 compromise).
- **Linking rule:** a User's Next-of-Kin is linked to the Watcher account with the same phone number. That Watcher then sees the User under "Looking after". In the prototype the link is hardcoded (Chloe ↔ Helen), whatever is typed.
- **Watcher tab:** Name, Phone (+65), Password; "Looking after…" with *+ Tap to add* → contact picker (multi-select) → one chip per person (Chloe Tan, …), each with a relationship dropdown and a remove ×.
- **Create account** → that role's Map tab.

---

## 5. User role

### 5.1 Shell
- Bottom navbar: **Map · Buddies · Drinks · Me** (icons: pin, people, glass, person). Map is default. Every tab has a header title (heuristic G5).
- **Session status pill** in every header: `● Session Active – Tracking On` (green, soft glow) or `○ No active session` (grey) (heuristic D4/E5).
- **SOS button** (see 5.6) floats above the navbar, bottom-right, on every user screen while a session is active.

### 5.2 Map tab

**Inactive** (paper: "Map Tab Inactive: View Own Location & Battery Pin")
- Light map centred on Chloe (home, Yishun at B0). Own avatar pin with battery badge (e.g. 82 %).
- No other people on the map.
- Full-width **Start Night Out** button above the navbar.

**Start Session modal — "Tonight's Session"** (paper: "Session Setup" + "Select Night Buddies")
- *Target location / venue*: text field with hardcoded autocomplete (Zouk, Chupitos, Clarke Quay, Lavo, Marquee…) + "Select from map" link (inert) (heuristic G1).
- *Estimated return time*: clock icon → wheel time picker (heuristic G3). Default 2:00 AM.
- *Night Buddies*: search bar + tabs **Recent · Favourites · All contacts**, checkbox rows with avatars; Sarah Loh at top of Recent (heuristic A5/C4). Only contacts with SafeSip are listed (heuristic B5 note).
- *Notifying*: read-only row "Helen Lim (Mother) will get a silent update" so the NoK is visible (heuristic A1).
- **Let's go!** disabled until venue + time + ≥1 buddy. On submit: modal closes, map animates to Clarke Quay, status pill turns active, toast "Session started · Helen notified".

**Active** (paper: "Map Tab Active", "View Member Location and Battery Pins")
- Pins are avatars (photo or initial on a coloured disc) with a status ring (heuristic B1): Chloe + session buddies only.
- Legend card labelled **Legend**: ● Safe ● Apart ● Missing (heuristic C2 — it's a legend, not a button).
- Tap a pin → bottom sheet: name, status, last update, venue, distance, battery, *Call* / *Message* (inert dial/SMS links).
- Session card above the buttons: venue, "Back by 2:00 AM", elapsed time, simulated clock.
- Two buttons: **Edit Session** · **End Session**.

**Edit Session modal**
- Same fields as Start (venue, return time, buddies), pre-filled. **Confirm Edits** primary; X to discard.
- On confirm: toast "Session updated · Helen notified of venue change".
- Entry points: *Edit Session* button, or the B3 venue-change prompt (heuristic B3: "Looks like you've moved to Chupitos. Update venue?" → *Update* opens Edit pre-filled with Chupitos / *Not now*).

**End Session modal** (heuristic E4)
- Title "End your Night Out?" · body "We'll let Helen know. Need a safe ride home?"
- **Book a SafeSip ride** (primary → Ride flow, session stays active until arrival) · **Arrange my own ride** (session stays active, toast "We'll keep tracking until you're home") · **End session now** (text button; ends immediately, sends "Session ended" to Helen) · X.

### 5.3 Buddies tab (renamed from "Crew")
Header "Buddies", subtitle e.g. "Tonight · Wed, 16 Oct".

**Section 1 — In your session** (only exists while active)
- Summary strip: `1 Safe · 0 Apart · 0 Missing`.
- Row per buddy: avatar, name, status pill, "With you" / "Apart · 40 m", venue, last update ("2 min ago"), battery, latest status text (from their Quick Status), live-location icon.
- Tap → same detail sheet as the map pin.

**Section 2 — Contacts**
- Plain list of other SafeSip contacts: avatar, name, *Invite to session* (only while active; opens Edit Session with that contact ticked).
- Explicit note: "🔒 Location is only shared with people in an active session with you." No location, battery or status shown for contacts.

When inactive, Section 1 is replaced by an empty state "Start a Night Out to share live location with your Night Buddies."

### 5.4 Drinks tab
Header "Drinks", subtitle "Log what you're drinking. Shared with your Night Buddies."

- **Your totals** card: drinks count · standard drinks · **Pace** (LOW / MED / HIGH) with an ⓘ that explains: "Standard drinks per hour this session. LOW < 1, MED 1–2, HIGH > 2. At HIGH, consider water and slowing down." (heuristic B4).
- **Scan a drink** — large primary card with a camera icon ("Snap your drink, we'll log it").
- **Add manually** — grid of buttons with a "+" and icon (heuristic E1): Beer, Wine, Shot, Cocktail, Cider, Water, **Other** (heuristic C3: name + size + strength sheet). Each preset has a hardcoded standard-drink value (Beer 330 ml ≈1.3, Wine 150 ml ≈1.5, Shot ≈1, Cocktail ≈1.5, Cider ≈1.3, Water 0).
- **Your log**: time-stamped entries, newest first, swipe/long-press → Undo.
- **Buddy drinks**: Sarah Loh · 2 drinks · LOW (hardcoded, updates at B5 to 3).
- When no session is active, logging still works but nothing is shared (note under the header).

**Dual-camera capture (BeReal-style) — real photos from both cameras**

Platform constraint: Safari on iOS allows only one active camera at a time, and most Android phones can't open front and back together either. Only a few Android devices allow two concurrent `getUserMedia` streams. So the capture uses two modes, picked at runtime:

- **Mode A: Quick-flip (default; every iPhone and most Android phones).**
  1. Full-screen rear preview (`facingMode: { ideal: 'environment' }`, `playsinline`, muted), shutter button, hint "Point at your drink". While it's open, the front-camera `deviceId` is resolved from `enumerateDevices()` so the flip needs no lookup.
  2. Shutter → grab the rear frame to a canvas (`ImageCapture.takePhoto()` where supported, else `drawImage` from the video) → **stop the rear track** → immediately `getUserMedia` the front camera.
  3. The frozen drink photo fills the screen while the front preview appears live as the rounded inset (top-left). A 3-2-1 "Now you!" countdown runs, then the front frame is captured (mirrored for display, as BeReal does).
  4. The flip typically takes 0.3–1 s. A flash/flip transition covers the gap, so it feels like one action.
- **Mode B: Simultaneous (progressive enhancement, Android only where the device allows it).**
  - On opening the camera, try to open the front stream while the rear stream is still live. If both tracks stay `readyState === 'live'` and both videos produce frames within 1 s, show **both live previews at once** (rear full-screen, front inset) and capture both from one shutter press.
  - If the second stream fails, or ends the first track, drop silently to Mode A. The result is cached in `localStorage` so the probe runs once per device.
- Both modes end in the same photo pair (drink + selfie). The stock-photo fallback is used **only** when permission is denied or no camera exists, e.g. on desktop.
- Requires HTTPS and a user gesture to start (the "Scan a drink" tap provides both). iOS needs `playsinline` or it opens the system fullscreen player.
- Streams are always stopped on capture, cancel, tab switch (`visibilitychange`) and unmount, so the camera indicator never stays on.
- True simultaneous dual preview on iPhone needs a native app (`AVCaptureMultiCamSession`, iPhone XS or newer) and can't be hosted as a web link. See A13.

3. **Scanning animation** over the drink photo: a horizontal light sweep + corner brackets + "Identifying your drink…" (~2 s; static spinner under reduced motion).
4. Result card: "🍸 **Martini** · 90 ml · ~30 % ABV · ≈2 standard drinks" with **Log it** / *Not right? Pick manually*.
5. Log it → back to Drinks, entry "Martini · 11:10 PM" with the photo pair thumbnail; totals update.
- Always returns Martini; no recognition code.
- Fallback when the camera is denied, unavailable, or on desktop: the same flow with two bundled stock photos (a martini, a selfie placeholder), so the recording never breaks.
- Camera requires HTTPS, which the hosted build provides.

### 5.5 Me tab (paper: "Profile Tab", "Manual Check-in & Status Tags", "Set Check-In Intervals")
- Profile card: avatar, **Chloe Tan**, +65 9234 1447, current status line "[Status] Tap to set a status".
- **Quick status** chips: Bar · Food · Ride · **Restroom** · Home · Dance (sets the status line, shown to buddies). "Help" from the paper prototype is replaced by **Restroom** so it can't be mistaken for SOS. Restroom also explains the most common short separation, as in the scenario.
- **Check in** button → toast "Check-in sent to your Night Buddies & Helen" (resets the well-being timer).
- **Settings**: Check-in interval (30 min, picker 15/30/45/60) · **Next-of-Kin** (list: Helen Lim, Mother, +65 9876 5432 — view/edit/add, heuristic A1) · Share location (Enabled, "only during sessions"). The paper's "Emergency contacts" row is removed: SOS recipients are always the session's Night Buddies + Next-of-Kin.
- **Log out** → Login.
- The paper's "SOS Emergency" row is removed; SOS is the floating button.

### 5.6 SOS (persistent)
- **Button:** 64 px red circle, "SOS" label + phone icon, soft pulsing red glow, bottom-right above the navbar, `aria-label="SOS emergency"`. Shown on **every User screen while a session is active**, including full-screen flows (ride, camera, modals sit beneath it). Never shown on login / sign-up, and hidden when no session is active.
- **Tap → SOS sheet:**
  - Title "Emergency SOS", body "This sends an urgent alert with your live location to your Night Buddies and Next-of-Kin."
  - Recipients list: every Night Buddy in the active session (Sarah Loh) + Next-of-Kin (Helen Lim).
  - **Slide to send SOS** (red slide-to-confirm track). Keyboard/assistive alternative: focus the handle and hold Enter/Space for 1.5 s.
  - "Never mind, I'm okay" text button closes it.
- **Step 1, alert (automatic, right after the slide):** a **non-silent** alert goes to every session Night Buddy and the Next-of-Kin. It's a loud, critical-style notification that sounds even if their phone is on silent, unlike the quiet session updates. It carries Chloe's live location and venue. The screen shows per-recipient progress ("Alerting Sarah… ✓ Sarah alerted", "✓ Helen alerted"), then moves on automatically.
- **Step 2, "Who do you want to call?"** (keeps the paper prototype's "Who do you prefer to call?" screen):
  - **Call Police · 999** (red, `tel:999`)
  - **Call Helen Lim · Mother** (`tel:` her number)
  - **Call Sarah Loh · Night Buddy** (`tel:`; one row per session buddy)
  - All three are full-width, ≥ 56 px. Under them: "Alerts sent · Sharing live location" status and **I'm safe now**, which cancels the alert and sends a "Chloe is safe" follow-up, also non-silent (heuristic D2 recovery). Closing with X keeps the alert active.
- In the prototype, the alert is simulated: on Helen's phone (synced, §7.1) she gets a full-screen red alert banner with sound. The `tel:` links really dial, so for recording, show the call sheet without tapping.
- Watcher's Well-Being becomes **SOS** → emergency buttons appear (§6.2).

### 5.7 Well-being check-in
**Trigger:** session active AND Chloe has been apart from every Night Buddy (or alone) for 30 continuous minutes; repeats every 30 min while still apart. Never fires while paired. In the prototype the Director fires it at B6.

**Modal** (paper: "Automated Well-Being Check-in"; heuristic C1, D2, E3, F2)
- Vibrate (`[400,200,400]`) + shake on open.
- Title "Well-Being Check-in", body "You've been away from Sarah for 30 minutes. How are you doing?"
- **60 s countdown ring** (heuristic D2 decision, replacing the paper's 30 s).
- **I'm Okay** — green, full-width, one tap, no confirmation → toast "Thanks! Sarah & Helen won't be bothered." Watcher stays SAFE.
- **Slide for Need Help** — red slide-to-confirm. Completing it goes straight into SOS **Step 1 (non-silent alert) → Step 2 (call 999 / Helen / Sarah)**, with no second slide or confirmation.
- Not dismissable by tapping the scrim; no X (deliberate, heuristic E3).
- Escalation if ignored (off the critical path, but implemented): at 30 s a second vibration + warning "Sarah and Helen will be notified in 30 s"; at 60 s Night Buddies are alerted (Sarah sees Chloe as MISSING; Helen still sees SAFE) and a new 60 s timer starts; at 120 s Helen gets a non-silent alert and the Watcher shows MISSING. Answering *I'm Okay* at any point sends a "Chloe is safe" follow-up.

### 5.8 Ride hailing (Grab-partnered)
Entry: B8 reminder notification, End Session → *Book a SafeSip ride*, or a "Get home" shortcut on the map session card. Full-screen stack with ← Back. Follows Grab's layout conventions (heuristic E2) without using Grab's logo. Chloe rides **alone** (single drop-off). Sarah gets her own reminder and makes her own arrangements.

Amenities act as **both a driver filter and priced add-ons**: ticked items limit matching to drivers who carry them and add their price to the fare.

1. **Get Home Safely** — map with route **Chupitos (Clarke Quay) → Home, Yishun**, pickup/drop-off pins, distance (~22 km) and drive time (~30 min).
   - "Care amenities" with checkboxes (heuristic A3): ☑ Sickness bags +$1.00 · ☑ Seat cover +$1.50 · ☑ Bottled water +$0.50. Drivers shown are filtered to those offering every ticked amenity ("12 drivers nearby offer all 3").
   - **Fare estimate** is computed, not fixed, and updates live as amenities are ticked. It's an upfront fare like Grab's, with a "Fare details" sheet showing the breakdown:

     ```
     metered  = base $2.50 + $0.50 × km + $0.16 × min        (entry-level private-hire rates)
     fare     = metered × timeBand + platform fee $1.20 + Σ amenities
     timeBand = ×1.50  00:00–05:59 (late night)
                ×1.25  06:00–09:29 Mon–Fri, 18:00–23:59 daily (peak)
                ×1.00  otherwise
     minutes  = route km ÷ band speed  (late night 45 km/h, peak 30 km/h, else 38 km/h)
     ```
     The time bands follow LTA's taxi peak / late-night surcharge periods. The per-km and per-minute rates and the $1.20 platform fee come from public reports of Grab's Singapore pricing. Grab's real pricing is dynamic and unpublished, so this is a realistic estimate, not Grab's formula.
   - **Scenario value** (booked 1:55 AM, 22.4 km, 30 min): $2.50 + $11.20 + $4.80 = $18.50 × 1.5 = $27.75 + $1.20 = $28.95 + amenities $3.00 = **$31.95**. Unticking all amenities shows $28.95. If the Director jumps to a pre-midnight ride (e.g. 11:30 PM), the same route prices at the ×1.25 band.
   - The ETA uses the same `minutes` value, so the displayed fare, trip time and the "Session extended to 2:30 AM" toast always agree.
   - Payment row "Visa •••• 4321 ›" (heuristic A4; tap → sheet with Visa / GrabPay / Cash, inert).
   - **Book SafeSip Ride** primary · **Arrange my own ride** secondary (renamed from "Go Home Yourself", heuristic F3).
2. **Finding your driver…** — radar animation, amenity chips, **Cancel** (~3 s, simulated).
3. **Driver found** — driver card: Ahmad R. ★4.9, Toyota Prius · SMB1234X, amenity badges ✓ bags ✓ cover ✓ water, "Arriving in 5 min", *Call* / *Message*, **Cancel booking** (free cancellation for 2 min, heuristic A2 → confirm sheet → back to step 1).
   - Toast: "Session extended to 2:30 AM to match your ride · Helen notified."
4. **Driver arriving** — car icon moves along a short path to the pickup; ETA counts down.
5. **On your trip** — car moves along the route to Yishun; header "Arriving home ~2:30 AM"; *Share trip* (inert), SOS stays available.
6. **Arrived** → **Arrival confirmation** (heuristic B2): "Have you arrived home?" **Yes, I'm home** / **Not yet, still out** (keeps session active). *Yes* → session summary (duration 9:00 PM–2:31 AM, venues Zouk → Chupitos, drinks 1, check-ins 1/1 answered) → **Done** → Map Inactive; Helen gets "Arrived home safely".

Ride progress is time-compressed (whole ride ≈ 60–90 s on screen) and can be skipped forward by the Director.

### 5.9 In-app notifications and toasts
- Toasts (top, 3 s, `role="status"`) for passive confirmations.
- Banners styled like iOS notifications for "system" events (B8 reminder, venue prompt) so the recording reads as push notifications.

---

## 6. Watcher role (Helen)

### 6.1 Shell
Bottom navbar: **Map · Me**. Map is default. No SOS button (Watcher isn't on a night out).

### 6.2 Map tab
A Watcher can look after **several users** (e.g. more than one child). The Map is built around a **child switcher**:

- **Switcher row** under the header: one avatar chip per linked user, each with a name and status dot (Safe / Missing / SOS / Not out). Tapping a chip selects that child. With 1 child the row is hidden; with 4+ it scrolls horizontally.
- The map and card below always show **one child at a time**: the selected one.
- **Priority rule:** if any child's Well-Being becomes MISSING or SOS, their chip turns red, pulses and moves to the front. The map auto-selects them, and a banner "Chloe needs attention" appears above the switcher even when another child is selected.
- Default selection on opening: a child in emergency → else a child with an active session → else the first child.
- **Updates** list is per child, with a child filter ("All · Chloe · …").

**Selected child inactive**
- Map without that child's location (privacy rule: no session, no location).
- Card: "Chloe isn't on a Night Out right now. You'll get a quiet update when she starts one." + last session summary line.

**Selected child active** (paper: "Track Active Session & Map")
- Map shows **only Chloe**: avatar pin + **60-minute trail** (dashed polyline, fading by age), label chip "60-minute trail". Buddies are not drawn.
- **Current session** card:
  - Duration: 9:00 PM – 2:00 AM (est.) — updates to 2:30 AM after the ride booking.
  - Venue: Zouk → Chupitos (current venue bold).
  - Night Buddies: Sarah Loh.
  - Well-Being: the Watcher only ever sees **three states**, each with a reason line:
    - **SAFE**: "With her Night Buddy" · "Answered check-in 12:30 AM" · "In a SafeSip ride · ETA 2:30 AM". Apart, check-in pending, and buddy-level escalation all still show as SAFE to Helen.
    - **MISSING**: "Unresponsive to last well-being check". Only after the check-in has escalated to her (§5.7, at 120 s).
    - **SOS**: "Chloe asked for help 12:31 AM".
- When Well-Being is **MISSING or SOS**: show **Emergency Call** (confirm sheet → `tel:999`, Police) and **Contact Night Buddy** (sheet: Call / Message, one row per session buddy) as two large stacked buttons, red and outlined respectively.
- **Updates** list under the card: the silent notifications from the scenario, newest first ("Venue changed to Chupitos · 11:02 PM").
- During the ride: the trail continues along the route and a car icon replaces the pin.

### 6.3 Me tab
Same layout, components and order as the User's Me tab (§5.5), with User-only parts removed or swapped:

| User Me (§5.5) | Watcher Me | Why |
|---|---|---|
| Header "Your Profile" | same | |
| Profile card: avatar, name, phone, status line | avatar, **Helen Lim**, +65 9876 5432, role chip "Watcher". **No status line** | Helen isn't on a night out, so a status means nothing to anyone |
| **Quick status** chip grid | **Looking after** list in the same slot: one row per linked user (avatar, name, relationship, live state chip "On a Night Out · Chupitos" / "Not out"), tap → opens Map with that child selected; *+ Add* at the end | replaces the user's own status with the people she watches |
| **Check in** button | removed | Watchers aren't checked on |
| ~~SOS~~ (already removed) | — | |
| **Settings** rows | same row style: **Quiet updates** On (session start, venue change, heading home, arrived) · **Emergency alerts** "Always on, sounds even on silent" (locked) · **Linked users** (count) | Helen's need to sleep unless something is wrong |
| Check-in interval, Next-of-Kin, Share location | removed | User-only settings |
| **Log out** | same | |

---

## 7. Demo Director (prototype-only)

Needed because the scenario spans 5½ hours and depends on events no prototype can sense (arrival, separation, home).

- **Simulated clock** in app state, starting 9:00 PM Wed. Shown in the desktop frame status bar and in-app chips.
- **Hidden trigger:** triple-tap the header status pill (or press `D` on desktop) opens a small sheet: current beat, **Next beat ▶**, beat list to jump to (B0–B10), *Fire check-in now*, *Reset scenario*, role switch.
- **Keyboard shortcuts** for desktop recording: `→` next beat, `R` reset.
- **Deep links** for testing: `?role=user|watcher&beat=B6`.
- Advancing a beat applies its scripted state (time, positions, notifications) but never performs the user's own taps; if a user-driven step was skipped, the Director auto-applies its default (e.g. starts the session with Zouk/Sarah/2:00 AM) so any beat can be reached directly.
- The trigger is invisible in recordings.

### 7.1 Shared state between the two roles
- Single state store keyed **per user**: `users[id] = { session, position, trail, wellbeing, drinks, ride, updates }`, plus global `simTime`. Persisted to `localStorage`. The Watcher reads every user linked to her. Only Chloe is driven by the scenario; other children are static data.
- **Recording is on two phones** (Chloe's and Helen's), so state has to sync **across devices**. `BroadcastChannel` only syncs tabs in one browser, so it's kept for desktop testing only.
- **Decided:** **Supabase Realtime Broadcast** (free tier) as a hosted pub/sub channel, with **no server code and no database tables**. Both phones join a room by code (e.g. `?room=G3T3`); Chloe's phone is the source of truth and broadcasts every state change; Helen's phone renders it. On reconnect, the Watcher asks for a full snapshot.
- Offline fallback: if the channel is unreachable, each phone can follow the Director independently.

---

## 8. Hardcoded data

| Item | Value |
|---|---|
| Home (Yishun) | ~1.4295, 103.8350 |
| Zouk (3C River Valley Rd) | ~1.2906, 103.8462 |
| Chupitos (Clarke Quay) | ~1.2907, 103.8468 |
| Route Chupitos → Yishun | pre-computed polyline (one-off OSRM export, stored as JSON) |
| Chloe 60-min trail | generated points along the walk Zouk → Chupitos + jitter inside the venue |
| Sarah at B5 | moves ~40 m to a restroom point, back at B7 |
| Battery | Chloe 82 % → 61 % by 2:30 AM; Sarah 74 % |
| Ride | driver Ahmad R., Toyota Prius SMB1234X; 22.4 km; fare computed (§5.8), $31.95 in the scenario; pickup 2:00, ETA 2:30 AM |
| Martini | 90 ml, ~30 % ABV, ≈2 standard drinks |

---

## 9. Technical design

- **Stack:** Vite + React + TypeScript, CSS Modules with the tokens above, Zustand for the shared store, Leaflet with CARTO **Positron** light tiles for real Singapore streets. No API keys.
- **Navigation:** in-app state machine (role → tab → overlay stack), not URL routes, so static hosting needs no rewrite rules; query params only for deep links.
- **Reusable components:** `SlideToConfirm` (SOS + Need Help), `StatusPill`, `AvatarPin`, `BottomSheet`, `Modal`, `Toast`, `TimeWheel`, `CountdownRing`, `DualCamera`, `PhoneFrame`.
- **Hosting:** **Vercel**, connected to this GitHub repo. `main` deploys the recording build; every other branch/PR gets its own preview URL. HTTPS by default (needed for camera access). No base-path or SPA rewrite config is needed.
- **Realtime sync:** `@supabase/supabase-js` Broadcast channel `safesip:<room>`. The Supabase URL and anon key are injected as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` Vercel env vars. They're public by design, and the room is unauthenticated, which is acceptable because all data is fake. Missing env vars → app runs Director-only.
- **PWA:** web manifest + light theme colour so "Add to Home Screen" gives a full-screen app for phone recordings.
- **Accessibility:** WCAG AA contrast, visible focus rings, `aria-live` for toasts and status changes, keyboard path for both slide-to-confirm controls, reduced-motion fallbacks.
- **Network calls:** only map tiles, fonts and the Supabase broadcast channel. The app works with any credentials, and nothing typed into login/sign-up is sent anywhere.

Proposed structure:
```
src/
  app/            App.tsx, PhoneFrame, router state
  store/          session store, director beats, broadcast sync
  data/           cast, venues, routes, trail, drinks presets
  components/     SlideToConfirm, StatusPill, BottomSheet, Modal, Toast, ...
  features/
    auth/         Login, CreateAccount
    user/         MapTab, BuddiesTab, DrinksTab, MeTab, SessionModals, CheckIn, Sos, Ride/, DualCamera
    watcher/      WatcherMap, WatcherMe
  styles/         tokens.css, global.css
public/           manifest, stock drink/selfie photos, icons
```

---

## 10. Assumptions (all confirmed)

- **A1. Scenario timing — ✅ confirmed.** Check-in fires at 12:30 AM (30 min after Sarah leaves at 12:00) and Sarah rejoins at 12:35. The requirements say "around midnight… for a while", so I've applied the 30-minute rule literally.
- **A2. Role on login — ✅ confirmed.** Login opens **User** by default; a username containing "helen" or "watcher" (case-insensitive) opens **Watcher**. The Director can also switch role. Sign-up uses the chosen tab.
- **A3. SOS visibility — ✅ confirmed.** Persistent on every User screen during an active session; never on login/sign-up; hidden when inactive.
- **A4. SOS recipients — ✅ confirmed.** A non-silent alert to all session Night Buddies + Next-of-Kin first, then a choice to call Police 999, Helen or Sarah (§5.6). Need Help on a check-in uses the same flow.
- **A5. Check-in countdown — ✅ confirmed.** I added the team's heuristic-fix behaviour (60 s window, escalation to buddies then NoK). The brief only mentions vibration, *I'm Okay* and slide-to-Need-Help.
- **A6. Watcher Me page — ✅ confirmed.** Mirrors the User profile layout, minus User-only parts (§6.3).
- **A7. Ride pricing — ✅ confirmed.** Computed from distance and time band (§5.8). Amenity prices ($1.00 / $1.50 / $0.50) and driver details are invented.
- **A8. Branding — ✅ confirmed.** "SafeSip Ride · in partnership with Grab" with a generic green accent, no Grab logo or trademarked UI.
- **A9. Watcher scope — ✅ confirmed.** Watchers don't see drinks, matching "drinks shared with your Night Buddies" and Chloe's privacy goal. Helen sees well-being, not consumption.
- **A10. Inert elements.** Forgot password, OTP, Select from map, payment change, Share trip, Call/Message use toasts or native `tel:`/`sms:` links rather than real flows.
- **A11. Map tiles.** Real street map (Leaflet + CARTO Positron) rather than an illustrated map, so the Chupitos → Yishun ride looks real. Free tiles are fine for testing and recording, but need attribution and aren't for heavy traffic.
- **A13. Dual camera stays web-based.** Quick-flip on iPhone; simultaneous where Android allows it. Simultaneous capture on iPhone would mean a native build (Swift or an Expo dev build with a custom multi-cam module), shipped via TestFlight/APK instead of a public link. That cuts against the "publish online for easy testing" goal, so it isn't planned.
- **A14. Multiple watched users — ✅ confirmed.** A Watcher can link to many users (§6.2 switcher, §6.3 list), but the prototype data has **Chloe as Helen's only child**, matching the persona. With one child the switcher row is hidden, so the design scales without changing the recording.
- **A12. Scenario 2** (dead battery, buddy-verification) isn't built, though the store doesn't prevent adding it later.

## 11. Decisions log

- Stack: Vite + React + TypeScript installable web app (PWA). Expo was considered and rejected: its only gain is iPhone vibration, which was accepted as missing, and it makes testing harder.
- Deployment: Vercel (preview URL per branch). Chosen over GitHub Pages.
- Two-phone recording: Supabase Realtime Broadcast sync with a room code; Director as offline fallback.
- Branding: placeholder logo and violet `#5B3DF5` until the team supplies assets.

**Setup the team must do (needs your accounts):** create a free Supabase project and a Vercel project linked to this repo, then add the two `VITE_SUPABASE_*` env vars in Vercel.
