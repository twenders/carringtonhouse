# mm — crossword puzzles

Standalone single-page crossword app. No build step, no dependencies.
This README is excluded from the published site via `_config.yml`.

## Files

- `index.html` — page shell + styles, loads `app.js` as an ES module
- `app.js` — UI / input / rendering
- `engine.js` — grid + game logic (imported by `app.js`)
- `puzzles.json` — manifest of available puzzles (one entry per `.ipuz`)
- `YY-MM-<name>.ipuz` — puzzle data, one file per puzzle (currently `26-05-universe.ipuz`)
- `ipuz-format.md` — format reference for hand-authoring or generating `.ipuz` files
- `example.ipuz` — minimal 3×3 example demonstrating the format

## URLs

- `https://twenders.netlify.app/mm/` → loads the last entry in `puzzles.json` (the latest)
- `https://twenders.netlify.app/mm/?p=YY-MM-<name>.ipuz` → loads a specific puzzle from the directory
- `https://twenders.netlify.app/mm/?p=local` → loads the puzzle most recently uploaded via the `?` menu

## Adding a new puzzle

1. Drop `YY-MM-<name>.ipuz` into this directory.
2. Append an entry to `puzzles.json` (chronological order, oldest first — last entry is the default):
   ```json
   { "file": "YY-MM-<name>.ipuz", "title": "<title>", "date": "YYYY-MM" }
   ```
3. Commit and push. Netlify rebuilds automatically.

Older puzzles stay reachable via `?p=` and the puzzle picker in the `?` menu.

## The `?` menu

The rightmost toolbar button opens a panel with:

- Keyboard / touch shortcuts (how to type, navigate, switch direction, etc.)
- **Choose puzzle** — a `<select>` populated from `puzzles.json`. Picking switches to that puzzle.
- **Upload .ipuz…** — load a user-supplied `.ipuz` file. Its source is stored in `localStorage` (key `xword-upload-source`, one slot, overwritten on next upload) and the page navigates to `?p=local`. Survives reloads. See [`ipuz-format.md`](./ipuz-format.md) for the format spec and [`example.ipuz`](./example.ipuz) for a minimal working file.

## Editing

Edit files directly in this folder — no build step. Commit, push, done.

## Local testing

From the repo root, with Jekyll for the full site:
```
bundle exec jekyll serve
```
Then open `http://localhost:4000/mm/`.

For real-device testing over LAN (iOS Safari caches HTML/JS aggressively without explicit headers, so dev edits don't appear; this server sends `Cache-Control: no-store`):
```
python3 mm/_dev/serve.py 8124 mm
```
Then open `http://<your-mac-ip>:8124/` on the device (find IP with `ipconfig getifaddr en0`).

Do NOT open `index.html` via `file://` — `fetch('./*.ipuz')` requires HTTP.

## Development docs

`_dev/` holds the spec and plan documents that drove the original build of this viewer — see `_dev/docs/superpowers/specs/` and `_dev/docs/superpowers/plans/`. Reference only; not served by the site (excluded via `_config.yml`).
