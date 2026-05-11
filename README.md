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

## Local testing

From the repo root:
```
bundle exec jekyll serve
```
Then open `http://localhost:4000/mm/`.

Do NOT open `index.html` via `file://` — `fetch('./*.ipuz')` requires HTTP.
