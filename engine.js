// Crossword engine — pure logic, no DOM.
// Exports are added task by task.

export function parseIpuz(ipuz) {
  const rows = ipuz.dimensions.height;
  const cols = ipuz.dimensions.width;
  const blockChar = ipuz.block ?? '#';
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const sol = ipuz.solution[r][c];
      const isBlock = sol === blockChar || ipuz.puzzle[r][c] === blockChar;
      row.push({
        isBlock,
        solution: isBlock ? null : String(sol).toUpperCase(),
        number: null,
        acrossWord: null,
        downWord: null,
      });
    }
    cells.push(row);
  }
  const id = ipuz.id ?? synthesizeId(ipuz);
  const puzzle = {
    rows, cols, id,
    title: ipuz.title ?? '',
    cells,
    numbering: { acrossStarts: [], downStarts: [] },
  };
  computeNumbering(puzzle);
  return puzzle;
}

function synthesizeId(ipuz) {
  const seed = (ipuz.title ?? '') + '|' + JSON.stringify(ipuz.solution);
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'x-' + (h >>> 0).toString(36);
}

export function computeNumbering(puzzle) {
  const { rows, cols, cells } = puzzle;
  const isWhite = (r, c) =>
    r >= 0 && r < rows && c >= 0 && c < cols && !cells[r][c].isBlock;

  const acrossStarts = [];
  const downStarts = [];
  let n = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r][c];
      if (cell.isBlock) continue;
      const startsAcross = !isWhite(r, c - 1);
      const startsDown   = !isWhite(r - 1, c);
      if (!startsAcross && !startsDown) continue;
      n += 1;
      cell.number = n;
      if (startsAcross) {
        let len = 0;
        let cc = c;
        while (isWhite(r, cc)) { cc++; len++; }
        const entry = { num: n, r, c, len, dir: 'across' };
        acrossStarts.push(entry);
        for (let i = 0; i < len; i++) cells[r][c + i].acrossWord = entry;
      }
      if (startsDown) {
        let len = 0;
        let rr = r;
        while (isWhite(rr, c)) { rr++; len++; }
        const entry = { num: n, r, c, len, dir: 'down' };
        downStarts.push(entry);
        for (let i = 0; i < len; i++) cells[r + i][c].downWord = entry;
      }
    }
  }

  puzzle.numbering.acrossStarts = acrossStarts;
  puzzle.numbering.downStarts = downStarts;
}

export function createInitialState(puzzle) {
  let cursor = { r: 0, c: 0 };
  let direction = 'across';
  outer:
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (!puzzle.cells[r][c].isBlock) {
        cursor = { r, c };
        if (!puzzle.cells[r][c].acrossWord && puzzle.cells[r][c].downWord) {
          direction = 'down';
        }
        break outer;
      }
    }
  }
  return {
    entries: {},
    locked: {},
    cursor,
    direction,
    autoCheck: false,
    solvedAt: null,
  };
}

const key = (r, c) => `${r},${c}`;

function nextCellInDirection(puzzle, r, c, direction) {
  // Move one step in `direction`; return null if we'd leave the current word.
  const word = direction === 'across'
    ? puzzle.cells[r][c].acrossWord
    : puzzle.cells[r][c].downWord;
  if (!word) return null;
  if (direction === 'across') {
    const last = word.c + word.len - 1;
    if (c < last) return { r, c: c + 1 };
    return null;
  } else {
    const last = word.r + word.len - 1;
    if (r < last) return { r: r + 1, c };
    return null;
  }
}

export function typeLetter(state, puzzle, letter) {
  const { r, c } = state.cursor;
  const cell = puzzle.cells[r][c];
  if (cell.isBlock) return state;
  if (state.locked[key(r, c)]) return state;
  const upper = String(letter).toUpperCase();
  if (!/^[A-Z]$/.test(upper)) return state;
  const newEntries = { ...state.entries, [key(r, c)]: upper };
  const next = nextCellInDirection(puzzle, r, c, state.direction);
  return {
    ...state,
    entries: newEntries,
    cursor: next ?? state.cursor,
  };
}

function prevCellInWord(puzzle, r, c, direction) {
  const word = direction === 'across'
    ? puzzle.cells[r][c].acrossWord
    : puzzle.cells[r][c].downWord;
  if (!word) return null;
  if (direction === 'across') {
    if (c > word.c) return { r, c: c - 1 };
    return null;
  } else {
    if (r > word.r) return { r: r - 1, c };
    return null;
  }
}

export function backspace(state, puzzle) {
  const { r, c } = state.cursor;
  const k = key(r, c);
  if (state.entries[k]) {
    const newEntries = { ...state.entries };
    delete newEntries[k];
    return { ...state, entries: newEntries };
  }
  // Active cell empty: walk backward across locked cells.
  let cur = { r, c };
  while (true) {
    const prev = prevCellInWord(puzzle, cur.r, cur.c, state.direction);
    if (!prev) return state;
    if (!state.locked[key(prev.r, prev.c)]) {
      const newEntries = { ...state.entries };
      delete newEntries[key(prev.r, prev.c)];
      return { ...state, entries: newEntries, cursor: prev };
    }
    cur = prev;
  }
}

export function moveCursor(state, puzzle, dr, dc) {
  let { r, c } = state.cursor;
  while (true) {
    r += dr; c += dc;
    if (r < 0 || r >= puzzle.rows || c < 0 || c >= puzzle.cols) return state;
    if (!puzzle.cells[r][c].isBlock) break;
  }
  const isPerpendicular =
    (state.direction === 'across' && dr !== 0) ||
    (state.direction === 'down' && dc !== 0);
  return {
    ...state,
    cursor: { r, c },
    direction: isPerpendicular
      ? (state.direction === 'across' ? 'down' : 'across')
      : state.direction,
  };
}

export function toggleDirection(state) {
  return { ...state, direction: state.direction === 'across' ? 'down' : 'across' };
}

export function tabToWord(state, puzzle, reverse = false) {
  const ordered = [
    ...puzzle.numbering.acrossStarts,
    ...puzzle.numbering.downStarts,
  ];
  // Find the current word (or current word's start if cursor is mid-word).
  const cur = puzzle.cells[state.cursor.r][state.cursor.c];
  const currentWord = state.direction === 'across' ? cur.acrossWord : cur.downWord;
  let idx;
  if (currentWord) {
    idx = ordered.findIndex(w => w === currentWord);
  } else {
    idx = -1;
  }
  const step = reverse ? -1 : 1;
  const len = ordered.length;
  const targetIdx = (idx + step + len) % len;
  const target = ordered[targetIdx];
  return {
    ...state,
    cursor: { r: target.r, c: target.c },
    direction: target.dir,
  };
}

export function clickCell(state, puzzle, r, c) {
  const cell = puzzle.cells[r][c];
  if (cell.isBlock) return state;
  if (state.cursor.r === r && state.cursor.c === c) {
    return toggleDirection(state);
  }
  return { ...state, cursor: { r, c } };
}

export function isCorrect(state, puzzle, r, c) {
  const k = key(r, c);
  return state.entries[k] === puzzle.cells[r][c].solution;
}

export function wrongCells(state, puzzle) {
  const out = [];
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (puzzle.cells[r][c].isBlock) continue;
      const v = state.entries[key(r, c)];
      if (v && v !== puzzle.cells[r][c].solution) out.push([r, c]);
    }
  }
  return out;
}

export function isSolved(state, puzzle) {
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const cell = puzzle.cells[r][c];
      if (cell.isBlock) continue;
      if (state.entries[key(r, c)] !== cell.solution) return false;
    }
  }
  return true;
}

export function setAutoCheck(state, on) {
  return { ...state, autoCheck: !!on };
}

export function revealLetter(state, puzzle) {
  const { r, c } = state.cursor;
  const cell = puzzle.cells[r][c];
  if (cell.isBlock) return state;
  return {
    ...state,
    entries: { ...state.entries, [key(r, c)]: cell.solution },
    locked: { ...state.locked, [key(r, c)]: true },
  };
}

export function revealWord(state, puzzle) {
  const { r, c } = state.cursor;
  const cell = puzzle.cells[r][c];
  const word = state.direction === 'across' ? cell.acrossWord : cell.downWord;
  if (!word) return state;
  const entries = { ...state.entries };
  const locked = { ...state.locked };
  for (let i = 0; i < word.len; i++) {
    const wr = word.r + (state.direction === 'down' ? i : 0);
    const wc = word.c + (state.direction === 'across' ? i : 0);
    entries[key(wr, wc)] = puzzle.cells[wr][wc].solution;
    locked[key(wr, wc)] = true;
  }
  return { ...state, entries, locked };
}

export function revealPuzzle(state, puzzle) {
  const entries = { ...state.entries };
  const locked = { ...state.locked };
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const cell = puzzle.cells[r][c];
      if (cell.isBlock) continue;
      entries[key(r, c)] = cell.solution;
      locked[key(r, c)] = true;
    }
  }
  return { ...state, entries, locked };
}

export function clearAll(state) {
  return { ...state, entries: {}, locked: {}, solvedAt: null };
}

const storageKey = (puzzle) => `xword:${puzzle.id}`;

export function saveState(state, puzzle, storage = globalThis.localStorage) {
  if (!storage) return;
  try {
    const payload = JSON.stringify({
      dim: `${puzzle.rows},${puzzle.cols}`,
      state,
    });
    storage.setItem(storageKey(puzzle), payload);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('saveState failed:', e);
  }
}

export function loadState(puzzle, storage = globalThis.localStorage) {
  if (!storage) return null;
  let raw;
  try {
    raw = storage.getItem(storageKey(puzzle));
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed?.dim !== `${puzzle.rows},${puzzle.cols}`) return null;
  return parsed.state ?? null;
}
