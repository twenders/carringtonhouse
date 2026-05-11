---
layout: page
title: .ipuz format
---
# `.ipuz` format for this viewer

The viewer accepts standard [.ipuz](http://www.ipuz.org/) crossword files (`kind` = `http://ipuz.org/crossword#1`). It's just JSON — no need for any tool to create one.

See [`example.ipuz`](./example.ipuz) for a complete working file you can download and edit.

## Minimal structure

```json
{
  "version": "http://ipuz.org/v1",
  "kind": ["http://ipuz.org/crossword#1"],
  "dimensions": { "width": 3, "height": 3 },
  "puzzle": [
    ["#",   1,   2],
    [   3,   0,   0],
    [   4,   0,   0]
  ],
  "solution": [
    ["#", "A", "B"],
    ["C", "D", "E"],
    ["F", "G", "H"]
  ],
  "block": "#"
}
```

That renders as a 3×3 grid with a black square in the top-left:

```
█ A B
C D E
F G H
```

## Required fields

| Field | What it is |
|---|---|
| `version`, `kind` | Always the values shown above. |
| `dimensions.width` / `dimensions.height` | Integer grid size. |
| `puzzle` | 2D array, `height` rows × `width` columns. Use `0` (or any non-block value) for white cells; the block character for black squares. |
| `solution` | 2D array of the same shape, with the solution letter at each white cell and the block character at each black square. |
| `block` | The string used to mark black squares. Conventionally `"#"`. Both `puzzle` and `solution` use this same character. |

## Recommended metadata

Optional, but all of these appear in the header if present:

| Field | Example | Where it shows |
|---|---|---|
| `title` | `"Across the Solar System"` | Main title |
| `subtitle` | `"Antfarm edition"` | Under the title (italic) |
| `author` | `"Carrington House"` | "By Carrington House" |
| `publisher` | `"Mystic Moneymaker"` | Publisher line |
| `publisher_url` | `"https://mysticmoneymaker.com/"` | Makes the publisher name a link |
| `date` | `"05/2026"` | Appended after the publisher |
| `id` | `"26-05-universe"` | Used as the localStorage key for player progress. **Set a stable `id`** so editing the puzzle later doesn't invalidate saved progress. If omitted, the viewer hashes `title + solution`. |

## How numbering works

The viewer **ignores the integer values in the `puzzle` array** and recomputes numbering from the block layout. You can put `0`, `1`, the actual standard number, or anything else there — it makes no difference to what gets rendered. The example uses sequential numbers just for readability.

A cell starts an across entry when it has no white cell to its left; it starts a down entry when it has no white cell above. Numbers count up in reading order over cells that start at least one entry.

### Non-standard rule: single-cell entries

Standard crossword rules require words of length ≥ 2. This viewer's numbering rule allows length-1 entries (a white cell completely surrounded by blocks/edges becomes its own numbered entry, both across and down). For most puzzles this never triggers and the rule produces identical numbering to the standard one. If you've got isolated cells you want numbered, they'll be.

## Clues

This viewer doesn't render clues — current puzzles are companions to a printed sheet. The standard `clues.Across` and `clues.Down` fields are accepted but ignored, so you can include them without breaking anything.

## Where this is used

- **In the deployed site**: drop a new `.ipuz` next to `index.html` and append an entry to [`puzzles.json`](./puzzles.json). See the main [README](./README.md).
- **As an upload**: click `?` → **Upload .ipuz…** to load a local file. The raw JSON is stored in `localStorage` under `xword-upload-source` and reachable via `?p=local`.
