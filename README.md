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

| Director Beat | What to do (User: Chloe) |
|---|---|
| **B0** 9:00 PM | Starting Point |
| **B1** 9:00 PM | On the Map, click **Start Night Out** → set **Zouk** as location, return at **2:00 AM the following day** then click **Done**, and select **Sarah** as Night Buddy → click **Let's Go!** Pause recording, and use the **Director to proceed to B2**. |
| **B2** 9:30 PM | Chloe and Sarah arrive at Zouk. Nothing to tap. Use the **Director to proceed to B3**. |
| **B3** 11:00 PM | Click **Edit Session** and change venue to **Chupitos**, then click **Confirm Edits**. A "Chupitos · new destination" flag appears. Use the **Director to proceed to B4**. |
| **B4** 11:10 PM | Chloe and Sarah walk to Chupitos. Navigate to the **Drinks** tab, and click **Scan a Drink** to use the dual-camera feature. Point at the Martini to log it, alongside a selfie (like BeReal). It should automatically detect a Martini, click **Log it**. Return back to the Map screen. Use the **Director to proceed to B5**. |
| **B5** 12:00 AM | Sarah leaves for the restroom queue, her pin now updates to "Apart". Nothing to tap. Use the **Director to proceed to B6**. |
| **B6** 12:30 AM | Long queues at toilet causes them to be 30 min apart, triggering the well-being check-in. Click **I'm Okay**, and Chloe's status updates to "Safe" (assumes that Sarah also received the check-in and clicked 'I'm Okay'). Use the **Director to proceed to B7**. |
| **B7** 12:35 AM | Sarah returns and is connected back with Chloe again. Nothing to tap. Use the **Director to proceed to B8**. |
| **B8** 1:45 AM | The "time to head home?" reminder appears. Click on **"Book a Ride"**, then click **"Book Ride"** to book a Grab ride back home. |
| **B9** 1:55 AM | The ride is booked from Chupitos to Yishun. The Director can be used to skip certain phases of the ride back home (i.e. **finding a driver → found → arriving pick-up point → on the way home**). |
| **B10** 2:30 AM | Recieve an automated "Have you reached home?" as app detects Chloe has reached home. Click **Yes, I'm home**, and the night's recap is displayed. Click on **"Done"** to return back to the Map screen (inactive session) |

The Watcher's device (Helen) should also update and receive real-time alerts/notifications that can be recorded and edited in during recording. Specifically, the Watcher will be notified on Session start, silently notified when Chloe arrives at Zouk, when venue was changed to Chupitos, when Chloe booked a Grab ride back, and when Chloe arrived home safely.

*In the event of an emergency/SOS, the Watcher's device will also be alerted (but not in scope for Easy scenario)*

## Map tiles

The map uses CARTO Positron (DESIGN A11), which now needs a free key from [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/). Set `VITE_CARTO_API_KEY` to the key itself, not a URL, in `.env` and in Vercel. The key ships in the browser bundle, like the Supabase anon key.

- If no key is set, the map falls back to OpenStreetMap's standard tiles, greyed out with CSS.
- `VITE_MAP_TILE_URL` takes a full `{z}/{x}/{y}` template and overrides both.
