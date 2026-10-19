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

---

## Infrastructure

| What | Value |
|---|---|
| Firebase project | `ys60-d283a` (console: https://console.firebase.google.com/project/ys60-d283a/overview) |
| Hosting site | `ys60` → https://ys60.web.app (also `ys60.firebaseapp.com`) |
| Realtime Database | https://ys60-d283a-default-rtdb.firebaseio.com (US region) |
| DB rules | Open read/write (`.read: true`, `.write: true`). The pages use no Firebase Auth. |
| Hosting config | `firebase.json` (site `ys60`) + `.firebaserc` (project `ys60-d283a`) |

Every page uses the Firebase JS SDK compat build via `<script>` tags (v9.21.0; `Scanner01.html` uses v8.10.0). Each page has its own copy of the `firebaseConfig` block, so a config change means updating all 7 copies.

---

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

---

## Open items / next steps

- [ ] Database is **empty**: set up prizes in `PrizeConfig.html` before the event.
- [ ] Two titles still use old wording: `Draw.html` ("Annual Grand Dinner - Name/Number Drawing Program") and `Scanner01.html` ("QR Code Scanner Data Collector"). Rename for YS60?
- [ ] Optional: real protection for the database (Firebase Auth for staff + tighter rules) instead of open rules.
- [ ] Optional: ideas in `IMPROVEMENTS.md` (shared `firebase-config.js`, one SDK version everywhere, mute button, error messages, accessibility).
