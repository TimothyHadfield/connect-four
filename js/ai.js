/* Computer players and position analysis. Everything here is synchronous, so the
 * same code runs inside the Web Worker (local games, analysis) and inside an
 * online room's host browser (online.js calls game.bot synchronously).
 *
 * Levels (strength measured by tools/strength.mjs, see data/strength.json):
 *   perfect  - exact solver: never lets a won or drawn game slip
 *   strong   - looks 8 discs ahead
 *   medium   - looks 4 discs ahead
 *   easy     - looks 2 discs ahead, 1 move in 4 is random
 *   beginner - random, but takes a win it can see and usually blocks one
 * Pop Out uses its own search (depth 6 / 4 / 2 / random). */

import { makeSolver, BIG } from "./solver.js";
import { bookKey } from "./book.js";
import { winsAt, hasLine, isFull } from "./rules.js";
import { ABORTED } from "./fast.js";

export const LEVELS = ["perfect", "strong", "medium", "easy", "beginner"];
export const LEVEL_NAMES = { perfect: "Perfect", strong: "Strong", medium: "Medium", easy: "Easy", beginner: "Beginner" };

let FAST = null;  // wasm solver for the current size (set by the worker / page)
let BOOK = null;  // Map from book.js (7x6 only)
export function useFast(f) { FAST = f; }
export function useBook(b) { BOOK = b; }
export function hasBook() { return !!BOOK; }

const discOf = (seat) => (seat === 0 ? 1 : 2);

/** Cells with the first mover renamed to disc 1 (what the book expects). */
export function normCells(cells, firstDisc) {
  if (firstDisc === 1) return cells;
  return Array.from(cells, (v) => (v ? 3 - v : 0));
}

function count(cells) { let n = 0; for (const v of cells) if (v) n++; return n; }

/* --------------------------------------------------------------- exact */

/** Exact score (side to move) via wasm if it fits this size, else JS solver. null = budget ran out. */
export function exactScore(cells, W, H, toMove, opts = {}) {
  if (FAST && FAST.W === W && FAST.H === H) {
    const s = FAST.solve(cells, toMove, opts);
    return s === ABORTED ? null : s;
  }
  const S = makeSolver(W, H);
  const p = jsPos(S, cells, toMove);
  return S.solvePos(p, opts);
}
function jsPos(S, cells, toMove) {
  const W = S.W, H = S.H;
  const grid = [];
  for (let c = 0; c < W; c++) { grid.push([]); for (let r = 0; r < H; r++) grid[c].push(cells[c * H + r] ? (cells[c * H + r] === toMove ? 1 : 2) : 0); }
  // fromGrid infers "to move" from counts; build directly instead
  const p = S.empty();
  for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) {
    const v = grid[c][r]; if (!v) break;
    const w = c >> 2, b = 1 << ((c & 3) * 8 + r);
    p.m[w] |= b; if (v === 1) p.c[w] |= b; p.h[c]++; p.moves++;
  }
  return p;
}

/** Book category for the side to move after `cells` (7x6 drop, <= 8 discs). 2 win / 1 draw / 0 loss, or null. */
export function bookCategory(cells, W, H, toMove, firstDisc) {
  if (!BOOK || W !== 7 || H !== 6) return null;
  const n = count(cells);
  if (n > 8) return null;
  const v = BOOK.get(bookKey(normCells(cells, firstDisc)));
  if (v === undefined) return null;
  return toMove === firstDisc ? v : 2 - v;
}

/* ------------------------------------------------------------ analysis */

/**
 * Verdict for every column (drop games). Returns array W of null (full) or
 * { cat: 2|1|0 (win/draw/loss for the side to move), score: exact or null, exact: bool }.
 * opts.strongBudget: node budget per column for the exact distance; opts.weakBudget likewise.
 * onPartial(result) is called as columns resolve.
 */
export function analyzeColumns(cells, W, H, toMove, firstDisc, opts = {}, onPartial) {
  cells = Array.from(cells);
  const out = new Array(W).fill(null);
  const order = centreOrder(W);
  const n = count(cells);
  for (const c of order) if (rowOf(cells, H, c) >= 0) out[c] = { cat: null, score: null, exact: false };
  // pass 1: immediate wins, book, weak solve
  for (const c of order) {
    const r = rowOf(cells, H, c);
    if (r < 0) continue;
    cells[c * H + r] = toMove;
    if (winsAt(cells, W, H, c, r, toMove)) out[c] = { cat: 2, score: (W * H + 1 - n) >> 1, exact: true };
    else if (n + 1 >= W * H) out[c] = { cat: 1, score: 0, exact: true };
    else {
      const b = bookCategory(cells, W, H, 3 - toMove, firstDisc);
      if (b !== null) out[c] = { cat: 2 - b, score: null, exact: false };
      else {
        const s = exactScore(cells, W, H, 3 - toMove, { weak: true, maxNodes: opts.weakBudget || 0 });
        out[c] = s === null ? { cat: null, score: null, exact: false } : { cat: s < 0 ? 2 : s > 0 ? 0 : 1, score: s === 0 ? 0 : null, exact: s === 0 };
      }
    }
    cells[c * H + r] = 0;
    if (onPartial) onPartial(out.slice());
  }
  if (onPartial) onPartial(out.slice(), true);
  // pass 2: exact distance for wins/losses
  if (opts.strongBudget !== -1) {
    for (const c of order) {
      const o = out[c];
      if (!o || o.exact) continue;
      const r = rowOf(cells, H, c);
      cells[c * H + r] = toMove;
      const s = exactScore(cells, W, H, 3 - toMove, { maxNodes: opts.strongBudget || 0 });
      cells[c * H + r] = 0;
      if (s !== null) { out[c] = { cat: s < 0 ? 2 : s > 0 ? 0 : 1, score: -s, exact: true }; if (onPartial) onPartial(out.slice()); }
    }
  }
  return out;
}

function rowOf(cells, H, c) { for (let r = 0; r < H; r++) if (!cells[c * H + r]) return r; return -1; }
const orderCache = {};
export function centreOrder(W) {
  if (orderCache[W]) return orderCache[W];
  const m = (W - 1) / 2;
  return (orderCache[W] = [...Array(W).keys()].sort((a, b) => Math.abs(a - m) - Math.abs(b - m) || a - b));
}

/** Turn a score into turns-to-the-end: { result, turns } (see solver.js). */
export function describeScore(score, moves, W, H) {
  const WH = W * H;
  if (score === 0) return { result: "draw", turns: null };
  if (score > 0) return { result: "win", turns: ((WH + 3 - moves) >> 1) - score };
  return { result: "loss", turns: ((WH + 2 - moves) >> 1) + score };
}

/* ------------------------------------------------------------ choosing */

function pickRandom(list, rng) { return list[Math.floor(rng() * list.length)]; }

/** Heuristic values per column for the side to move (bigger = better). */
function heuristicColumns(cells, W, H, toMove, depth) {
  const S = makeSolver(W, H);
  const p = jsPos(S, cells, toMove);
  return S.hAnalyze(p, depth);
}

function bestOf(vals, rng, slack = 0) {
  let best = -Infinity;
  for (const v of vals) if (v !== null && v !== undefined && v > best) best = v;
  const cands = [];
  vals.forEach((v, c) => { if (v !== null && v !== undefined && v >= best - slack) cands.push(c); });
  return pickRandom(cands, rng);
}

/** Choose a column for a drop game. */
export function chooseDrop(cells, W, H, toMove, firstDisc, level, rng = Math.random) {
  cells = Array.from(cells);
  const legal = [];
  for (let c = 0; c < W; c++) if (!cells[c * H + H - 1]) legal.push(c);
  if (!legal.length) return null;
  const wins = legal.filter((c) => { const r = rowOf(cells, H, c); cells[c * H + r] = toMove; const w = winsAt(cells, W, H, c, r, toMove); cells[c * H + r] = 0; return w; });
  const blocks = legal.filter((c) => { const r = rowOf(cells, H, c); cells[c * H + r] = 3 - toMove; const w = winsAt(cells, W, H, c, r, 3 - toMove); cells[c * H + r] = 0; return w; });
  if (level === "beginner") {
    if (wins.length) return pickRandom(wins, rng);
    if (blocks.length && rng() < 0.6) return pickRandom(blocks, rng);
    return pickRandom(legal, rng);
  }
  if (wins.length) return pickRandom(wins, rng);
  if (level === "easy") {
    if (rng() < 0.25) return pickRandom(legal, rng);
    return bestOf(heuristicColumns(cells, W, H, toMove, 2), rng);
  }
  if (level === "medium") return bestOf(heuristicColumns(cells, W, H, toMove, 4), rng);
  if (level === "strong") return bestOf(heuristicColumns(cells, W, H, toMove, 8), rng);
  return choosePerfect(cells, W, H, toMove, firstDisc, rng);
}

/** Perfect play: keep the best result (win > draw > loss); among equals win fastest / lose slowest. */
export function choosePerfect(cells, W, H, toMove, firstDisc, rng = Math.random, budget = 4e6) {
  const n = count(cells);
  const cat = new Array(W).fill(null);
  const order = centreOrder(W);
  let unsure = false;
  for (const c of order) {
    const r = rowOf(cells, H, c);
    if (r < 0) continue;
    cells[c * H + r] = toMove;
    if (winsAt(cells, W, H, c, r, toMove)) { cells[c * H + r] = 0; return c; }
    if (n + 1 >= W * H) cat[c] = 1;
    else {
      const b = bookCategory(cells, W, H, 3 - toMove, firstDisc);
      if (b !== null) cat[c] = 2 - b;
      else {
        const s = exactScore(cells, W, H, 3 - toMove, { weak: true, maxNodes: budget });
        if (s === null) unsure = true;
        cat[c] = s === null ? null : s < 0 ? 2 : s > 0 ? 0 : 1;
      }
    }
    cells[c * H + r] = 0;
  }
  if (unsure) {
    // Too deep to solve in time (big boards early on): fall back to a deep look-ahead.
    const known = cat.map((v) => (v === null ? null : v));
    if (known.some((v) => v === 2)) return bestOf(cat, rng);
    return bestOf(heuristicColumns(cells, W, H, toMove, 9), rng);
  }
  const best = Math.max(...cat.filter((v) => v !== null));
  const cands = order.filter((c) => cat[c] === best);
  if (cands.length === 1) return cands[0];
  if (best === 1) {
    // Drawn: pick the drawing move that sets the most traps (heuristic look-ahead).
    const h = heuristicColumns(cells, W, H, toMove, 6);
    return bestOf(h.map((v, c) => (cands.includes(c) ? v : null)), rng);
  }
  // Won or lost: prefer the fastest win / slowest loss when we can count it in time.
  const sc = new Array(W).fill(null);
  let all = true;
  for (const c of cands) {
    const r = rowOf(cells, H, c);
    cells[c * H + r] = toMove;
    const s = n + 1 <= 8 && W === 7 && H === 6 ? null : exactScore(cells, W, H, 3 - toMove, { maxNodes: budget / 4 });
    cells[c * H + r] = 0;
    if (s === null) { all = false; break; }
    sc[c] = -s;
  }
  if (all) return bestOf(sc, rng);
  const h = heuristicColumns(cells, W, H, toMove, 6);
  return bestOf(h.map((v, c) => (cands.includes(c) ? v : null)), rng);
}

/* ------------------------------------------------------------- Pop Out */

const windowsCache = {};
function windows(W, H) {
  const k = W + "x" + H;
  if (windowsCache[k]) return windowsCache[k];
  const out = [];
  for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const ec = c + 3 * dc, er = r + 3 * dr;
    if (ec < 0 || ec >= W || er < 0 || er >= H) continue;
    out.push([0, 1, 2, 3].map((i) => (c + i * dc) * H + (r + i * dr)));
  }
  return (windowsCache[k] = out);
}
const WEIGHT = [0, 1, 5, 25];
function evalCells(cells, W, H, me) {
  let s = 0;
  for (const w of windows(W, H)) {
    let a = 0, b = 0;
    for (const i of w) { const v = cells[i]; if (v === me) a++; else if (v) b++; }
    if (a && !b) s += WEIGHT[a]; else if (b && !a) s -= WEIGHT[b];
  }
  const mid = (W - 1) / 2;
  for (let c = 0; c < W; c++) if (Math.abs(c - mid) < 1) for (let r = 0; r < H; r++) { const v = cells[c * H + r]; if (v === me) s += 2; else if (v) s -= 2; }
  return s;
}
function popMoves(cells, W, H, me) {
  const out = [];
  const order = centreOrder(W);
  for (const c of order) if (!cells[c * H + H - 1]) out.push({ c });
  for (const c of order) if (cells[c * H] === me) out.push({ c, p: true });
  return out;
}
function applyPop(cells, W, H, m, me) {
  const n = cells.slice();
  if (m.p) { for (let r = 0; r < H - 1; r++) n[m.c * H + r] = n[m.c * H + r + 1]; n[m.c * H + H - 1] = 0; }
  else { const r = rowOf(n, H, m.c); n[m.c * H + r] = me; }
  return n;
}
const PWIN = 100000;
function popSearch(cells, W, H, me, depth, alpha, beta, ply) {
  const moves = popMoves(cells, W, H, me);
  if (!moves.length) return 0;
  if (depth === 0) return evalCells(cells, W, H, me);
  let best = -Infinity;
  for (const m of moves) {
    const n = applyPop(cells, W, H, m, me);
    let v;
    const mine = hasLine(n, W, H, me), theirs = hasLine(n, W, H, 3 - me);
    if (mine) v = PWIN - ply;
    else if (theirs) v = -(PWIN - ply);
    else v = -popSearch(n, W, H, 3 - me, depth - 1, -beta, -alpha, ply + 1);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
/** Values of every legal Pop Out move for the side to move: [{c, p, v}] */
export function popValues(cells, W, H, me, depth) {
  return popMoves(cells, W, H, me).map((m) => {
    const n = applyPop(cells, W, H, m, me);
    let v;
    if (hasLine(n, W, H, me)) v = PWIN;
    else if (hasLine(n, W, H, 3 - me)) v = -PWIN;
    else v = -popSearch(n, W, H, 3 - me, depth - 1, -Infinity, Infinity, 1);
    return { ...m, v };
  });
}
export const POP_DEPTH = { perfect: 7, strong: 6, medium: 4, easy: 2, beginner: 0 };
export function choosePop(cells, W, H, me, level, rng = Math.random, reps = null, turnSeat = 0) {
  cells = Array.from(cells);
  const moves = popMoves(cells, W, H, me);
  if (!moves.length) return { draw: true };
  if (level === "beginner") {
    const win = moves.find((m) => hasLine(applyPop(cells, W, H, m, me), W, H, me) && !(m.p && false));
    return win ? strip(win) : strip(pickRandom(moves, rng));
  }
  if (level === "easy" && rng() < 0.25) return strip(pickRandom(moves, rng));
  const vals = popValues(cells, W, H, me, POP_DEPTH[level] || 4);
  const best = Math.max(...vals.map((x) => x.v));
  if (isFull(cells) && best < 0) return { draw: true };
  return strip(pickRandom(vals.filter((x) => x.v === best), rng));
}
function strip(m) { return m.p ? { c: m.c, p: true } : { c: m.c }; }

/* ------------------------------------------------------- one entry point */

/** botMove(pub, seat, level, rng) for game.js / online.js */
export function botMove(pub, seat, level, rng = Math.random) {
  const me = discOf(seat);
  const firstDisc = discOf(pub.first);
  if (pub.popout) return choosePop(pub.cells, pub.W, pub.H, me, level, rng);
  return { c: chooseDrop(pub.cells, pub.W, pub.H, me, firstDisc, level, rng) };
}

export { BIG };
