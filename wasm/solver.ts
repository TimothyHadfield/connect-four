// Connect Four exact solver, compiled to WebAssembly (AssemblyScript) for speed.
// Same method as js/solver.js (bitboard negamax, alpha-beta, transposition table,
// non-losing move filter, threat-count ordering, null-window narrowing), but on
// native 64-bit integers. Layout: column-major, H+1 bits per column, so it covers
// boards with W*(H+1) <= 64 (7x6, 8x7, 6x5, ...). Build: npm run build:wasm

let W: i32 = 7;
let H: i32 = 6;
let WH: i32 = 42;
let S1: u64 = 7; // one column (horizontal step)
let S0: u64 = 6; // diagonal
let S2: u64 = 8; // other diagonal
let BOTTOM: u64 = 0;
let BOARD: u64 = 0;
let MIN_SCORE: i32 = 0;
let MAX_SCORE: i32 = 0;
let ttBits: i32 = 0;
let ttMask: u64 = 0;
let ttKeys = new StaticArray<u64>(1);
let ttVals = new StaticArray<u8>(1);
const colMask = new StaticArray<u64>(16);
const order = new StaticArray<i32>(16);
const sortMv = new StaticArray<u64>(80 * 16);
const sortSc = new StaticArray<i32>(80 * 16);
let nodes: f64 = 0;
let budget: f64 = 0;
let stopped: bool = false;

export function init(w: i32, h: i32, bits: i32): void {
  W = w; H = h; WH = w * h;
  S1 = <u64>(h + 1); S0 = <u64>h; S2 = <u64>(h + 2);
  BOTTOM = 0; BOARD = 0;
  for (let c = 0; c < w; c++) {
    const bot: u64 = (<u64>1) << (<u64>(c * (h + 1)));
    BOTTOM |= bot;
    const cm: u64 = (((<u64>1) << (<u64>h)) - 1) << (<u64>(c * (h + 1)));
    unchecked(colMask[c] = cm);
    BOARD |= cm;
  }
  // centre-first order
  const mid: f64 = (<f64>(w - 1)) / 2.0;
  let n = 0;
  for (let d = 0; d < w; d++) {
    for (let c = 0; c < w; c++) {
      const dist = Math.abs(<f64>c - mid);
      if (dist >= <f64>d * 0.5 - 0.01 && dist <= <f64>d * 0.5 + 0.01) { unchecked(order[n] = c); n++; }
    }
  }
  MIN_SCORE = -(WH / 2) + 3;
  MAX_SCORE = (WH + 1) / 2 - 3;
  if (bits != ttBits) {
    ttBits = bits;
    ttKeys = new StaticArray<u64>(1 << bits);
    ttVals = new StaticArray<u8>(1 << bits);
  } else clearTT();
  ttMask = ((<u64>1) << (<u64>bits)) - 1;
}

export function clearTT(): void {
  const n = 1 << ttBits;
  for (let i = 0; i < n; i++) { unchecked(ttKeys[i] = 0); unchecked(ttVals[i] = 0); }
}

export function getNodes(): f64 { return nodes; }

@inline function winPos(pos: u64, mask: u64): u64 {
  let r: u64 = (pos << 1) & (pos << 2) & (pos << 3);
  let p: u64;
  p = (pos << S1) & (pos << (2 * S1)); r |= p & (pos << (3 * S1)); r |= p & (pos >> S1);
  p = (pos >> S1) & (pos >> (2 * S1)); r |= p & (pos << S1); r |= p & (pos >> (3 * S1));
  p = (pos << S0) & (pos << (2 * S0)); r |= p & (pos << (3 * S0)); r |= p & (pos >> S0);
  p = (pos >> S0) & (pos >> (2 * S0)); r |= p & (pos << S0); r |= p & (pos >> (3 * S0));
  p = (pos << S2) & (pos << (2 * S2)); r |= p & (pos << (3 * S2)); r |= p & (pos >> S2);
  p = (pos >> S2) & (pos >> (2 * S2)); r |= p & (pos << S2); r |= p & (pos >> (3 * S2));
  return r & (BOARD ^ mask);
}

@inline function ttIndex(key: u64): i32 {
  return <i32>(((key * 0x9E3779B97F4A7C15) >> (<u64>(64 - ttBits))) & ttMask);
}

function negamax(cur: u64, mask: u64, moves: i32, alpha: i32, beta: i32): i32 {
  nodes += 1;
  if (nodes > budget) { stopped = true; return 0; }
  let possible: u64 = (mask + BOTTOM) & BOARD;
  const opp = winPos(cur ^ mask, mask);
  const forced = possible & opp;
  if (forced) {
    if (forced & (forced - 1)) return -((WH - moves) / 2);
    possible = forced;
  }
  const next = possible & ~(opp >> 1);
  if (!next) return -((WH - moves) / 2);
  if (moves >= WH - 2) return 0;
  let min = -((WH - 2 - moves) / 2);
  if (alpha < min) { alpha = min; if (alpha >= beta) return alpha; }
  let max = (WH - 1 - moves) / 2;
  const key = cur + mask;
  const idx = ttIndex(key);
  if (unchecked(ttKeys[idx]) == key) {
    const val = <i32>unchecked(ttVals[idx]);
    if (val > MAX_SCORE - MIN_SCORE + 1) {
      min = val + 2 * MIN_SCORE - MAX_SCORE - 2;
      if (alpha < min) { alpha = min; if (alpha >= beta) return alpha; }
    } else if (val) {
      max = val + MIN_SCORE - 1;
      if (beta > max) { beta = max; if (alpha >= beta) return beta; }
    }
  }
  const base = moves * 16;
  let cnt = 0;
  for (let k = W - 1; k >= 0; k--) {
    const mv = next & unchecked(colMask[unchecked(order[k])]);
    if (mv) {
      const sc = <i32>popcnt(winPos(cur | mv, mask));
      let p = cnt++;
      while (p > 0 && unchecked(sortSc[base + p - 1]) > sc) {
        unchecked(sortSc[base + p] = sortSc[base + p - 1]);
        unchecked(sortMv[base + p] = sortMv[base + p - 1]);
        p--;
      }
      unchecked(sortSc[base + p] = sc);
      unchecked(sortMv[base + p] = mv);
    }
  }
  for (let i = cnt - 1; i >= 0; i--) {
    const mv = unchecked(sortMv[base + i]);
    const sc = -negamax(cur ^ mask, mask | mv, moves + 1, -beta, -alpha);
    if (stopped) return 0;
    if (sc >= beta) {
      unchecked(ttKeys[idx] = key);
      unchecked(ttVals[idx] = <u8>(sc + MAX_SCORE - 2 * MIN_SCORE + 2));
      return sc;
    }
    if (sc > alpha) alpha = sc;
  }
  unchecked(ttKeys[idx] = key);
  unchecked(ttVals[idx] = <u8>(alpha - MIN_SCORE + 1));
  return alpha;
}

// Exact score of a position (side to move's view). Returns -1000 if maxNodes ran out.
export function solve(cl: u32, ch: u32, ml: u32, mh: u32, moves: i32, weak: bool, maxNodes: f64): i32 {
  const cur: u64 = ((<u64>ch) << 32) | <u64>cl;
  const mask: u64 = ((<u64>mh) << 32) | <u64>ml;
  nodes = 0; stopped = false;
  budget = maxNodes > 0 ? maxNodes : 1e300;
  if (winPos(cur, mask) & ((mask + BOTTOM) & BOARD)) return (WH + 1 - moves) / 2;
  let min = -((WH - moves) / 2);
  let max = (WH + 1 - moves) / 2;
  if (weak) { min = -1; max = 1; }
  while (min < max) {
    let med = min + (max - min) / 2;
    if (med <= 0 && min / 2 < med) med = min / 2;
    else if (med >= 0 && max / 2 > med) med = max / 2;
    const r = negamax(cur, mask, moves, med, med + 1);
    if (stopped) return -1000;
    if (r <= med) max = r; else min = r;
  }
  return min;
}
