/* Talks to the background workers (js/worker.js): one for computer moves, one
 * for the solver's verdicts. A newer request always wins: an analysis worker
 * still busy with an old position is stopped and replaced, and every reply is
 * checked against a generation number so a late answer never lands on a new game. */

import { describeScore } from "./ai.js";

function spawn() { return new Worker(new URL("./worker.js", import.meta.url), { type: "module" }); }

export class Analyst {
  constructor(bits = 21) { this.bits = bits; this.w = null; this.gen = 0; this.busy = false; this.cb = null; }
  start() {
    if (this.w) return;
    this.w = spawn();
    this.w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "analysis" && m.id === this.gen && this.cb) { if (m.done) this.busy = false; this.cb(m); }
      if (m.type === "error" && m.id === this.gen) { this.busy = false; if (this.cb) this.cb({ error: m.message, done: true }); }
    };
    this.w.onerror = () => { this.busy = false; };
  }
  /** req: { cells, W, H, toMove, firstDisc, popout, weakBudget, strongBudget, depth } */
  analyze(req, cb) {
    if (this.busy && this.w) { this.w.terminate(); this.w = null; }
    this.start();
    this.gen++;
    this.cb = cb;
    this.busy = true;
    this.w.postMessage({ type: "analyze", id: this.gen, bits: this.bits, ...req, cells: Array.from(req.cells) });
  }
  cancel() { this.gen++; this.cb = null; if (this.busy && this.w) { this.w.terminate(); this.w = null; this.busy = false; } }
  /** Promise version (study mode walks through a game one position at a time). */
  once(req) { return new Promise((res) => this.analyze(req, (m) => { if (m.done) res(m); })); }
}

export class BotClient {
  constructor(bits = 22) { this.bits = bits; this.w = null; this.gen = 0; this.pending = new Map(); }
  start() {
    if (this.w) return;
    this.w = spawn();
    this.w.onmessage = (e) => {
      const m = e.data;
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      if (m.type === "move") p.res(m.move); else p.rej(new Error(m.message || "computer failed"));
    };
  }
  warm(W, H) { this.start(); this.w.postMessage({ type: "init", W, H, bits: this.bits }); }
  move(pub, seat, level) {
    this.start();
    const id = ++this.gen;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.w.postMessage({ type: "move", id, pub, seat, level, bits: this.bits }); });
  }
}

/** Solver result per column -> chips for the board's top row. */
export function chipsFor(cols, moves, W, H) {
  if (!cols) return null;
  const known = cols.filter((c) => c && c.cat !== null && c.cat !== undefined);
  const bestCat = known.length ? Math.max(...known.map((c) => c.cat)) : null;
  const bestScore = known.filter((c) => c.cat === bestCat && c.exact).reduce((m, c) => Math.max(m, c.score), -Infinity);
  return cols.map((c) => {
    if (!c) return null;
    if (c.cat === null || c.cat === undefined) return { text: "…", cls: "wait" };
    const d = c.exact ? describeScore(c.score, moves, W, H) : null;
    const isBest = c.cat === bestCat && (!c.exact || bestScore === -Infinity || c.score === bestScore);
    if (c.cat === 2) return { text: "Win", sub: d ? "in " + d.turns : "", cls: (isBest ? "w1" : "w2") + (isBest ? " best" : "") };
    if (c.cat === 1) return { text: "Draw", cls: "d" + (isBest ? " best" : "") };
    return { text: "Lose", sub: d ? "in " + d.turns : "", cls: (isBest ? "l2 best" : "l1") };
  });
}

/** "column 4", "column 2 or 6", or "any column" when more than three are equal. */
export function colList(cols) { return cols.length > 3 ? "any column" : "column " + cols.map((c) => c + 1).join(" or "); }

/** Best columns (and a sentence) from the solver result. */
export function bestLine(cols, moves, W, H) {
  const known = cols.map((c, i) => ({ ...c, i })).filter((c) => c && c.cat !== null && c.cat !== undefined);
  if (!known.length) return null;
  const bestCat = Math.max(...known.map((c) => c.cat));
  let best = known.filter((c) => c.cat === bestCat);
  const ex = best.filter((c) => c.exact);
  if (ex.length) { const m = Math.max(...ex.map((c) => c.score)); best = ex.filter((c) => c.score === m); }
  const d = best[0].exact ? describeScore(best[0].score, moves, W, H) : null;
  return { cols: best.map((c) => c.i), cat: bestCat, d };
}

/** Pop Out search values -> chips (best drop per column) + best move. */
export const PWIN = 100000;
export function popChips(vals, W) {
  const chips = new Array(W).fill(null);
  if (!vals || !vals.length) return { chips, best: null };
  // equal values: a plain drop first (it keeps the power discs and pops for later)
  const best = vals.reduce((a, b) => (b.v > a.v || (b.v === a.v && !b.w && !b.p && (a.w || a.p)) ? b : a));
  for (const x of vals) {
    if (x.p || x.w) continue; // pops and power discs aren't drops: the verdict line names them
    chips[x.c] = popChip(x.v, x.v === best.v);
  }
  return { chips, best, bestPop: best.p ? best : null };
}
function popChip(v, isBest) {
  if (v >= PWIN - 200) { const ply = PWIN - v; return { text: "Win", sub: "in " + Math.ceil((ply + 1) / 2), cls: "w1" + (isBest ? " best" : "") }; }
  if (v <= -(PWIN - 200)) { const ply = PWIN + v; return { text: "Lose", sub: "in " + Math.ceil(ply / 2), cls: "l1" }; }
  const s = Math.round(v / 5);
  return { text: (s > 0 ? "+" : s < 0 ? "−" : "") + Math.abs(s), cls: (s >= 2 ? "w2" : s <= -2 ? "l2" : "d") + (isBest ? " best" : "") };
}
