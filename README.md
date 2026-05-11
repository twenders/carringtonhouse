# mm — crossword puzzles

Standalone single-page crossword app. No build step, no dependencies.
This README is excluded from the published site via `_config.yml`.

## Files

- `index.html` — page shell + styles, loads `app.js` as an ES module
- `app.js` — UI / input / rendering
- `engine.js` — grid + game logic (imported by `app.js`)
- `YY-MM-<name>.ipuz` — puzzle data, one file per puzzle (currently `26-05-universe.ipuz`)

## URLs

- `https://twenders.netlify.app/mm/` → loads whichever `.ipuz` is named in `app.js`'s fallback
- `https://twenders.netlify.app/mm/?p=YY-MM-<name>.ipuz` → loads a specific puzzle

## Adding a new puzzle

1. Drop `YY-MM-<name>.ipuz` into this directory.
2. (Optional) To make it the new default at the bare `/mm/` URL, edit the fallback in `app.js`:
   ```js
   const url = params.get('p') ?? './YY-MM-<name>.ipuz';
   ```
3. Commit and push. Netlify rebuilds automatically.

Old puzzles stay reachable via the `?p=` query string.

## Editing

Edit files directly in this folder — no build step. Commit, push, done.

## Development docs

`_dev/` holds the spec and plan documents that drove the original build of this viewer — see `_dev/docs/superpowers/specs/` and `_dev/docs/superpowers/plans/`. Reference only; not served by the site (excluded via `_config.yml`).

## Local testing

From the repo root:
```
bundle exec jekyll serve
```
Then open `http://localhost:4000/mm/`.

Do NOT open `index.html` via `file://` — `fetch('./*.ipuz')` requires HTTP.

## Planned: puzzle picker dropdown

Goal: a `<select>` in the toolbar that lists all puzzles and defaults to the latest, with the current `?p=` query string still working as an override.

Static hosts can't list directories, so we need a manifest file the app can fetch. Sketch:

1. Add `puzzles.json` next to the `.ipuz` files. Keep entries in chronological order (oldest first, last entry = latest):
   ```json
   [
     { "file": "26-05-universe.ipuz", "title": "Universe", "date": "2026-05" }
   ]
   ```
2. In `app.js` `bootstrap()`, fetch `./puzzles.json` before the puzzle itself. Build a `<select>` populated from the manifest; on `change`, update the URL with `?p=<file>` and reload (or re-init the engine in place).
3. Default puzzle = last entry in the manifest. This replaces the hardcoded fallback in `app.js`, so adding a new puzzle becomes "drop the file + append one line to `puzzles.json`" — no `app.js` edit needed.

`puzzles.json` itself is just a regular static file; Jekyll will copy it through unchanged. No `_config.yml` change required.
