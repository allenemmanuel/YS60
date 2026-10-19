# YS60 revamp: skills setup + React rebuild

## Context

The YS60 lucky-draw app (copied from MAKYS) works on the happy path but is fragile. The review on 2026-10-19 found:
- an open database anyone can wipe
- lost scans from whole-list overwrites
- winners who can win twice
- unvalidated draw input
- prizes matched to winners only by draw order

That list is in `CLAUDE.md` → "Robustness fixes". The user wants a **stronger, reliable and beautiful** app, with a Draw screen that wows the crowd. The event is **3–4 weeks away**.

Decisions made:
- **Rebuild in React:** Vite + TypeScript + Tailwind + shadcn/ui + Motion. This lets every requested skill work.
- **Skills live in the repo** (`.claude/skills/`), so they travel to the laptop.
- **Names are drawn**, not numbers. Entrants can come from three optional sources: a **guest list import**, **QR check-in**, or a **pasted list**.
- Guests can find out if they won through a **name search** and a **public live winners board**.
- The user wants to **preview Draw concepts before building**.

Standing rules (CLAUDE.md): YS60 only, never MAKYS. Update CLAUDE.md at every finished step and commit it with the work.

---

## Phase 0: Prerequisites (desktop PC)

1. Install Node.js LTS: `winget install OpenJS.NodeJS.LTS`. This is needed for `npx skills`, Vite and shadcn.
2. Install Python Playwright for webapp-testing: `py -m pip install playwright` then `py -m playwright install chromium`.
3. Add a "Laptop setup" section to CLAUDE.md listing the same steps.

## Phase 1: Install the 7 skills into `.claude/skills/` (project scope)

Use the `skills` CLI with `--agent claude-code`, which installs into the project's `.claude/skills/`. Install from the official sources only:

| Skill | Source | Command |
|---|---|---|
| Frontend-Design | `anthropics/skills` | `npx skills add anthropics/skills --skill frontend-design --agent claude-code` |
| Webapp-Testing | `anthropics/skills` | `npx skills add anthropics/skills --skill webapp-testing --agent claude-code` |
| UI/UX Pro Max | `nextlevelbuilder/ui-ux-pro-max-skill` | `npx skills add nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max --agent claude-code` |
| Taste Skill | `Leonxlnx/taste-skill` | `npx skills add Leonxlnx/taste-skill --skill design-taste-frontend --agent claude-code` |
| Impeccable | `pbakaus/impeccable` | per the repo README (dist for claude-code → `.claude/`) |
| Emil Kowalski | `emilkowalski/skills` | `npx skills add emilkowalski/skills --skill animate --skill animation-vocabulary --agent claude-code` |
| shadcn/ui | `shadcn-ui/ui` | `npx skills add shadcn-ui/ui --skill shadcn --agent claude-code` |

- **Review before committing:** these are third-party instructions and scripts. Read every installed `SKILL.md` and any scripts, and flag anything that runs network calls or shell commands unexpectedly.
- **Overlap:** four of the skills give design direction. Record a precedence in CLAUDE.md:
  - ui-ux-pro-max sets the design system: palette, type and tokens.
  - taste-skill and frontend-design set the creative direction for the Draw stage and the public pages.
  - impeccable audits and polishes before each release.
  - Emil's skills cover all motion.
  - shadcn covers the admin/staff UI components.
- Start a new chat afterwards so the skills load. Then commit `.claude/skills/` and push.

## Phase 2: Scaffold the new app (alongside the old pages)

- Create the new app in `app/` (Vite + React + TS) with Tailwind, shadcn/ui (`components.json`), Motion, react-router and the Firebase modular SDK.
- Put the Firebase config in a single module, `app/src/lib/firebase.ts`, instead of copying it into every page.
- Keep the old root HTML pages untouched and live at ys60.web.app until cutover.
- Do previews and rehearsals on a **Firebase Hosting preview channel**: `firebase hosting:channel:deploy preview` gives a temporary URL.

**Routes**

| Route | Purpose | Access |
|---|---|---|
| `/login` | Staff sign-in | public |
| `/admin` | Event control: entry mode, guests, prizes, draw queue, winners, export | staff |
| `/admin/guests` | Import guest list (CSV/paste from Excel), pasted list, QR codes | staff |
| `/admin/prizes` | Prize list: order, name, collection counter | staff |
| `/checkin` | QR check-in, multiple scanners | staff |
| `/stage` | **Big-screen Draw** (projector, keyboard/clicker controls) | staff |
| `/winners` | Public live winners board | public |
| `/check` | Public "Did I win?" name search | public |

## Phase 3: Reliable data model + security (fixes the review findings)

The Realtime Database, under `events/ys60/`:

```
guests/{guestId}     { name, group?, source: list|paste|qr, checkedIn, checkedInAt }
prizes/{prizeId}     { order, name, counter }
winners/{prizeId}    { guestId, name, drawnAt, by, status: active|void }
winnerByGuest/{guestId}: prizeId      ← stops anyone winning twice
settings             { entryMode: all|checkedIn, ... }
public/winners/{prizeId} { name, prizeName, counter }   ← only data the public can read
log/{pushId}         audit trail of every draw / void / import
```

- **One record per guest.** Guests are saved with `push`/`update`, never by rewriting a whole list, so concurrent scans can't erase each other. A check-in is a single-field write and is idempotent.
- **Atomic draw:**
  1. Pick a candidate fairly: Fisher–Yates with `crypto.getRandomValues`, from eligible guests who have no `winnerByGuest` entry.
  2. Claim the prize in one multi-path update: `winners/{prizeId}`, `winnerByGuest/{guestId}`, `public/winners/{prizeId}`, `log`.
  3. The rules reject the claim if the prize or the guest is already taken. On rejection, retry with a new candidate.
  4. Show the winner on screen **only after the save succeeds**.
- **Explicit mapping:** winners map to prizes by `prizeId`, never by position.
- **No-show redraw:** mark the winner `void`. That prize is redrawn on its own, and nothing else shifts.
- **Security:**
  - Staff sign in with Firebase Auth (email/password, created in the console).
  - Rules: `auth != null` for all of `events/ys60` except `public/`, which anyone can read and nobody can write.
  - Validation rules: names are strings of at most 120 characters, required fields are present, and claims are allowed only where not already taken.
- **UX safety:**
  - Disable the draw button while a draw runs.
  - Show an offline/connection indicator (`.info/connected`).
  - Ask for confirmation, and log, every destructive action.
  - Export CSV/JSON of guests and winners for backup.
- **Rendering:** all user text goes through React (escaped by default). Never use `dangerouslySetInnerHTML`.

## Phase 4: Draw stage, preview first

1. Use taste-skill, frontend-design, ui-ux-pro-max and Emil's `animate`/`animation-vocabulary` to build **2–3 Draw concepts** as standalone `/stage` variants that run on dummy names. Candidates:
   - names racing on vertical reels that slow down and lock
   - a cinematic spotlight with a name scramble resolving into a gold reveal
   - a particle/name-cloud collapse
2. All concepts must handle long Malay names, a 16:9 projector, fullscreen, sound with a mute toggle, `prefers-reduced-motion`, and a clicker (Space/→).
3. Deploy the concepts to the preview channel, **send the user the link to choose one**, then build the chosen concept for real on top of the Phase 3 draw logic.

## Phase 5: Remaining screens

- Admin pages use shadcn components: tables, dialogs, forms, toasts.
- **Guests:** import a CSV, or paste from Excel. Generate printable QR codes that encode the `guestId`. Pasted names get IDs automatically.
- **Check-in:** multiple scanners, with a queue instead of rejection. Each input buffer is cleared per scan.
- **Prizes:** import/edit, with a collection counter per prize instead of the hard-coded 1–200 ranges.
- **Public pages:** `/winners` updates live. `/check` searches by name with fuzzy, diacritic-insensitive matching and handles duplicate names by showing both.
- Run an impeccable audit pass at the end.

## Phase 6: Testing (webapp-testing / Playwright)

- Point tests at a separate `events/ys60-test` node, never the real event data.
- Scripted scenarios:
  - two scanner contexts checking in at the same moment, with no lost entries
  - double-clicking Draw produces one winner
  - a guest can't win twice
  - void + redraw shifts nothing
  - invalid inputs are rejected
  - an offline save shows an error and no winner
  - the public pages can't write
  - an anonymous REST `DELETE` is denied
- Visual checks of `/stage` at 1920×1080 and of the public pages at phone width.

## Phase 7: Cutover

- **Full rehearsal on the preview channel** with real devices: projector, scanners, phones.
- Then switch `firebase.json` hosting `public` to `app/dist`, with SPA rewrites to `index.html`.
- Remove the old root HTML pages and their flat `drawResults` data.
- Deploy to ys60.web.app and confirm `.git`/source files aren't served.
- Tag the release `v1-event`.

---

## Critical files
- New: `app/` (whole React app), `app/src/lib/firebase.ts`, `database.rules.json`, `.claude/skills/*`
- Modified: `firebase.json` (add database rules; at cutover `public: app/dist` + rewrites), `CLAUDE.md` (stack, skills precedence, laptop setup, progress), `.gitignore` (`node_modules`, `app/dist`)
- Removed at cutover: root `*.html`, root `*.mp3` (sounds move to `app/public/`)
- Reused as reference only: draw flow and timing in `Draw.html`, multi-scanner idea in `Scanner01.html`, `firebaseToArray` pattern (no longer needed with keyed records), prize import parsing in `PrizeConfig.html`

## Verification
- `npm run build` has no type errors. The preview channel URL loads every route.
- The Playwright scenarios in Phase 6 pass against `events/ys60-test`.
- Rules check: `curl` the DB REST API anonymously. Reading `public/` works, while writes and reads elsewhere are denied.
- Manual rehearsal: import guests, check in via QR, draw on the projector, void and redraw, and check on a phone via `/check` and `/winners`.
- After each phase, CLAUDE.md is updated, committed and pushed to YS60. Never MAKYS.
