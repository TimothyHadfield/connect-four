// Step 1 of the book: find every 8-disc position (first player to move) that Tromp's
// database leaves out because the move is forced, and solve them in parallel.
//   node tools/forced-solve.mjs <connect-4.data> <cache.json> [threads]
// The cache is written as it goes, so the job can be stopped and resumed.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { makeFast } from "../js/fast.js";
import { bookKey } from "../js/book.js";
import { winsAt } from "../js/rules.js";

const W = 7, H = 6;

if (isMainThread) {
  const [src, cachePath, thr] = process.argv.slice(2);
  const threads = +thr || 8;
  const db = new Set();
  for (const line of readFileSync(src, "utf8").trim().split(/\r?\n/)) {
    const f = line.split(",");
    db.add(bookKey(f.slice(0, 42).map((x) => (x === "x" ? 1 : x === "o" ? 2 : 0))));
  }
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
  // enumerate depth-8 positions with no win on the board and no immediate win for the side to move
  const todo = new Map();
  const seen = new Set();
  const cells = new Array(42).fill(0);
  const canWinNow = (p) => { for (let c = 0; c < W; c++) { let r = 0; while (r < H && cells[c * H + r]) r++; if (r >= H) continue; cells[c * H + r] = p; const w = winsAt(cells, W, H, c, r, p); cells[c * H + r] = 0; if (w) return true; } return false; };
  (function walk(depth) {
    const k = bookKey(cells);
    if (seen.has(k)) return; seen.add(k);
    const p = depth % 2 === 0 ? 1 : 2;
    if (depth === 8) { if (!db.has(k) && !canWinNow(1) && !(k in cache)) todo.set(k, cells.slice()); return; }
    for (let c = 0; c < W; c++) {
      let r = 0; while (r < H && cells[c * H + r]) r++;
      if (r >= H) continue;
      cells[c * H + r] = p;
      if (!winsAt(cells, W, H, c, r, p)) walk(depth + 1);
      cells[c * H + r] = 0;
    }
  })(0);
  console.log(`to solve: ${todo.size} (already cached ${Object.keys(cache).length})`);
  const jobs = [...todo.entries()];
  let next = 0, done = 0, active = 0;
  const t0 = Date.now();
  let lastSave = Date.now();
  const save = () => writeFileSync(cachePath, JSON.stringify(cache));
  for (let i = 0; i < threads; i++) {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: {} });
    active++;
    const feed = () => { if (next < jobs.length) { const [k, c] = jobs[next++]; w.postMessage({ k, c }); } else { w.terminate(); if (--active === 0) { save(); console.log("all done", done); } } };
    w.on("message", ({ k, s }) => {
      if (k !== undefined) {
        cache[k] = s; done++;
        if (done % 200 === 0) console.log(`${done}/${jobs.length} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
        if (Date.now() - lastSave > 30000) { save(); lastSave = Date.now(); }
      }
      feed();
    });
  }
} else {
  const F = await makeFast(readFileSync(new URL("../js/solver.wasm", import.meta.url)), W, H, 22);
  parentPort.on("message", ({ k, c }) => {
    const s = F.solve(c, 1, { weak: true });
    parentPort.postMessage({ k, s: s > 0 ? 2 : s === 0 ? 1 : 0 });
  });
  parentPort.postMessage({});
}
