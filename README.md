# SafeSip

High-fidelity prototype of SafeSip (IDP Group Project). It walks through the Easy Scenario, "Chloe's Normal Night Out with Sarah", end to end on two phones: Chloe (User) and Helen (Watcher). The spec is `DESIGN.md` (v1.0).

## Run locally (method 1)

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # fare model + scenario/well-being rules
npm run build      # typecheck + production build to dist/
```

The camera needs HTTPS on a phone, so test the dual camera on a Vercel deploy, not on the LAN dev server.

## Logging in

Login accepts any credentials and is pre-filled with Chloe's details. A username containing `helen` or `watcher` opens the Watcher view. Everything else opens the User view.

## Running on two phones (method 2)

1. Vercel needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set (public anon key only, never `service_role`).
2. Open `https://<deploy>/?room=G3T3` on both phones. Log in as Chloe on one and as Helen on the other.
3. Add the page to the home screen on both phones so the browser bar is hidden.

Without the Supabase keys, the app still syncs between tabs in one desktop browser, and each phone can be driven separately with the Director.

## Demo Director (hidden)

To open it, triple-tap the status pill under any page title, or press `D` on desktop.

- **Next beat** advances B0–B10. While a ride is booked, it skips to the next ride stage instead.
- **Jump to beat** goes straight to any beat. User taps that were skipped are filled in with the scenario's defaults.
- **Fire check-in now** and **Reset scenario** are also in the Director.
- The Director can switch the role and set the room code.
- It has an optional demo second child, to show the Watcher's multi-child switcher.

Desktop keys: `→` next beat, `R` reset.

Deep links: `?role=user|watcher&beat=B6&room=G3T3`.

## Recording the full Easy Scenario

The scenario is 11 beats (B0–B10). The Director fires the events the app can't actually sense — the clock moving, Sarah walking off, the ride progressing — while **Chloe does the real taps herself**. On two phones, drive everything from **Chloe's** phone; Helen's reacts live over sync. Each row below is: advance with the Director, then the taps Chloe makes before the next advance.

Setup before recording:

1. Open the Director (triple-tap the status pill, or `D`) → **Reset scenario** so you start clean at B0.
2. On a two-phone recording, set the room code and roles first (Director → room code + role), or open each phone with `?room=G3T3` and log in as Chloe / Helen.
3. Keep the Director closed while filming — it never shows unless opened.

| Beat | Director does | Chloe taps (then record the result) |
|---|---|---|
| **B0** 9:00 PM | — (start state) | Idle Map, no session. |
| **B1** 9:00 PM | **Next beat** → B1 | On the Map, **Start Night Out** → set Zouk, Sarah, return 2:00 AM → confirm. Helen's map goes active. |
| **B2** 9:30 PM | **Next beat** → B2 | Chloe and Sarah arrive at Zouk, paired. Nothing to tap. |
| **B3** 11:00 PM | **Next beat** → B3 | **Edit Session** → change venue to **Chupitos** → save. A "Chupitos · new destination" flag appears; no venue prompt (she changed it herself). |
| **B4** 11:10 PM | **Next beat** → B4 | They walk to Chupitos. Go to **Drinks → Scan a drink** and log a Martini with the dual camera (back = drink, front = selfie). |
| **B5** 12:00 AM | **Next beat** → B5 | Sarah leaves for the restroom queue; her pin reads "Apart". Nothing to tap. |
| **B6** 12:30 AM | **Next beat** → B6 (or **Fire check-in now**) | 30 min apart triggers the well-being check-in. Tap **I'm Okay** — Chloe (and Sarah) go back to Safe. |
| **B7** 12:35 AM | **Next beat** → B7 | Sarah returns and is "with you" again. Nothing to tap. |
| **B8** 1:45 AM | **Next beat** → B8 | The "time to head home?" reminder appears. |
| **B9** 1:55 AM | **Next beat** → B9 | The ride is booked Chupitos → Yishun. **Next beat** now skips through the ride stages (finding a driver → found → arriving → on the trip); the car moves on both phones, ETA 2:30 AM, fare $31.95. |
| **B10** 2:30 AM | **Next beat** until "Arrived" | On "Have you reached home?", tap **Yes** → the night summary shows on Chloe, "arrived home safely" on Helen. |

Notes for a clean take:

- **SOS** (any point during a session): tap the red SOS button → slide to send. Helen gets the full-screen red alert with sound, then the call buttons appear. The call buttons really dial `tel:` — show them, don't tap them.
- **Need Help** on the B6 check-in goes straight into the same SOS flow, with no second confirmation.
- **Alternative to Next beat:** use **Jump to beat** to go straight to any beat; skipped taps are filled in with the scenario defaults. Use this to re-shoot one segment without replaying the whole night.
- **To demo the venue prompt** (the detection path, not used in the scripted scenario): during an active session use the Director's **Walk to another venue without editing** — the app then prompts Chloe to update her venue.
- **Sound on Helen's phone:** phones only allow web audio after one tap, so tap Helen's screen once after logging in, and check the silent switch.

## Map tiles

The map uses CARTO Positron (DESIGN A11), which now needs a free key from [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/). Set `VITE_CARTO_API_KEY` to the key itself, not a URL, in `.env` and in Vercel. The key ships in the browser bundle, like the Supabase anon key.

- If no key is set, the map falls back to OpenStreetMap's standard tiles, greyed out with CSS.
- `VITE_MAP_TILE_URL` takes a full `{z}/{x}/{y}` template and overrides both.
