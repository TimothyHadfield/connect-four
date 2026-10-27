// Visibility checks (2026-10-21): the board fills the screen, chips and holes are readable,
// nothing overflows, taps land on the right column. Headless WebKit (or Chrome).
//   node tools/layout.mjs [url] [webkit|chrome]     default: the live site, webkit
// Prints PASS/FAIL per check; exit code 1 if any fails.
import { createRequire } from "node:module";
import { game } from "../js/game.js";
const require = createRequire("C:/Users/timha/.claude/tools/package.json");
const pw = require("playwright");

const URL = process.argv[2] || "https://timothyhadfield.github.io/connect-four/";
const ENGINE = process.argv[3] || "webkit";
const b = await pw[ENGINE === "chrome" ? "chromium" : "webkit"].launch();
let fails = 0;
const check = (name, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${info ? " · " + info : ""}`); if (!ok) fails++; };

// seeded random legal games with no four in a row (a crowded late-game board)
let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
function quietGame(size, n, popout = false) {
  for (;;) {
    let s = game.setup(2, { size, popout, first: 0 });
    const moves = [];
    let spins = 0;
    while (moves.length < n && spins < 400) {
      const legal = [];
      for (let c = 0; c < s.W; c++) if (!s.cells[c * s.H + s.H - 1]) legal.push(c);
      if (!legal.length) break;
      const c = legal[Math.floor(rnd() * legal.length)];
      const t = JSON.parse(JSON.stringify(s));
      game.apply(t, s.turn, { c });
      if (t.result) { spins++; continue; }
      moves.push({ s: s.turn, c }); s = t;
    }
    if (moves.length === n) return moves;
  }
}
const cur = (mode, size, moves, popout = false) => ({ mode, id: 1, level: "medium", options: { size, popout, first: 0, level: "medium" }, names: mode === "computer" ? ["You", "Computer"] : ["Red", "Yellow"], moves });
const base = { level: "medium", starts: "you", showSolver: true, chipsV: 2, anim: false };

const SIZES = {
  phone: { viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  small: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  land: { viewport: { width: 659, height: 393 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  laptop: { viewport: { width: 1280, height: 800 } },
  big: { viewport: { width: 1440, height: 900 } },
};
if (ENGINE === "chrome") for (const k in SIZES) delete SIZES[k].isMobile;

async function open(size, ls, tab) {
  const ctx = await b.newContext(SIZES[size]);
  await ctx.addInitScript((v) => { try { if (!sessionStorage.getItem("_s")) { localStorage.setItem("c4:v1", v); localStorage.setItem("coach-offer:c4-first", "1"); sessionStorage.setItem("_s", "1"); } } catch (e) {} }, JSON.stringify(ls));
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") p.errs.push(m.text()); });
  await p.goto(URL);
  // a local python server sometimes refuses one connection under load: reload once
  if (!(await p.waitForSelector("#pboard svg", { timeout: 15000 }).catch(() => null))) { p.errs.length = 0; await p.reload(); await p.waitForSelector("#pboard svg", { timeout: 20000 }); }
  if (tab) await p.click(`nav.tabs button[data-tab=${tab}]`);
  await p.waitForTimeout(900);
  return p;
}
// what the board really draws: viewBox scaled to fit its box ("meet")
const measure = (p) => p.evaluate(() => {
  const tab = document.querySelector(".tab.active"), svg = tab.querySelector(".board-svg:not([hidden])");
  const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, k = Math.min(r.width / vb.width, r.height / vb.height);
  const off = [];
  tab.querySelectorAll("*").forEach((e) => { const q = e.getBoundingClientRect(); if (q.width && q.height && e.offsetParent !== null && !e.closest(".moves") && (q.right > innerWidth + 1 || q.bottom > innerHeight + 1 || q.left < -1)) off.push(e.id || String(e.className.baseVal ?? e.className)); });
  const chip = [...svg.querySelectorAll(".chip-t")].map((t) => t.getBoundingClientRect().height);
  const chipFit = [...svg.querySelectorAll(".chip")].every((g) => { const rr = g.querySelector("rect").getBBox(); return [...g.querySelectorAll("text")].every((t) => t.getBBox().width <= rr.width - 4); });
  return { share: (vb.width * k * vb.height * k) / (innerWidth * innerHeight), hole: 78 * k, col: 100 * k, chipPx: 25 * k, chipFontPx: k * parseFloat(getComputedStyle(svg.querySelector(".chip-t") || svg).fontSize), chipN: chip.length, chipFit,
    over: document.documentElement.scrollWidth > innerWidth || document.scrollingElement.scrollHeight > innerHeight + 1, off: [...new Set(off)].slice(0, 4) };
});
const f1 = (x) => Math.round(x * 10) / 10;

// a finished game (saved history keeps only games that ended) of at least n moves
function finishedGame(n) {
  for (;;) {
    const moves = quietGame("7x6", n);
    let s = game.setup(2, { size: "7x6", popout: false, first: 0 });
    for (const m of moves) game.apply(s, m.s, { c: m.c });
    while (!s.result) {
      const legal = [];
      for (let c = 0; c < s.W; c++) if (!s.cells[c * s.H + s.H - 1]) legal.push(c);
      const c = legal[Math.floor(rnd() * legal.length)];
      moves.push({ s: s.turn, c }); game.apply(s, s.turn, { c });
    }
    if (s.result.winner >= 0) return moves;
  }
}
const late7 = quietGame("7x6", 36), late9 = quietGame("9x7", 50), study30 = finishedGame(28);
// minimum sizes per screen (before this pass: landscape Play hole 19 px, Table 15, Study 3.5; laptop Play share 0.26)
const want = {
  phone: { hole: 33, share: 0.45 },
  small: { hole: 26, share: 0.38 },
  land: { hole: 26, share: 0.24 },
  laptop: { hole: 58, share: 0.33 },
  big: { hole: 68, share: 0.36 },
};
for (const size of Object.keys(SIZES)) {
  for (const [name, ls, tab, scale] of [
    ["Play 7x6 late", { ...base, current: cur("computer", "7x6", late7) }, null, 1],
    ["Play 9x7 late", { ...base, size: "9x7", current: cur("computer", "9x7", late9) }, null, 0.8],
    ["Table", { ...base }, "table", 1],
    // a real-length game (30 moves: the move list is long); before the one-row move list, 393 px Study gave hole 26.5 px, share 27%
    ["Study", { ...base, history: [{ id: 2, date: "2026-10-20", mode: "friends", opts: { size: "7x6", popout: false, first: 0 }, names: ["Red", "Yellow"], you: -1, moves: study30 }] }, "study", size === "small" ? 0.6 : size === "phone" ? 0.85 : 0.9],
  ]) {
    const p = await open(size, ls, tab);
    await p.waitForTimeout(tab ? 300 : 0);
    if (!tab) await p.waitForSelector("#pboard .chip-t", { timeout: 10000 }).catch(() => {}); // the solver's chips can take a moment
    const m = await measure(p);
    const w = want[size];
    check(`${size} ${name}: board fills the screen`, m.hole >= w.hole * scale && m.share >= w.share * scale, `hole ${f1(m.hole)} px (want ${f1(w.hole * scale)}), share ${f1(m.share * 100)}% (want ${f1(w.share * scale * 100)}%)`);
    check(`${size} ${name}: no overflow, nothing off screen, no errors`, !m.over && !m.off.length && !p.errs.length, `${m.off.join(",")} ${p.errs.join(" | ")}`);
    if (tab === "study") {
      // the move you are on is in view inside the move list (it may scroll sideways on a phone)
      await p.click("#stMoves .mv:nth-child(12)");
      await p.waitForTimeout(300);
      const vis = await p.evaluate(() => { const l = document.querySelector("#stMoves").getBoundingClientRect(), c = document.querySelector("#stMoves .mv.cur").getBoundingClientRect(); return c.left >= l.left - 1 && c.right <= l.right + 1 && c.top >= l.top - 1 && c.bottom <= l.bottom + 1; });
      check(`${size} ${name}: current move visible in the move list`, vis);
    }
    if (!tab && m.chipN) check(`${size} ${name}: chip words fit their chips`, m.chipFit);
    if (!tab && name.includes("7x6") && (size === "phone" || size === "laptop" || size === "big")) check(`${size} ${name}: chip text ≥ 13 px`, m.chipFontPx >= 13, `${f1(m.chipFontPx)} px`);
    await p.context().close();
  }
  // a tap at the middle of each column drops the disc in that column (friends mode, empty 7x6)
  {
    const p = await open(size, { ...base, current: null });
    await p.evaluate(async () => { const s = (await import(document.querySelector('script[src*="app.js"]').src)); s.newLocalGame("friends"); });
    await p.waitForTimeout(400);
    const got = [];
    for (const c of [0, 3, 6]) {
      const pt = await p.evaluate((c) => { const r = document.querySelector(`#pboard .hit[data-col="${c}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.75 }; }, c);
      if (SIZES[size].hasTouch) await p.touchscreen.tap(pt.x, pt.y); else await p.mouse.click(pt.x, pt.y);
      await p.waitForTimeout(450);
      got.push(await p.evaluate(async () => { const s = (await import(document.querySelector('script[src*="app.js"]').src)).P; const m = s.snap.pub.moves; return m.length ? m[m.length - 1].c : -1; }));
    }
    check(`${size}: taps land on the tapped column`, got.join() === "0,3,6", `got ${got}`);
    await p.context().close();
  }
}
await b.close();
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
