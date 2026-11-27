// Fit pass (2026-11-27): "can I actually see everything?" on a nearly full board.
// Checks at 393x659, 320x568, 659x393 (phone on its side), 1280x800, 1440x900, in headless WebKit:
//   - the board is as big as the screen allows (no big empty wood beside a small board)
//   - each column's tap target is >= 36 px wide
//   - status, player plates (names, scores, discs left) and buttons are readable (>= 12 px) and tappable (>= 36 px)
//   - no page scroll, nothing off screen, no console errors
//   node tests/fit-ui.mjs [url] [shotDir]        default url: the live site
// Exit code 1 if any check fails. Not part of `npm test` (needs a browser and a server).
import { createRequire } from "node:module";
import { game } from "../js/game.js";
const require = createRequire("C:/Users/timha/.claude/tools/package.json");
const pw = require("playwright");

const URL = process.argv[2] || "https://timothyhadfield.github.io/connect-four/";
const SHOTS = process.argv[3] || "";
const b = await pw.webkit.launch();
let fails = 0;
const check = (name, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${info ? " · " + info : ""}`); if (!ok) fails++; };
const f1 = (x) => Math.round(x * 10) / 10;

// seeded random legal game with no four in a row: n discs on the board (7x6 holds 42)
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
function quietGame(size, n) {
  for (;;) {
    let s = game.setup(2, { size, popout: false, first: 0 });
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
const base = { level: "medium", starts: "you", showSolver: true, chipsV: 2, anim: false, score: [5, 3] };
const crowded = quietGame("7x6", 38);
const STATES = {
  crowded: { ...base, current: { mode: "computer", id: 1, level: "medium", options: { size: "7x6", popout: false, first: 0, level: "medium" }, names: ["You", "Computer"], moves: crowded } },
  early: { ...base, current: { mode: "computer", id: 1, level: "medium", options: { size: "7x6", popout: false, first: 0, level: "medium" }, names: ["You", "Computer"], moves: crowded.slice(0, 4) } },
};
const SIZES = {
  phone: { viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  small: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  land: { viewport: { width: 659, height: 393 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  laptop: { viewport: { width: 1280, height: 800 } },
  big: { viewport: { width: 1440, height: 900 } },
};

async function open(size, ls) {
  const ctx = await b.newContext(SIZES[size]);
  await ctx.addInitScript((v) => { try { if (!sessionStorage.getItem("_s")) { localStorage.setItem("c4:v1", v); localStorage.setItem("coach-offer:c4-first", "1"); localStorage.setItem("coach:offer:c4-first", "1"); sessionStorage.setItem("_s", "1"); } } catch (e) {} }, JSON.stringify(ls));
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") p.errs.push(m.text()); });
  await p.goto(URL);
  if (!(await p.waitForSelector("#pboard svg", { timeout: 15000 }).catch(() => null))) { p.errs.length = 0; await p.reload(); await p.waitForSelector("#pboard svg", { timeout: 20000 }); }
  await p.waitForSelector("#pboard .chip-t", { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(900);
  return p;
}

const measure = (p) => p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && e.offsetParent !== null; };
  const svg = document.querySelector("#pboard .board-svg:not([hidden])") || document.querySelector("#pboard svg");
  const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, k = Math.min(r.width / vb.width, r.height / vb.height);
  const drawn = { w: vb.width * k, h: vb.height * k };
  const hits = [...svg.querySelectorAll(".hit")].map((h) => h.getBoundingClientRect().width);
  // smallest text inside status, verdict and the two player plates (names, score, discs left)
  const texts = [];
  for (const sel of ["#pstatus", "#pverdict", ".pl"]) document.querySelectorAll(sel).forEach((root) => {
    [root, ...root.querySelectorAll("*")].forEach((e) => {
      if (!vis(e) || e.closest("svg")) return;
      const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own) texts.push({ sel, t: e.textContent.trim().slice(0, 24), px: parseFloat(getComputedStyle(e).fontSize) });
    });
  });
  const minText = texts.reduce((m, x) => (x.px < m.px ? x : m), { px: 99, t: "" });
  // a "?" draws 19 px but its ::after tap area reaches out 11 px each side
  const pad = (e) => { const a = getComputedStyle(e, "::after"); return a.content && a.content !== "none" && a.position === "absolute" ? -2 * parseFloat(a.top || 0) : 0; };
  const btns = [...document.querySelectorAll("#pactions button, #tab-play .tabletop button")].filter(vis).map((e) => { const q = e.getBoundingClientRect(), x = pad(e); return { t: (e.textContent.trim() || e.getAttribute("aria-label") || "").slice(0, 14), w: q.width + x, h: q.height + x }; });
  const minBtn = btns.reduce((m, x) => (Math.min(x.h, x.w) < Math.min(m.h, m.w) ? x : m), { h: 99, w: 99, t: "" });
  const off = [];
  document.querySelectorAll("#tab-play *").forEach((e) => { const q = e.getBoundingClientRect(); if (q.width && q.height && e.offsetParent !== null && (q.right > innerWidth + 1 || q.bottom > innerHeight + 1 || q.left < -1 || q.top < -1)) off.push(e.id || String(e.className.baseVal ?? e.className)); });
  return {
    col: 100 * k, hole: 78 * k, drawnW: drawn.w, drawnH: drawn.h, vw: innerWidth, vh: innerHeight,
    hitMin: hits.length ? Math.min(...hits) : 0, minText, minBtn,
    over: document.documentElement.scrollWidth > innerWidth || document.scrollingElement.scrollHeight > innerHeight + 1,
    off: [...new Set(off)].slice(0, 4),
  };
});

// column width and the board's share of the screen's limiting side. Build 15 (before this pass):
// phone 45.5 px / 92% of width, small 35.5 px, land 33.8 px / 66% of height (buttons row under the
// table, empty wood beside the board), laptop 83 px / 80%, big 96 px / 82%; plate captions 10 px.
const want = {
  phone: { col: 44, wShare: 0.88 },
  small: { col: 36, wShare: 0.86 },
  land: { col: 38, hShare: 0.74 },
  laptop: { col: 80, hShare: 0.70 },
  big: { col: 92, hShare: 0.70 },
};
for (const size of Object.keys(SIZES)) {
  for (const st of Object.keys(STATES)) {
    const p = await open(size, STATES[st]);
    const m = await measure(p);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${size}-${st}.png` });
    const w = want[size];
    const wS = m.drawnW / m.vw, hS = m.drawnH / m.vh;
    const shareOk = w.wShare ? wS >= w.wShare : hS >= w.hShare;
    check(`${size} ${st}: board as big as the screen allows`, shareOk && m.col >= w.col, `column ${f1(m.col)} px (want ${w.col}), board ${f1(m.drawnW)}x${f1(m.drawnH)} = ${f1(wS * 100)}% of width, ${f1(hS * 100)}% of height`);
    check(`${size} ${st}: column tap targets >= 36 px wide`, m.hitMin >= 36, `${f1(m.hitMin)} px`);
    check(`${size} ${st}: status + plates text >= 12 px`, m.minText.px >= 12, `smallest ${m.minText.px} px "${m.minText.t}"`);
    check(`${size} ${st}: buttons >= 36 px`, Math.min(m.minBtn.h, m.minBtn.w) >= 36, `smallest "${m.minBtn.t}" ${f1(m.minBtn.w)}x${f1(m.minBtn.h)}`);
    check(`${size} ${st}: no page scroll, nothing off screen, no errors`, !m.over && !m.off.length && !p.errs.length, `${m.off.join(",")} ${p.errs.join(" | ")}`);
    await p.context().close();
  }
}
await b.close();
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
