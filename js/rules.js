/* Board rules shared by the game engine, the computer players and the tools.
 * cells: array of W*H, column-major (index col*H + row, row 0 = bottom),
 * 0 = empty, 1 = first colour (red), 2 = second colour (yellow). */

export const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

export function heights(cells, W, H) {
  const h = new Array(W).fill(0);
  for (let c = 0; c < W; c++) while (h[c] < H && cells[c * H + h[c]]) h[c]++;
  return h;
}

/** Does the disc at (c, r) belong to a line of 4+ for player p? */
export function winsAt(cells, W, H, c, r, p) {
  const at = (cc, rr) => cc >= 0 && cc < W && rr >= 0 && rr < H && cells[cc * H + rr] === p;
  for (const [dc, dr] of DIRS) {
    let n = 1;
    for (let k = 1; at(c + dc * k, r + dr * k); k++) n++;
    for (let k = 1; at(c - dc * k, r - dr * k); k++) n++;
    if (n >= 4) return true;
  }
  return false;
}

/** All cells that are part of some 4-in-a-row for player p (for highlighting). */
export function lineCells(cells, W, H, p) {
  const out = new Set();
  for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) {
    for (const [dc, dr] of DIRS) {
      const run = [];
      for (let k = 0; k < 4; k++) {
        const cc = c + dc * k, rr = r + dr * k;
        if (cc < 0 || cc >= W || rr < 0 || rr >= H || cells[cc * H + rr] !== p) break;
        run.push(cc * H + rr);
      }
      if (run.length === 4) run.forEach((i) => out.add(i));
    }
  }
  return [...out].sort((a, b) => a - b);
}

export function hasLine(cells, W, H, p) {
  for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) {
    if (cells[c * H + r] !== p) continue;
    for (const [dc, dr] of DIRS) {
      let k = 1;
      for (; k < 4; k++) {
        const cc = c + dc * k, rr = r + dr * k;
        if (cc < 0 || cc >= W || rr < 0 || rr >= H || cells[cc * H + rr] !== p) break;
      }
      if (k === 4) return true;
    }
  }
  return false;
}

/** Drop p into column c. Returns the row, or -1 if full. Mutates cells. */
export function drop(cells, W, H, c, p) {
  for (let r = 0; r < H; r++) if (!cells[c * H + r]) { cells[c * H + r] = p; return r; }
  return -1;
}

/** Pop the bottom disc of column c (everything above slides down). Mutates. */
export function pop(cells, W, H, c) {
  const v = cells[c * H];
  for (let r = 0; r < H - 1; r++) cells[c * H + r] = cells[c * H + r + 1];
  cells[c * H + H - 1] = 0;
  return v;
}

export function isFull(cells) { for (const v of cells) if (!v) return false; return true; }

/** A compact text form of a board + side to move (for repetition counting). */
export function boardKey(cells, toMove) { return toMove + ":" + Array.prototype.join.call(cells, ""); }
