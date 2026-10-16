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

## Map tiles

The map uses CARTO Positron (DESIGN A11), which now needs a free key from [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/). Set `VITE_CARTO_API_KEY` to the key itself, not a URL, in `.env` and in Vercel. The key ships in the browser bundle, like the Supabase anon key.

- If no key is set, the map falls back to OpenStreetMap's standard tiles, greyed out with CSS.
- `VITE_MAP_TILE_URL` takes a full `{z}/{x}/{y}` template and overrides both.
