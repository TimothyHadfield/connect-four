// Measures the computer levels against each other on the classic 7x6 board and
// writes js/strength-data.js (the "How strong?" table).
// Each pairing plays random 2-disc openings, every opening twice with colours swapped,
// so deterministic levels don't just repeat one game.
//   node tools/strength.mjs [gamesPerPair=200] [threads=8]
import { readFileSync, writeFileSync } from "node:fs";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { game } from "../js/game.js";
import { makeFast } from "../js/fast.js";
import { decodeBook } from "../js/book.js";
import { useFast, useBook, botMove, LEVELS, bookCategory } from "../js/ai.js";

const RANDOM = "random";

if (isMainThread) {
  const per = +(process.argv[2] || 200), threads = +(process.argv[3] || 8);
  const players = [...LEVELS, RANDOM];
  const jobs = [];
  let seed = 99;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i], b = players[j];
    if (a === RANDOM || b === RANDOM) { if (b !== RANDOM) continue; }
    const n = b === RANDOM ? Math.max(40, per / 4) : (a === "perfect" ? Math.max(40, per / 2) : per);
    for (let k = 0; k < n / 2; k++) {
      const open = [Math.floor(rnd() * 7), Math.floor(rnd() * 7)];
      const s = Math.floor(rnd() * 1e9);
      jobs.push({ a, b, aFirst: true, open, seed: s }, { a, b, aFirst: false, open, seed: s + 1 });
    }
  }
  console.log(`${jobs.length} games on ${threads} threads`);
  const pairs = {}, random = {}, perf = { games: 0, worse: 0, lostOpenings: 0 };
  let next = 0, done = 0, active = 0;
  const t0 = Date.now();
  const finish = () => {
    const levels = LEVELS;
    const rnd2 = {};
    for (const l of levels) { const p = random[l]; if (p) rnd2[l] = `${Math.round(100 * (p.w + p.d / 2) / p.n)}%`; }
    const data = { levels, pairs, random: rnd2, perfect: perf, games: done, date: new Date().toISOString().slice(0, 10),
      note: "each opening played twice with colours swapped; Rand = score against a player choosing columns at random." };
    writeFileSync(new URL("../js/strength-data.js", import.meta.url), `// Written by tools/strength.mjs. Do not edit by hand.\nexport const STRENGTH = ${JSON.stringify(data, null, 1)};\n`);
    console.log(JSON.stringify(data, null, 1));
    console.log(`done in ${Math.round((Date.now() - t0) / 1000)} s`);
  };
  for (let t = 0; t < threads; t++) {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: {} });
    active++;
    const feed = () => { if (next < jobs.length) w.postMessage(jobs[next++]); else { w.terminate(); if (--active === 0) finish(); } };
    w.on("message", (r) => {
      done++;
      const { a, b, res, openA } = r; // res from a's view: 1 win, 0.5 draw, 0 loss
      // Did "perfect" ever end worse than the opening's true value?
      const valRes = res === 1 ? 2 : res === 0.5 ? 1 : 0;
      if (a === "perfect") { perf.games++; if (valRes < openA) perf.worse++; if (openA === 0) perf.lostOpenings++; }
      if (b === "perfect") { perf.games++; if (2 - valRes < 2 - openA) perf.worse++; if (openA === 2) perf.lostOpenings++; }
      const rec = (map, k, v) => { const x = (map[k] ||= { w: 0, d: 0, n: 0 }); x.n++; if (v === 1) x.w++; else if (v === 0.5) x.d++; };
      if (b === RANDOM) rec(random, a, res);
      else { rec(pairs, `${a}>${b}`, res); rec(pairs, `${b}>${a}`, 1 - res); }
      if (done % 100 === 0) console.log(`${done}/${jobs.length} ${Math.round((Date.now() - t0) / 1000)} s`);
      feed();
    });
    feed();
  }
} else {
  const fast = await makeFast(readFileSync(new URL("../js/solver.wasm", import.meta.url)), 7, 6, 22);
  useFast(fast);
  useBook(decodeBook(new Uint8Array(readFileSync(new URL("../data/book7x6.bin", import.meta.url)))));
  parentPort.on("message", (job) => {
    let seed = job.seed;
    const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
    let s = game.setup(2, { first: 0 });
    const aSeat = job.aFirst ? 0 : 1;
    for (const c of job.open) s = game.apply(s, s.turn, { c });
    // true value of the opening for player a (2 win, 1 draw, 0 loss), from the book
    const cat = bookCategory(s.cells, 7, 6, s.turn === 0 ? 1 : 2, 1);
    const openA = s.turn === aSeat ? cat : 2 - cat;
    while (!s.result) {
      const lvl = s.turn === aSeat ? job.a : job.b;
      let m;
      if (lvl === RANDOM) { const open = []; for (let c = 0; c < 7; c++) if (!s.cells[c * 6 + 5]) open.push(c); m = { c: open[Math.floor(rng() * open.length)] }; }
      else m = botMove(game.publicView(s), s.turn, lvl, rng);
      s = game.apply(s, s.turn, m);
    }
    const w = s.result.winner;
    parentPort.postMessage({ a: job.a, b: job.b, openA, res: w < 0 ? 0.5 : w === aSeat ? 1 : 0 });
  });
}
