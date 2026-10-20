/* Background thinker: computer moves and the solver's verdicts run here so the
 * page never freezes. Module worker. Messages:
 *   {type:"init", W, H, bits}                      -> {type:"ready", fast, book}
 *   {type:"move", id, pub, seat, level}            -> {type:"move", id, move}
 *   {type:"analyze", id, cells, W, H, toMove, firstDisc, popout, depth}
 *        -> {type:"analysis", id, cols, done}      (several, as columns resolve)
 */
import { makeFast, fitsWasm } from "./fast.js";
import { decodeBook } from "./book.js";
import { useFast, useBook, analyzeColumns, botMove, popValues } from "./ai.js";

let size = "";
let wasmBytes = null;
let book = null;

async function init(W, H, bits = 21) {
  const key = W + "x" + H;
  if (size === key) return;
  size = key;
  let fast = null;
  if (fitsWasm(W, H)) {
    try {
      if (!wasmBytes) wasmBytes = await (await fetch(new URL("./solver.wasm", import.meta.url))).arrayBuffer();
      fast = await makeFast(wasmBytes, W, H, bits);
    } catch (e) { fast = null; }
  }
  useFast(fast);
  if (W === 7 && H === 6 && !book) {
    try { book = decodeBook(new Uint8Array(await (await fetch(new URL("../data/book7x6.bin", import.meta.url))).arrayBuffer())); } catch (e) { book = null; }
  }
  useBook(W === 7 && H === 6 ? book : null);
  return { fast: !!fast, book: !!(W === 7 && H === 6 && book) };
}

let queue = Promise.resolve();
self.onmessage = (ev) => {
  const m = ev.data;
  queue = queue.then(() => handle(m)).catch((e) => self.postMessage({ type: "error", id: m.id, message: String(e && e.message || e) }));
};

async function handle(m) {
  if (m.type === "init") {
    const r = await init(m.W, m.H, m.bits);
    self.postMessage({ type: "ready", ...(r || {}) });
  } else if (m.type === "move") {
    await init(m.pub.W, m.pub.H, m.bits);
    const move = botMove(m.pub, m.seat, m.level);
    self.postMessage({ type: "move", id: m.id, move });
  } else if (m.type === "analyze") {
    await init(m.W, m.H, m.bits);
    if (m.popout) {
      const vals = popValues(m.cells, m.W, m.H, m.toMove, m.depth || 5);
      self.postMessage({ type: "analysis", id: m.id, pop: vals, done: true });
      return;
    }
    let last = 0;
    const cols = analyzeColumns(m.cells, m.W, m.H, m.toMove, m.firstDisc,
      { weakBudget: m.weakBudget || 6e7, strongBudget: m.strongBudget || 2e7 },
      (partial, force) => { const now = Date.now(); if (force || now - last > 60) { last = now; self.postMessage({ type: "analysis", id: m.id, cols: partial, done: false }); } });
    self.postMessage({ type: "analysis", id: m.id, cols, done: true });
  }
}
