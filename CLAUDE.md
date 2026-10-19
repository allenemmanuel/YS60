# YS60 – Project notes & progress

Lucky-draw web app for **Malam Sambutan Ulang Tahun 60 Yayasan Sabah** (YS60).
This file is the hand-off point between sessions and machines: read it first, and update the **Progress log** and **Open items** at the end of each session.

---

## Ground rules

- **Work only on YS60.**
  - Repo: https://github.com/allenemmanuel/YS60 (the only git remote, `origin`)
  - Live site: **https://ys60.web.app**
- **Never touch the old MAKYS project.** That means the `allenemmanuel/MAKYS` repo, `allenemmanuel.github.io/MAKYS`, and the `makysdraw-87237` Firebase project. This app was copied from MAKYS but is now fully separate. Don't push to MAKYS, link to it, or reuse its Firebase config.
- Hosting is **Firebase Hosting**, not GitHub Pages. Pushing to GitHub does **not** deploy the site.
- **Keep this file current without being asked.** Sessions can end without warning, so whenever a piece of work is finished (and always before a commit/push or deploy), update the **Progress log** (dated, with machine) and **Open items** below and include CLAUDE.md in the same commit. Don't wait for the user to request it.

---

## Infrastructure

| What | Value |
|---|---|
| Firebase project | `ys60-d283a` (console: https://console.firebase.google.com/project/ys60-d283a/overview) |
| Hosting site | `ys60` → https://ys60.web.app (also `ys60.firebaseapp.com`) |
| Realtime Database | https://ys60-d283a-default-rtdb.firebaseio.com (US region) |
| DB rules | `database.rules.json` (deploy: `firebase deploy --only database --project ys60-d283a`). `drawResults/` stays open for the old pages until cutover. `events/` is staff-only, except `events/{id}/public/`, which anyone can read. Staff = signed in **and** `staff/{uid}: true`. Deployed 2026-10-20. |
| Staff accounts | Firebase Auth Email/Password. Add someone: create the user in the console, then `firebase database:set /staff/<uid> --data true --project ys60-d283a`. The rules allow nobody to write `staff/`, so this works only through the console/CLI. |
| Hosting config | `firebase.json` (site `ys60`) + `.firebaserc` (project `ys60-d283a`) |

Every page uses the Firebase JS SDK compat build via `<script>` tags (v9.21.0; `Scanner01.html` uses v8.10.0). Each page has its own copy of the `firebaseConfig` block, so a config change means updating all 7 copies.

---

## Revamp in progress (decided 2026-10-19)

The app is being rebuilt as a **React app in `app/`**: Vite + TypeScript + Tailwind + shadcn/ui + Motion + Firebase modular SDK. The old root HTML pages stay live until cutover. The event is ~3–4 weeks from 2026-10-19.

- **Names are drawn** (not numbers). Entrants come from an optional source: guest list import, QR check-in, or pasted list.
- Guests check results via **name search** (`/check`) and a **public live winners board** (`/winners`).
- **Draw stage:** build 2–3 concepts first and send the user a preview link to pick one before building it for real.
- **Data:** one record per guest/winner under `events/ys60/`. Atomic multi-path draw claims, `winnerByGuest` to block double wins, explicit prize→winner mapping, void + redraw, Firebase Auth for staff, and `public/` as the only publicly readable node.
- **Phases:** 0 prerequisites ✅ → 1 skills ✅ → 2 scaffold `app/` ✅ → 3 data model + rules ✅ → 4 Draw concepts (preview) → 5 remaining screens → 6 Playwright tests on `events/ys60-test` → 7 rehearsal on preview channel, then cutover.
- Full approved plan: [`docs/revamp-plan.md`](docs/revamp-plan.md).
- **Ask first:** before starting each revamp step (scaffolding, installing, editing app code), tell the user what's about to happen and wait for a go-ahead, even in auto mode.

### The new app (`app/`)

Stack versions: Vite 8, React 19, TypeScript 7, Tailwind 4 (Vite plugin), shadcn/ui (radix base, `new-york` style, neutral), Motion 14, react-router 8, Firebase 13 modular SDK.

| Path | What |
|---|---|
| `app/src/lib/firebase.ts` | **The only Firebase config.** Exports `db`, `auth`, `EVENT_ID` (env `VITE_EVENT_ID`, default `ys60`), `eventPath()` / `eventRef()` → `events/{EVENT_ID}/…` |
| `app/src/hooks/useConnected.ts` | `.info/connected` for the online/offline indicator |
| `app/src/lib/auth.tsx` | `AuthProvider` / `useAuth()` → `{ loading, user, isStaff }` (`isStaff` comes from `staff/{uid}`) |
| `app/src/lib/session.ts` | `signIn`, `signOutStaff`, `authErrorMessage`, `actor()` (who did it, for `by` fields) |
| `app/src/lib/draw.ts` | `drawPrize` (fair pick via `random.ts`, one atomic multi-path claim, retries if the rules reject it, resolves only after the server accepts, 15 s timeout), `voidWinner`, `releaseGuest`, `eligibleGuestIds` |
| `app/src/lib/guests.ts` / `prizes.ts` | Parse pasted Excel/CSV, add as individual records (`push` keys, chunked `update`), `checkIn` (idempotent), delete with guards |
| `app/src/lib/export.ts` | CSV (Excel-safe, formula-injection-safe) + full JSON backup |
| `app/src/lib/log.ts`, `types.ts`, `text.ts`, `random.ts` | Audit log paths, data types, text cleanup, CSPRNG + Fisher–Yates |
| `app/src/components/RequireStaff.tsx` | Staff route guard: signed out → `/login?next=…`; signed in but not staff → "Not a staff account" |
| `app/src/routes/` | `index.tsx` (all routes), `Login.tsx`; the other pages are still `Placeholder`s |
| `app/tests/` | Vitest: `unit.test.ts` (pure logic) and `db.test.ts` (rules + draw flows against **`events/ys60-test` only**; needs `app/.env.local` with `TEST_STAFF_EMAIL` / `TEST_STAFF_PASSWORD`, git-ignored) |

Data lives under `events/{EVENT_ID}/`: `guests`, `prizes`, `winners/{prizeId}`, `winnerByGuest/{guestId}`, `settings`, `public/winners/{prizeId}` and `log` (append-only). A voided winner stays out of the draw unless released.
| `app/src/components/ui/` | shadcn components (add more with `npx shadcn@latest add <name>` inside `app/`) |

```powershell
cd app
npm install          # first time on a machine
npm run dev          # http://localhost:5173
npm run build        # type-check + build to app/dist
npm test             # unit + DB tests (DB tests use events/ys60-test only)
```

**Preview deploys never touch live.** `firebase.preview.json` serves `app/dist` with SPA rewrites; the live `firebase.json` still serves the old root pages and ignores `app/**`:

```powershell
cd app; npm run build; cd ..
firebase hosting:channel:deploy preview --config firebase.preview.json --project ys60-d283a
```

Known, accepted: `npm audit` shows 4 "high" items. They are gRPC (only used by Firestore on a Node server; we use the Realtime Database in the browser) and `braces` (only inside the shadcn CLI, a dev tool). Don't run `npm audit fix --force`, because it downgrades Firebase to v9.

**Ideas for Phase 4 (from the user, 2026-10-20):**
- [Anime.js v4](https://animejs.com/) (`npm i animejs`, MIT, modular ~24 KB): timelines, stagger, SVG line-draw/morph. A good fit for the scramble→gold reveal and a confetti/stagger finale. Wrap it in `createScope({ root })` inside a `useEffect` and revert it on unmount.
- [FeralUI](https://feralui.dev/): small MIT React packages with playful physics, by mortspace. The most relevant ones:
  - `feral-blinds`: spring carousels, including a "drum" mode that could drive the reels concept.
  - `pullcord`: a real-rope pull cord that could start the draw on stage. It depends on `motion@^12` while we're on 14, so check the version clash first.
  
  Use these sparingly on the Draw stage and the public pages, not in the admin UI.

## Skills (in `.claude/skills/`, committed)

Installed with `npx skills add … --agent claude-code --copy` (sources pinned in `skills-lock.json`); reviewed 2026-10-19.

| Skill | Source | Use it for |
|---|---|---|
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill | **Design system first**: palette, type, tokens, UX guidelines |
| `design-taste-frontend` | Leonxlnx/taste-skill | Creative direction: Draw stage + public pages |
| `frontend-design` | anthropics/skills | Creative direction (second opinion, anti-generic) |
| `impeccable` | pbakaus/impeccable | Audit/polish pass before each release |
| `animate`, `animation-vocabulary` | emilkowalski/skills | All motion: building animations, naming the effect wanted |
| `shadcn` | shadcn-ui/ui (official) | Admin/staff UI components |
| `webapp-testing` | anthropics/skills | Playwright (Python) tests |

**Precedence when they disagree:** ui-ux-pro-max tokens → taste/frontend-design direction → Emil's skills for motion → impeccable has the final review.

**Review notes:**
- `impeccable` scripts download a helper binary from GitHub releases, but only run it after a sha256 check.
- `design-taste-frontend/scripts/assets.mjs` fetches public-domain images from open APIs when asked.
- `shadcn` auto-runs `npx shadcn@latest info --json` on load.

## Pages

| File | Purpose | Staff login required |
|---|---|---|
| `index.html` | Staff hub: links to all pages | yes |
| `StaffLogin.html` | Password gate (sets `sessionStorage.staffAuth`) | n/a |
| `Draw.html` | Main lucky draw (slot animation and sounds) | yes |
| `PrizeConfig.html` | Set up prizes and display font sizes | yes |
| `PrizeDisplay.html` | Prize/winner display screen | yes |
| `displayPrize.html` | Prize grid display | yes |
| `Scanner01.html` | QR ticket scanner (collects entries) | yes |
| `ScannedDisplay.html` | Live list of scanned tickets | yes |
| `TrackResult.html` | Public "Check My Lucky Number" page | no |
| `slotmac.html` | Loading / slot animation | no |

All data lives under `drawResults/` in the Realtime Database: `items` (scanned tickets), `prizes`, `allResults`, `displaySettings`.

The staff password only works in the browser (it's in the page source). It does not protect the database.

---

## How to work on this (any machine)

```powershell
git clone https://github.com/allenemmanuel/YS60.git
cd YS60
```

**One-time machine setup** (done on the desktop PC 2026-10-19; repeat on the laptop):

```powershell
winget install OpenJS.NodeJS.LTS          # Node 24 LTS (approve the admin prompt), then reopen the terminal
py -m pip install --user playwright       # for the webapp-testing skill
py -m playwright install chromium
```

The skills come with the repo, so no reinstall is needed. Open the folder in VS Code and start a new Claude chat so they load.

**Deploy the site** (after committing your changes):

```powershell
firebase login            # once per machine; use the Google account that owns ys60-d283a
firebase deploy --only hosting --project ys60-d283a
```

- Get the Firebase CLI with `npm i -g firebase-tools` (needs Node.js), or use the standalone Windows build from https://firebase.tools/bin/win/latest. On the desktop PC it's installed at `%USERPROFILE%\.firebase-cli\firebase.exe`.
- After deploying, check that `https://ys60.web.app/.git/HEAD` returns **404**. The ignore list in `firebase.json` needs its explicit `.git/**` entry, because `**/.*` alone did not exclude it.

**Git:** pushes on the desktop PC authenticate as GitHub user `ysictd`, who is a collaborator on YS60.

---

## Progress log

### 2026-10-19 (desktop PC)
- Created the YS60 repo from a copy of MAKYS (full history kept).
- Rebranded: MAKYS → YS60 in titles and headings. The main heading is now **MALAM SAMBUTAN ULANG TAHUN 60 / YAYASAN SABAH** (`index.html`, `Draw.html`).
- New Firebase project `ys60-d283a`: Realtime Database created and rules opened; all pages switched to the new config.
- Moved hosting from GitHub Pages to Firebase Hosting at **https://ys60.web.app**. Removed the GitHub Pages workflow.
- Added this `CLAUDE.md`.
- Reviewed the whole app for robustness. Findings are listed under Open items → "Robustness fixes" (none fixed yet). They will be solved by the React rebuild, not patched.
- Decided on the revamp (see "Revamp in progress"). Phase 0: installed Node 24 LTS + Python Playwright/Chromium. Phase 1: installed and reviewed the 8 skills into `.claude/skills/`. Excluded `.claude/**` and `skills-lock.json` from hosting.
- **Next:** start a new chat (so the skills load), then Phase 2: scaffold `app/`.

### 2026-10-20 (desktop PC)
- **Phase 2 done:** scaffolded `app/` (see "The new app"). Every route has a placeholder page, there's a single `firebase.ts`, the `useConnected` hook and a stub staff guard. `npm run build` is clean, and Playwright confirmed all routes render with no console errors and connect to the database.
- Added `firebase.preview.json` for preview-channel deploys. The live `firebase.json` now ignores `app/**`. No deploy has been done yet: the live site is unchanged, and the preview channel hasn't been deployed.
- Looked into Anime.js and FeralUI at the user's request (notes under "Ideas for Phase 4").
- **Next:** Phase 3: data model + database rules + Firebase Auth. Needs from the user: enable Email/Password sign-in in the Firebase console and create the staff account(s).
- User enabled Email/Password and created the first staff account (uid `jp651OVeBWWMaydzvj3rTlNqnGV2`). Decision: lock `events/` only, and keep `drawResults/` open so the old site works until cutover.
- **Phase 3 code done:**
  - `database.rules.json` with a staff allowlist. It was added because anyone can create a Firebase Auth account using the public API key.
  - The data layer in `app/src/lib/`, the real `/login` page and `RequireStaff`.
  - Vitest tests. The 11 unit tests pass, and `npm run build` is clean.
- Staff entry added and database rules deployed. All 25 tests pass. Anonymous reads: `drawResults` → 200, `events` → 401.
- **Next:** Phase 4: Draw concepts.

---

## Open items / next steps

### Robustness fixes (from 2026-10-19 review, in priority order)
- [ ] **Anyone can wipe the database.** Rules are open, and the public `TrackResult.html` exposes the DB URL, so any guest could delete or alter all tickets/winners. Fix: Firebase Auth for staff + rules (public read of results only).
- [ ] **Lost scans / overwritten data.** Pages save whole lists back (read → modify → `set`), so the last writer wins. Two scanner PCs saving at once, or an open `Draw.html` (which writes back on every load/keystroke), can erase tickets. Fix: store each ticket as its own record (`push`) / use transactions.
- [ ] **Drawn tickets can be scanned again and win twice.** `Draw.html` removes winners from `items`, and `Scanner01.html` only checks `items` for duplicates.
- [ ] **"No. of Draw" isn't validated.** `-1` draws every ticket except one. `0` or blank records an empty draw, which shifts the winner→prize numbering on the display.
- [ ] **Winner → prize mapping is fragile.** The prize number = position in the flattened draw history; `TrackResult` drops empty entries but `PrizeDisplay` doesn't, so they can disagree. No way to redraw a no-show without shifting everyone after.
- [ ] **Draw button can be double-clicked** → two draws run at once.
- [ ] **Scanner: second scan during processing is ignored** but left in the field, so the next scan appends to it (the digit-mixing problem).
- [ ] **Shuffle is biased** (`sort(() => 0.5 - Math.random())`). Use Fisher–Yates with `crypto.getRandomValues`.
- [ ] "Clear Drawn" empties `drawnItems` without restoring them, so those tickets are lost from the pool for good; the "Sanitize Data" button is always visible.
- [ ] Ticket text is inserted as HTML in Draw's history list (`innerHTML`). A crafted QR code could inject script.
- [ ] Inconsistent prize counts: PrizeConfig/PrizeDisplay = 300, displayPrize = 200 (hardcoded old MAKYS prize names), counter mapping covers 1–200 only.
- [ ] No error/offline feedback: a draw is shown on screen even if saving to Firebase failed.

### Other
- [ ] Database is **empty**: set up prizes in `PrizeConfig.html` before the event.
- [ ] Two titles still use old wording: `Draw.html` ("Annual Grand Dinner - Name/Number Drawing Program") and `Scanner01.html` ("QR Code Scanner Data Collector"). Rename for YS60?
- [ ] Optional: real protection for the database (Firebase Auth for staff + tighter rules) instead of open rules.
- [ ] Optional: ideas in `IMPROVEMENTS.md` (shared `firebase-config.js`, one SDK version everywhere, mute button, error messages, accessibility).
