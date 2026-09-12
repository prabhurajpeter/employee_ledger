# Ledger — Staff Desk

An employee, attendance, and expense manager. No build step, no
server-side code, no database — everything runs in the browser, and it
works completely offline (the Excel engine is bundled locally, nothing
is fetched from the internet at runtime).

## What's inside

```
employee-ledger/
├── index.html              page structure
├── css/
│   └── styles.css          all styling
├── js/
│   ├── app.js               the app's logic
│   └── vendor/
│       └── xlsx.core.min.js  Excel read/write engine (bundled, offline)
├── package.json             optional convenience script for local hosting
└── README.md
```

Keep this folder structure intact — `index.html` loads the other files by
relative path, so don't rename or move the `css`/`js` folders on their own.

## Running it locally (simplest option)

Just double-click `index.html`, or drag it into a browser window. Chrome,
Edge, Firefox, and Safari all work, and the relative `css`/`js` links
resolve fine even when opened straight from disk.

**Known limitation:** some browsers (notably Chrome) disable a page's saved
data when it's opened directly from disk (`file://...`). If you add an
employee, refresh, and it's gone, that's this rule, not a bug. Two ways
around it:

1. Use **Export to Excel** after each session and **Import from Excel** to
   reload it next time, or
2. Serve the folder over `http://` instead of `file://` (see below) — this
   fixes it completely.

**If you're opening it on a phone via Files/Messages/Mail:** make sure you
choose "Open in Safari" (or your browser) rather than the quick preview —
preview panes don't run JavaScript and will show raw code as text instead
of the app.

## Serving it over HTTP (recommended for daily use)

**Python (already on most Mac/Linux machines):**
```bash
cd employee-ledger
python3 -m http.server 8000
```
Then open `http://localhost:8000`.

**Node.js:**
```bash
npm start
```
(runs `npx serve . -l 8000` — see `package.json`)

**No install needed, permanent link:** drag the whole `employee-ledger`
folder into [Netlify Drop](https://app.netlify.com/drop), or push it to a
GitHub repo and turn on GitHub Pages. Either gives you a real `https://`
URL you can open from any device, including phones.

## Deploying to production

Because this is a static site with no backend, it deploys anywhere that
serves static files:

| Host | Steps |
|---|---|
| **Netlify** | Drag the `employee-ledger` folder onto [app.netlify.com/drop](https://app.netlify.com/drop). Done — live URL immediately. |
| **Vercel** | `npx vercel employee-ledger` (or connect a Git repo containing this folder). |
| **GitHub Pages** | Push this folder to a repo, then enable Pages in Settings → Pages. |
| **Any web server (Apache/Nginx/S3, etc.)** | Upload the whole folder, preserving the `css/` and `js/` subfolders, to the web root. |

No environment variables, build commands, or server processes are needed —
just make sure it's served over `http://`/`https://`, not opened as a bare
local file, so saved data persists between visits.

## Data & backups

- Every add, edit, or delete auto-saves to the browser's local storage for
  that specific URL/device.
- Local storage is **per browser and per device** — it doesn't sync
  between your laptop and phone, or between Chrome and Firefox, on its own.
- Use **Export to Excel** (sidebar, or Settings page) regularly as your
  real backup and as the way to move data between devices — it downloads
  a `.xlsx` with a sheet each for Employees, Attendance, Expenses, and
  Expense Categories.
- **Import from Excel** loads a previously exported file back in, replacing
  whatever is currently in the app.
- **Erase all data** (Settings page) wipes everything in that browser —
  export a backup first if you might need it.

## Multi-user note

This app has no server, login, or shared database — each browser/device
keeps its own local copy. If several people need the *same* live data,
share the exported `.xlsx` file (e.g. via a shared drive), or designate
one place as the single point of entry and have others work from recent
Excel exports.
