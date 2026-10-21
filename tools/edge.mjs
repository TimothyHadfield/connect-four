// Browser checks for odd situations (edge pass, 2026-10-20). Headless WebKit, iPhone size unless noted.
//   node tools/edge.mjs [url] [shotDir]     default: the live site
// Prints PASS/FAIL per check; exit code 1 if any fails.
import { createRequire } from "node:module";
const require = createRequire("C:/Users/timha/.claude/tools/package.json");
const { webkit, devices } = require("playwright");

const URL = process.argv[2] || "https://timothyhadfield.github.io/connect-four/";
const SHOTS = process.argv[3] || "";
const b = await webkit.launch();
let fails = 0;
const check = (name, ok, info = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${info ? " · " + info : ""}`); if (!ok) fails++; };

async function open(ls, ctxOpts = {}, init) {
  const ctx = await b.newContext({ ...devices["iPhone 15"], ...ctxOpts });
  if (init) await ctx.addInitScript(init);
  if (ls !== undefined) await ctx.addInitScript((v) => { try { if (!sessionStorage.getItem("_seeded")) { localStorage.setItem("c4:v1", v); sessionStorage.setItem("_seeded", "1"); } } catch (e) {} }, typeof ls === "string" ? ls : JSON.stringify(ls));
  const p = await ctx.newPage();
  watch(p);
  await p.goto(URL);
  await p.waitForSelector("#pboard svg", { timeout: 20000 });
  await p.waitForTimeout(600);
  return p;
}
function watch(p) {
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") p.errs.push(m.text()); });
}
const P = (p) => p.evaluate(async () => {
  const s = (await import(document.querySelector('script[src*="app.js"]').src)).P;
  const pub = s.snap && s.snap.pub;
  return { mode: s.mode, popMode: s.popMode, pub: pub ? { moves: pub.moves.length, result: pub.result, turn: pub.turn, first: pub.first, size: pub.size, cells: pub.cells, H: pub.H, W: pub.W } : null };
});
const click = (p, sel) => p.evaluate((s) => document.querySelector(s).click(), sel);
const col = (p, c, sel = "#pboard") => p.evaluate(([c, sel]) => document.querySelector(`${sel} .hit[data-col='${c}']`).dispatchEvent(new MouseEvent("click", { bubbles: true })), [c, sel]);
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png` }); };
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const friends = (moves, first = 0, extra = {}) => ({ ...extra, current: { mode: "friends", id: 1, level: "medium", options: { size: extra.size || "7x6", popout: !!extra.popout, first }, names: ["Red", "Yellow"], moves } });
const mv = (list, first = 0) => list.map((c, i) => ({ s: (first + i) % 2, c }));

// 1. Two players: the name plate shows each player's own colour once, not "Red / Red".
{
  const p = await open(friends(mv([3])));
  const plates = await p.$$eval("#pl .plate .nm", (e) => e.map((x) => [x.firstChild.textContent, (x.querySelector("small") || {}).textContent || ""]));
  check("2 players: no 'Red / Red' plate", plates.length === 2 && plates.every(([n, s]) => n !== s) && plates[0][0] === "Red" && plates[1][0] === "Yellow", JSON.stringify(plates));
  await shot(p, "friends-plates");
  await p.context().close();
}
// 2. Two players: the loser of each game starts the next one (as the New game sheet says).
{
  // Red starts; Yellow wins with four across on the bottom row
  const p = await open(friends(mv([0, 1, 0, 2, 0, 3, 6]), 0));
  await col(p, 4); await p.waitForTimeout(900);
  const a = await P(p);
  await click(p, "#bNew"); await p.waitForTimeout(200);
  await click(p, "#ngMode button[data-k='friends']"); await click(p, "[data-go]"); await p.waitForTimeout(500);
  const b2 = await P(p);
  check("2 players: the loser (Red) starts the next game", a.pub.result && a.pub.result.winner === 1 && b2.pub.first === 0, `winner=${a.pub.result && a.pub.result.winner} next first=${b2.pub.first}`);
  await p.context().close();
}
// 3. Two players: an accidental double tap drops one disc, not one for each player.
{
  const p = await open(friends(mv([3])));
  await col(p, 2); await p.waitForTimeout(60); await col(p, 2);
  await p.waitForTimeout(1200);
  const a = await P(p);
  await col(p, 5); await p.waitForTimeout(1200);
  const b2 = await P(p);
  check("2 players: double tap = one disc; next tap still plays", a.pub.moves === 2 && b2.pub.moves === 3, `after double tap ${a.pub.moves} moves, after next tap ${b2.pub.moves}`);
  await p.context().close();
}
// 4. A "?" inside the New game sheet: OK brings the sheet back, not nothing.
{
  const p = await open({});
  await click(p, "#bNew"); await p.waitForTimeout(150);
  await click(p, "#ngLevel button[data-k='strong']");
  await click(p, ".sheet [data-help='levels']"); await p.waitForTimeout(150);
  const inHelp = await p.$(".sheet [data-close]");
  await click(p, ".sheet [data-close]"); await p.waitForTimeout(150);
  const back = await p.$("#ngMode");
  const strongKept = await p.$("#ngLevel button.on[data-k='strong']");
  check("help inside New game returns to the sheet", !!inHelp && !!back && !!strongKept, `help=${!!inHelp} sheet back=${!!back} choice kept=${!!strongKept}`);
  await p.context().close();
}
// 5. Back with a sheet open closes the sheet and stays on the same screen.
{
  const p = await open({});
  await click(p, "nav.tabs button[data-tab='settings']"); await p.waitForTimeout(150);
  await click(p, "nav.tabs button[data-tab='play']"); await p.waitForTimeout(150);
  await click(p, "#bNew"); await p.waitForTimeout(150);
  await p.goBack(); await p.waitForTimeout(400);
  const open1 = await p.$eval("#overlay", (e) => e.classList.contains("show"));
  const tab = await p.$eval(".tab.active", (e) => e.id);
  await p.goBack(); await p.waitForTimeout(400);
  const tab2 = await p.$eval(".tab.active", (e) => e.id);
  check("Back closes the sheet, stays on Play; next Back goes to Settings", !open1 && tab === "tab-play" && tab2 === "tab-settings", `sheet open=${open1} tab=${tab} then ${tab2}`);
  await p.context().close();
}
// 6. Pop mode doesn't survive Undo (the other player would be told to pop).
{
  const p = await open(friends(mv([3, 2]), 0, { popout: true }));
  await click(p, "#bPop"); await p.waitForTimeout(100);
  await click(p, "#bUndo"); await p.waitForTimeout(300);
  const a = await P(p);
  const st = await p.textContent("#pstatus");
  check("Undo turns Pop mode off", !a.popMode && !/pop/.test(st), `popMode=${a.popMode} status="${st.trim()}"`);
  await p.context().close();
}
// 7. Two tabs: a result saved in one tab isn't wiped by the other tab's next save.
{
  const ctx = await b.newContext({ ...devices["iPhone 15"] });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem("c4:v1")) localStorage.setItem("c4:v1", JSON.stringify({ level: "beginner", starts: "you" })); } catch (e) {} });
  const A = await ctx.newPage(); watch(A); await A.goto(URL); await A.waitForSelector("#pboard svg");
  const B = await ctx.newPage(); watch(B); await B.goto(URL); await B.waitForSelector("#pboard svg");
  await A.waitForTimeout(500);
  // tab A: finish a game against Beginner by playing column 0 until it ends
  for (let i = 0; i < 40; i++) {
    const s = await P(A);
    if (s.pub.result) break;
    if (s.pub.turn === 0) { let c = 0; while (s.pub.cells[c * s.pub.H + s.pub.H - 1]) c++; await col(A, c); }
    await A.waitForTimeout(700);
  }
  const recA = await A.evaluate(() => JSON.parse(localStorage.getItem("c4:v1")).history.length);
  await B.bringToFront();
  await col(B, 3); await B.waitForTimeout(800);
  const recB = await B.evaluate(() => JSON.parse(localStorage.getItem("c4:v1")).history.length);
  check("two tabs: tab B's save keeps tab A's finished game", recA === 1 && recB === 1, `history after A=${recA}, after B moved=${recB}`);
  await ctx.close();
}
// 8. Storage blocked (private mode / site data off): the page works and a game can be played.
{
  const p = await open(undefined, {}, () => {
    const boom = () => { throw new DOMException("blocked", "SecurityError"); };
    Object.defineProperty(window, "localStorage", { get: boom, configurable: true });
    Object.defineProperty(window, "sessionStorage", { get: boom, configurable: true });
  });
  await col(p, 3); await p.waitForTimeout(1500);
  const s = await P(p);
  await click(p, "nav.tabs button[data-tab='settings']"); await p.waitForTimeout(300);
  await click(p, "nav.tabs button[data-tab='study']"); await p.waitForTimeout(300);
  await click(p, "nav.tabs button[data-tab='table']"); await p.waitForTimeout(300);
  check("storage blocked: plays and every tab opens", s.pub.moves >= 1 && p.errs.length === 0, `moves=${s.pub.moves} errors=${p.errs.join(" | ")}`);
  await p.context().close();
}
// 9. Reload while it's the computer's turn: the computer still moves.
{
  const p = await open({ level: "beginner", current: { mode: "computer", id: 5, level: "beginner", options: { size: "7x6", popout: false, first: 0, level: "beginner" }, names: ["You", "Computer"], moves: [{ s: 0, c: 3 }] } });
  await p.waitForTimeout(2500);
  const s = await P(p);
  check("reload on the computer's turn: it moves", s.pub.moves === 2, `moves=${s.pub.moves}`);
  await p.context().close();
}
// 10. A game finished late in the evening is filed under that day, not tomorrow (UTC).
{
  const p = await open({ level: "beginner" }, { timezoneId: "America/Denver" }, () => {
    const Real = Date, fixed = new Real("2026-10-21T04:30:00Z").getTime(), t0 = Real.now();
    // 22:30 in Utah on Oct 20 = Oct 21 in UTC
    globalThis.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [fixed + (Real.now() - t0)])); } static now() { return fixed + (Real.now() - t0); } };
  });
  for (let i = 0; i < 40; i++) {
    const s = await P(p);
    if (s.pub.result) break;
    if (s.pub.turn === 0) { let c = 0; while (s.pub.cells[c * s.pub.H + s.pub.H - 1]) c++; await col(p, c); }
    await p.waitForTimeout(700);
  }
  const d = await p.evaluate(() => JSON.parse(localStorage.getItem("c4:v1")).history[0].date);
  check("evening game is dated the local day", d === "2026-10-20", `date=${d}`);
  await p.context().close();
}
// 11. Pop Out, full board: Hint Undo Pop Draw New game all fit at 320 px.
{
  // fill 5x4 column by column with no four: pattern per column alternates in pairs
  const cols = [0, 1, 0, 1, 1, 0, 1, 0, 2, 3, 2, 3, 3, 2, 3, 2, 4, 4, 4, 4];
  const moves = mv(cols);
  const p = await open(friends(moves, 0, { size: "5x4", popout: true }), { viewport: { width: 320, height: 568 } });
  const s = await P(p);
  const r = await p.$$eval("#pactions .btn:not([hidden])", (e) => e.map((x) => Math.round(x.getBoundingClientRect().right)));
  check("320px Pop Out full board: all buttons fit", s.pub && !s.pub.result && r.length === 5 && Math.max(...r) <= 320 && (await overflow(p)) <= 0, `result=${JSON.stringify(s.pub && s.pub.result)} buttons right edges=${r}`);
  await shot(p, "320-popout-full");
  await p.context().close();
}
// 12. Long and emoji names on the plates: nothing spills off the screen at 320 px.
{
  const p = await open({ name: "WWWWWWWWWWWWWWWWWWWW", current: { mode: "computer", id: 5, level: "perfect", options: { size: "9x7", popout: false, first: 0, level: "perfect" }, names: ["WWWWWWWWWWWWWWWWWWWW", "Computer"], moves: [{ s: 0, c: 4 }, { s: 1, c: 4 }] } }, { viewport: { width: 320, height: 568 } });
  const r = await p.$$eval("#pl .pl", (e) => e.map((x) => [Math.round(x.getBoundingClientRect().left), Math.round(x.getBoundingClientRect().right)]));
  check("320px long name: plates stay on screen", r.every(([l, rr]) => l >= 0 && rr <= 320) && (await overflow(p)) <= 0, JSON.stringify(r));
  await shot(p, "320-longname-9x7");
  await p.context().close();
}
// 13. Undo while the computer is thinking: back to your turn, the computer doesn't move twice.
{
  const p = await open({ level: "perfect", starts: "you" });
  await col(p, 0); await p.waitForTimeout(30);
  await click(p, "#bUndo"); await p.waitForTimeout(3000);
  const s = await P(p);
  check("Undo mid-think: empty board, your turn", s.pub.moves === 0 && s.pub.turn === 0, `moves=${s.pub.moves} turn=${s.pub.turn}`);
  await p.context().close();
}
// 14. Tapping after the game is over, and on a full column: board stays put, a short message.
{
  const p = await open(friends(mv([0, 1, 0, 1, 0, 1])));
  await col(p, 0); await p.waitForTimeout(900);
  await col(p, 1); await p.waitForTimeout(200);
  const t = await p.textContent("#toast");
  const s = await P(p);
  check("tap after a win: no move, 'Game over' message", s.pub.moves === 7 && /Game over/.test(t), `moves=${s.pub.moves} toast="${t}"`);
  await p.context().close();
}
// 15. Pop Out: the same position three times ends in a draw that says why.
{
  // both players drop then pop the same column back and forth
  const moves = [{ s: 0, c: 0 }, { s: 1, c: 1 }, { s: 0, c: 0, p: true }, { s: 1, c: 1, p: true }, { s: 0, c: 0 }, { s: 1, c: 1 }, { s: 0, c: 0, p: true }];
  const p = await open(friends(moves, 0, { popout: true }));
  await click(p, "#bPop"); await col(p, 1); await p.waitForTimeout(900);
  const s = await P(p), st = await p.textContent("#pstatus");
  check("Pop Out repetition: draw, 'same position 3 times'", s.pub.result && s.pub.result.why === "repeat" && /3 times/.test(st), `result=${JSON.stringify(s.pub.result)} status="${st}"`);
  await p.context().close();
}
// 16. Screens at odd sizes: no sideways scroll, no errors, board on screen.
for (const [name, opt] of [
  ["se-320x568", { viewport: { width: 320, height: 568 } }],
  ["landscape-659x393", { viewport: { width: 659, height: 393 } }],
  ["laptop-1280x800", { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }],
  ["huge-1920x1080", { viewport: { width: 1920, height: 1080 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }],
  ["zoom200-640x400", { viewport: { width: 640, height: 400 }, isMobile: false, hasTouch: false, deviceScaleFactor: 2 }],
  ["light-pref", { colorScheme: "light" }],
]) {
  const p = await open({ size: "9x7", current: { mode: "computer", id: 5, level: "beginner", options: { size: "9x7", popout: false, first: 0, level: "beginner" }, names: ["You", "Computer"], moves: mv([4, 4, 3, 5]) } }, opt);
  const bb = await p.$eval("#pboard svg", (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); });
  const vw = opt.viewport ? opt.viewport.width : 393, vh = opt.viewport ? opt.viewport.height : 659;
  const ov = await overflow(p);
  check(`${name}: board fully on screen, no overflow, no errors`, ov <= 0 && bb[0] >= 0 && bb[2] <= vw && bb[3] <= vh && p.errs.length === 0, `board=${bb} overflow=${ov} errs=${p.errs.length}`);
  // 9x7 = 32 discs each = 5 stacks: they must stay on the table
  const spill = await p.evaluate(() => { const t = document.querySelector("#ptable").getBoundingClientRect(); return [...document.querySelectorAll("#pl svg.stacks")].map((s) => { const r = s.getBoundingClientRect(); return Math.round(Math.max(t.left - r.left, r.right - t.right, 0)); }); });
  check(`${name}: disc stacks stay on the table`, spill.every((x) => x <= 2), `spill px=${spill}`);
  await shot(p, name);
  await p.context().close();
}
// 17. Laptop: dragging the window narrower or wider than 900 px resizes the seats (no stale sizes).
{
  const p = await open({}, { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  const h1 = await p.$eval("#pl .pl.near svg.stacks", (e) => +e.getAttribute("height"));
  await p.setViewportSize({ width: 700, height: 800 }); await p.waitForTimeout(400);
  const h2 = await p.$eval("#pl .pl.near svg.stacks", (e) => +e.getAttribute("height"));
  check("window resize across 900px updates seat size", h1 === 60 && h2 === 46, `wide=${h1} narrow=${h2}`);
  await p.context().close();
}
// 18. Study with no finished games, and the Table tab's odd boards.
{
  const p = await open({});
  await click(p, "nav.tabs button[data-tab='study']"); await p.waitForTimeout(300);
  await click(p, "#stPick"); await p.waitForTimeout(200);
  const t = await p.textContent("#toast");
  await click(p, "nav.tabs button[data-tab='table']"); await p.waitForTimeout(300);
  await click(p, "#tBrush button[data-k='1']");
  await col(p, 0, "#tboard"); await col(p, 0, "#tboard");
  await p.waitForTimeout(200);
  const st = await p.textContent("#tstatus");
  for (let i = 0; i < 5; i++) await col(p, 1, "#tboard");
  await p.waitForTimeout(200);
  const st2 = await p.textContent("#tstatus");
  check("empty Study says 'Finish a game first'; Table flags impossible counts", /Finish a game/.test(t) && /don't add up/.test(st) && p.errs.length === 0, `toast="${t}" status="${st}" / "${st2}"`);
  await p.context().close();
}
await b.close();
console.log(fails ? `${fails} FAILED` : "all passed");
process.exit(fails ? 1 : 0);
