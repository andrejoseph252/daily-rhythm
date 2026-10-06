# Daily Rhythm

A calm daily notebook for one person: three priorities, quiet habits, logged work, a line in the evening, and a focus timer that knits while you work.

It's a static site (plain HTML, CSS and JavaScript, no build step) hosted on GitHub Pages. Your data lives in a private GitHub gist and syncs across devices.

---

## Setup

### 1. Create the gist

1. Go to <https://gist.github.com>.
2. Filename: `data.json`. Content: `{}`.
3. Click **Create secret gist**.
4. Copy the **gist ID**, the long hex string at the end of the URL:
   `https://gist.github.com/<you>/`**`3f2a9c0e…`**

A secret gist is unlisted but not encrypted, so anyone with the URL can read it. Don't put anything in your notes you wouldn't want in a private-but-not-locked drawer.

### 2. Create a token (gist access only)

Use a **fine-grained personal access token**:

1. Open GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Name it `daily-rhythm`. Pick an expiration you're comfortable with (up to a year).
3. Repository access: **Public repositories (read-only)**. The app doesn't need any repository access.
4. Under **Account permissions**, set **Gists** to **Read and write**. Leave everything else as *No access*.
5. Generate it and copy the token (`github_pat_…`). It's shown only once.

A classic token with only the `gist` scope also works.

### 3. Connect each device

Open the site and go to **Settings → Sync**. Paste the token and the gist ID, then press **Save & sync**. Do this once on each device (laptop, phone).

The token and gist ID are stored only in that browser's `localStorage`. They're never in the code or the repository. **Forget on this device** removes them.

### 4. Publish on GitHub Pages

1. Push this folder to a GitHub repository (public is fine, since the code contains no secrets):
   ```sh
   git init && git add . && git commit -m "Daily Rhythm"
   git branch -M main
   git remote add origin https://github.com/andrejoseph252/daily-rhythm.git
   git push -u origin main
   ```
2. In the repository, open **Settings** → **Pages**.
3. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch to **main**, folder **/ (root)**, then **Save**.
4. After a minute the site is live at <https://andrejoseph252.github.io/daily-rhythm/>.

The empty `.nojekyll` file tells Pages to serve the files as they are.

### 5. Put it on your iPhone home screen

1. Open the site in **Safari**.
2. Tap **Share** (the square with the arrow) → **Add to Home Screen**. Keep the name *Rhythm* and tap **Add**.
3. Open it from the home screen. It runs full-screen with its own knitted-star icon, like an app.
4. **Connect sync inside the home-screen app** (Settings → Sync). iOS gives home-screen apps their own storage, separate from Safari, so a token entered in Safari isn't visible there.

To jump straight into a focus session, use `…/daily-rhythm/#/focus`. It works as a bookmark or as the URL in an iPhone Shortcut.

### Running locally

JavaScript modules don't load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## How it works

### Views

- **Today**: the date and a daily quotation, the week strip, *Today's three*, *Habits*, *Work* and *Evening*.
- **Week**: Monday to Sunday at a glance, showing habits done, priorities completed, hours worked, knitted pieces and the evening note.
- **Settings**: theme (System / Light · Fjord / Dark · Forest), habits and the days they belong to, the length of a full working day, focus options, sync, export.

### Focus sessions

Press **Begin focus** (or `F`, or open `#/focus`), name what you're working on, and scroll the dial to a length (5-minute steps, 5 minutes to 3 hours). While the timer runs, a Norwegian star pattern is knitted stitch by stitch.

- **Stay on the page.** If you switch tabs, switch apps or lock the phone for longer than the grace period (15 s by default), the yarn slips off the needle and the piece is lost. You can still log the minutes you'd done.
- The screen is kept awake during a session (where the browser allows it).
- **Phone may be locked during focus** (Settings → Work & focus): with this on, locking the phone or leaving the page never breaks a session, and the knitting catches up when you come back. A web app can't tell locking the phone apart from switching apps, so with this on it's an honour system. iOS also can't play the chime on the lock screen, so the session is marked finished and logged when you next open the app.
- If you end early or get interrupted, the time you put in is logged **rounded up to the next 5 minutes** (as long as at least a minute has passed).
- When the timer ends, the session is logged as a work block automatically, marked with a small knitted swatch. A soft chime plays if it's enabled.
- On a laptop, working in another *window* is fine. Only leaving the tab or minimising the browser counts as stepping away.
- A running session survives a quick reload.

### Shortcuts

| Key | Action |
| --- | --- |
| `←` / `→` | Previous / next day (or week, in Week view). On a phone, swipe. |
| `T` | Today |
| `W` | Week |
| `F` | Begin focus |
| `Enter` | Next priority |
| `Esc` | Leave a field |

Work durations accept `1h30`, `1h 30m`, `1:30`, `1.5`, `90`, `90m` or `45 min`. A bare number up to 6 means hours; anything larger means minutes.

### Sync

- Everything is cached in `localStorage`, so the app opens instantly and works offline.
- Edits are synced to the gist 1.5 seconds after you stop typing, and again whenever the tab regains focus or the connection returns.
- Each sync reads the gist, merges, and writes back. The merge is **last-write-wins per day**: for each date, the most recently edited version is kept. Habits and settings travel together and also follow last-write-wins.
- The small label in the corner of the header shows the state: *saved*, *saving…*, *syncing…*, *offline · saved here*, *sync failed*, or *saved on this device* (not connected). Hover over *sync failed* to see the reason, or look in Settings → Sync.

---

## Data schema

The gist holds one file, `data.json`:

```json
{
  "version": 1,
  "updatedAt": "2026-10-07T19:42:11.000Z",
  "metaUpdatedAt": "2026-10-01T08:00:00.000Z",
  "settings": {
    "enoughMinutes": 300,
    "focusChime": true,
    "focusGraceSeconds": 15,
    "focusAllowAway": false
  },
  "habits": [
    { "id": "walk", "label": "Walk", "active": true, "days": [1, 2, 3, 4, 5, 6, 7] },
    { "id": "gym-k2f9", "label": "Gym", "active": true, "days": [2, 4, 6] }
  ],
  "days": {
    "2026-10-07": {
      "priorities": [
        { "text": "Problem set 3, question 2", "done": true },
        { "text": "Read Angrist & Pischke, ch. 4", "done": false },
        { "text": "", "done": false }
      ],
      "habits": { "walk": true },
      "blocks": [
        { "id": "a8k2m1q", "minutes": 45, "subject": "Microeconometrics", "knit": true },
        { "id": "p0x7c3d", "minutes": 120, "subject": "Thesis reading" }
      ],
      "note": "Slow start, good afternoon.",
      "updatedAt": "2026-10-07T19:42:11.000Z"
    }
  }
}
```

| Field | Meaning |
| --- | --- |
| `days` | Keyed by local date `YYYY-MM-DD`. A day exists only once something has been written to it. |
| `days[].priorities` | Always exactly three slots. |
| `days[].habits` | `{ habitId: true }` for each habit done that day. |
| `days[].blocks` | Logged work, in whole `minutes`, with a free-text `subject`. `knit: true` marks a completed focus session. |
| `days[].note` | The evening line (up to 160 characters). |
| `days[].updatedAt` | Used to merge days between devices. |
| `habits[].id` | Stable, so renaming a habit keeps its history. |
| `habits[].days` | ISO weekdays the habit is due (1 = Monday … 7 = Sunday). On other days it doesn't appear and isn't counted. |
| `habits[].active` | `false` once removed. It's kept so past days still read correctly. |
| `settings.enoughMinutes` | What counts as a full working day (the "enough" bar). |
| `metaUpdatedAt` | Last change to `habits` or `settings`, used for merging. |

Device-only keys in `localStorage`: `rhythm.data` (offline cache), `rhythm.auth` (token and gist ID), `rhythm.theme`, `rhythm.focus` (a running session) and `rhythm.focusPrefs` (last subject and length).

## Files

```
index.html            page shell: Today, Week and Settings views, focus overlay
css/style.css         design tokens (Fjord light, Forest dark), layout, components
js/app.js             routing, rendering, events, shortcuts, swipe
js/store.js           schema, normalisation, merge, localStorage cache
js/sync.js            gist pull / merge / push, debounce, status
js/focus.js           focus session lifecycle, length dial, grace period, wake lock, chime
js/knit.js            the knitted Selbu-star swatch, drawn on a canvas
js/dates.js           date keys, ISO weeks, duration parsing and formatting
js/quotes.js          the daily quotations
icons/                home-screen icon (knitted Selbu star) and favicon
manifest.webmanifest  web-app name, colours and icons
```
