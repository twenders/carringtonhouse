# Carrington House crossword

[![Netlify Status](https://api.netlify.com/api/v1/badges/a3f9d0d7-b11d-46eb-8034-f5a736775ac8/deploy-status)](https://app.netlify.com/projects/carringtonhouse/deploys)

Standalone single-page crossword viewer. No build step, no dependencies. Deployed at [carringtonhouse.netlify.app](https://carringtonhouse.netlify.app/).

## Files

- `index.html` — page shell + styles, loads `app.js` as an ES module
- `app.js` — UI / input / rendering
- `engine.js` — grid + game logic (imported by `app.js`)
- `puzzles.json` — manifest of available puzzles (one entry per `.ipuz`)
- `YY-MM-<name>.ipuz` — puzzle data, one file per puzzle (currently `26-05-universe.ipuz`)
- `ipuz-format.html` — format reference for hand-authoring or generating `.ipuz` files
- `example.ipuz` — minimal 3×3 example demonstrating the format

## URLs

- `https://carringtonhouse.netlify.app/` → loads the last entry in `puzzles.json` (the latest)
- `https://carringtonhouse.netlify.app/?p=YY-MM-<name>.ipuz` → loads a specific puzzle from the directory
- `https://carringtonhouse.netlify.app/?p=local` → loads the puzzle most recently uploaded via the `?` menu

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
- **Upload .ipuz…** — load a user-supplied `.ipuz` file. Its source is stored in `localStorage` (key `xword-upload-source`, one slot, overwritten on next upload) and the page navigates to `?p=local`. Survives reloads. See [`ipuz-format.html`](./ipuz-format.html) for the format spec and [`example.ipuz`](./example.ipuz) for a minimal working file.

## Editing

Edit files directly — no build step. Commit, push, done.

## Local testing

The page can't be opened via `file://` (`fetch('./*.ipuz')` requires HTTP). Use a local HTTP server. The included no-cache dev server is recommended for real-device testing over LAN — iOS Safari otherwise aggressively caches HTML/JS without explicit headers:

```
python3 _dev/serve.py 8124 .
```

Then open `http://<your-mac-ip>:8124/` on the device (find your IP with `ipconfig getifaddr en0`).

## Development docs

`_dev/` holds the spec and plan documents that drove the original build of this viewer — see `_dev/docs/superpowers/specs/` and `_dev/docs/superpowers/plans/`. Reference only; not served.
