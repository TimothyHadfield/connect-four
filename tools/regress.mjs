// Browser regression checks for the QA bugs of 2026-10-20 (headless WebKit, iPhone size).
//   node tools/regress.mjs [url]      default: the live site
// Prints PASS/FAIL per check; exit code 1 if any fails.
import { createRequire } from "node:module";
const require = createRequire("C:/Users/timha/.claude/tools/package.json");
const { webkit, devices } = require("playwright");

const URL = process.argv[2] || "https://timothyhadfield.github.io/connect-four/";
const b = await webkit.launch();
let fails = 0;
const check = (name, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${info ? " · " + info : ""}`); if (!ok) fails++; };

async function open(ls, viewport) {
  const ctx = await b.newContext({ ...devices["iPhone 15"], ...(viewport ? { viewport } : {}) });
  if (ls !== undefined) await ctx.addInitScript((v) => { try { if (!sessionStorage.getItem("_seeded")) { localStorage.setItem("c4:v1", v); sessionStorage.setItem("_seeded", "1"); } } catch (e) {} }, typeof ls === "string" ? ls : JSON.stringify(ls));
  const p = await ctx.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") p.errs.push(m.text()); });
  await p.goto(URL);
  await p.waitForSelector("#pboard svg", { timeout: 20000 });
  await p.waitForTimeout(600);
  return p;
}
const pub = (p) => p.evaluate(async () => {
  const src = document.querySelector('script[src*="app.js"]').src;
  const s = (await import(src)).P.snap?.pub;
  return s ? { moves: s.moves.length, result: s.result, turn: s.turn, size: s.size, cells: s.cells, H: s.H } : null;
});
const status = (p) => p.textContent("#pstatus");
const toastText = (p) => p.evaluate(() => { const t = document.querySelector("#toast"); return t.classList.contains("show") ? t.textContent : ""; });
const click = (p, sel) => p.evaluate((s) => document.querySelector(s).click(), sel);

// 1a. New game (computer starts) while the computer is still thinking: the computer must move.
{
  const p = await open({ level: "strong", starts: "you" });
  await p.click("#pboard .hit[data-col='3']");
  await p.waitForTimeout(60);
  await p.evaluate(() => { document.querySelector("#bNew").click(); document.querySelector("#ngStart button[data-k='computer']").click(); document.querySelector("[data-go]").click(); });
  await p.waitForTimeout(6000);
  const s = await pub(p);
  check("computer moves after New game mid-think", s.moves >= 1, `moves=${s.moves} status="${(await status(p)).trim()}"`);
  await p.context().close();
}
// 1b. Board size changed in Settings while the computer thinks.
{
  const p = await open({ level: "strong", starts: "computer" });
  await p.waitForFunction(() => /Your turn/.test(document.querySelector("#pstatus").textContent), null, { timeout: 15000 });
  await p.click("#pboard .hit[data-col='3']");
  await p.waitForTimeout(80);
  await click(p, "nav.tabs button[data-tab='settings']");
  await click(p, "#sSize button[data-k='6x5']");
  await click(p, "nav.tabs button[data-tab='play']");
  await p.waitForTimeout(6000);
  const s = await pub(p);
  // build 9: you'd already played, so leaving would count as a loss: the game stays, the new size waits for the next game
  check("size change mid-game keeps the game and the computer still answers", s.moves >= 3 && s.size === "7x6", `size=${s.size} moves=${s.moves}`);
  await p.context().close();
}
// 1c. Board size changed while the computer thinks its first move (you haven't played): new board at once.
{
  const p = await open({ level: "strong", starts: "computer" });
  await click(p, "nav.tabs button[data-tab='settings']");
  await click(p, "#sSize button[data-k='6x5']");
  await click(p, "nav.tabs button[data-tab='play']");
  await p.waitForTimeout(6000);
  const s = await pub(p);
  check("computer moves after size change mid-think", s.moves >= 1 && s.size === "6x5", `size=${s.size} moves=${s.moves}`);
  await p.context().close();
}
// 2. Reload mid-game keeps the game.
{
  const p = await open({ level: "beginner", starts: "you" });
  for (const c of [3, 2]) {
    await p.waitForFunction(() => /Your turn/.test(document.querySelector("#pstatus").textContent), null, { timeout: 15000 });
    await p.click(`#pboard .hit[data-col='${c}']`);
    await p.waitForTimeout(1500);
  }
  const before = await pub(p);
  await p.reload(); await p.waitForSelector("#pboard svg"); await p.waitForTimeout(1500);
  const after = await pub(p);
  check("reload keeps the game", after.moves === before.moves && JSON.stringify(after.cells) === JSON.stringify(before.cells), `${before.moves} -> ${after.moves}`);
  await p.context().close();
}
// 3 + 4. Broken saved data: Play still shows a board, Study opens without errors.
for (const [name, ls] of [
  ["record null", { record: null }],
  ["history null", { history: null }],
  ["history illegal column", { history: [{ id: 1, opts: { size: "7x6" }, moves: [{ s: 0, c: 99 }], winner: 0 }] }],
  ["garbage", "{not json"],
]) {
  const p = await open(ls);
  const hits = await p.$$eval("#pboard .hit", (e) => e.length);
  await click(p, "nav.tabs button[data-tab='study']");
  await p.waitForTimeout(800);
  check(`saved data "${name}": page works`, hits > 0 && p.errs.length === 0, p.errs.join(" | "));
  await p.context().close();
}
// 5. Undo after a finished game must not count the result twice.
{
  const p = await open({ level: "perfect", starts: "computer" });
  const loseOnce = async () => {
    for (let g = 0; g < 60; g++) {
      const s = await pub(p);
      if (s.result) return;
      if (!/Your turn/.test(await status(p))) { await p.waitForTimeout(300); continue; }
      let c = 0; while (s.cells[c * s.H + s.H - 1]) c++;
      await p.click(`#pboard .hit[data-col='${c}']`); await p.waitForTimeout(500);
    }
  };
  await loseOnce();
  const rec = async () => p.evaluate(() => { const r = JSON.parse(localStorage.getItem("c4:v1")).record; return Object.values(r).reduce((a, x) => a + x.w + x.d + x.l, 0); });
  const r1 = await rec();
  const undoOff = await p.$eval("#bUndo", (e) => e.disabled);
  if (!undoOff) { await click(p, "#bUndo"); await p.waitForTimeout(1200); await loseOnce(); }
  const r2 = await rec();
  check("undo at game over doesn't count twice", r1 === 1 && r2 === 1, `results counted: ${r1} then ${r2}`);
  await p.context().close();
}
// 6. Hint with the solver hidden, classic board.
{
  const p = await open({ level: "beginner", starts: "you", showSolver: false });
  await click(p, "#bHint");
  let t = "";
  for (let i = 0; i < 40 && !/^Best/.test(t); i++) { await p.waitForTimeout(250); t = await toastText(p); }
  const pick = await p.$$eval("#pboard .pick", (e) => e.length);
  check("hint works with the solver off on 7x6", /^Best/.test(t) && pick > 0, `toast="${t}" picked=${pick}`);
  await p.context().close();
}
// 7. 320 px: Study stepper fits.
{
  const p = await open({}, { width: 320, height: 640 });
  await click(p, "nav.tabs button[data-tab='study']");
  await p.waitForTimeout(500);
  const r = await p.$eval("#stLast", (e) => e.getBoundingClientRect().right);
  check("320px: last-move button visible", r <= 320, `right=${Math.round(r)}`);
  await p.context().close();
}
// 8. Table keeps one board per size.
{
  const p = await open({ size: "7x6" });
  await click(p, "nav.tabs button[data-tab='table']");
  await p.click("#tboard .hit[data-col='0']");
  await click(p, "nav.tabs button[data-tab='settings']"); await click(p, "#sSize button[data-k='6x5']");
  await click(p, "nav.tabs button[data-tab='table']");
  await p.click("#tboard .hit[data-col='1']");
  await click(p, "nav.tabs button[data-tab='settings']"); await click(p, "#sSize button[data-k='7x6']");
  await click(p, "nav.tabs button[data-tab='table']");
  await p.waitForTimeout(300);
  const n = await p.$$eval("#tboard .disc", (e) => e.length);
  check("table keeps the 7x6 board after visiting 6x5", n === 1, `discs=${n}`);
  await p.context().close();
}
// 9. A tap while the computer's disc is still falling is not lost.
{
  const p = await open({ level: "beginner", starts: "you", anim: true });
  await p.click("#pboard .hit[data-col='3']");
  // the moment the computer's disc appears (still falling), tap column 0
  const r = await p.evaluate(async () => {
    const P = (await import(document.querySelector('script[src*="app.js"]').src)).P;
    for (let i = 0; i < 400 && P.snap.pub.moves.length < 2; i++) await new Promise((r) => setTimeout(r, 5));
    const falling = P.animUntil - performance.now();
    document.querySelector("#pboard .hit[data-col='0']").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return { falling: Math.round(falling) };
  });
  await p.waitForTimeout(1500);
  const m = (await pub(p)).moves;
  check("tap during the falling disc still counts", m >= 3, `disc still falling for ${r.falling} ms; moves now ${m}`);
  await p.context().close();
}
// 13. (build 9) A fresh player's games count as rated (no solver chips), and leaving after your first disc is a loss.
{
  const p = await open();
  await p.waitForFunction(() => /Your turn/.test(document.querySelector("#pstatus").textContent), null, { timeout: 15000 });
  await p.waitForTimeout(1500);
  const chips = await p.evaluate(() => document.querySelectorAll("#pboard g.chip").length);
  await p.click("#pboard .hit[data-col='3']");
  await p.waitForFunction(() => /Your turn/.test(document.querySelector("#pstatus").textContent), null, { timeout: 20000 });
  await click(p, "#bNew");
  await p.waitForTimeout(300);
  const warn = await p.evaluate(() => document.querySelector("#overlay .sheet").textContent.includes("will count as a loss"));
  await click(p, "#overlay [data-go]");
  await p.waitForTimeout(800);
  const st = await p.evaluate(() => ({ losses: Profile.stats().losses, rated: (Profile.stats().byLevel.medium || {}).l || 0, help: (Profile.stats().byMode.help || {}).g || 0 }));
  const s = await pub(p);
  check("fresh player: no chips; leaving after a disc warns and counts a rated loss", chips === 0 && warn && st.losses === 1 && st.rated === 1 && st.help === 0 && s.moves === 0,
    `chips=${chips} warn=${warn} ${JSON.stringify(st)} moves=${s.moves}`);
  await p.context().close();
}
await b.close();
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
