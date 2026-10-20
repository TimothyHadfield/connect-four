/* Study tab: Review a finished game move by move with the solver's verdict and
 * points lost, solve Puzzles, and browse the Lab (opening map, board sizes,
 * cell power, computer strength). */
import { S, save, $, $$, esc, toast, q, sheet, closeSheet, discIcon } from "./ui.js";
import { Board } from "./board.js";
import { Analyst, BotClient, chipsFor, bestLine, popChips, PWIN, colList } from "./analysis.js";
import { replay, legalMoves, sizeOf } from "./game.js";
import { LEVEL_NAMES } from "./ai.js";
import { winsAt, hasLine } from "./rules.js";
import { strengthTable } from "./strength.js";

const analyst = new Analyst(21);
const solverBot = new BotClient(21);
let ordinal = (n) => n;
let board = null;
const R = { game: null, ply: 0, cols: [], tags: [], gen: 0, sub: "review", threats: false, running: false };

export function initStudy(h) {
  ordinal = h.ordinal;
  const el = $("#tab-study");
  el.innerHTML = `
  <div class="subtabs" id="stTabs"><button data-k="review" class="on">Review</button><button data-k="puzzles">Puzzles</button><button data-k="lab">Lab</button></div>
  <div class="study-grid" id="stReview">
    <div class="play-main">
      <div class="row" style="flex:none"><button class="btn small grow" id="stPick" style="justify-content:flex-start;overflow:hidden"></button><button class="btn small" id="stThreat">Threats</button>${q("threats")}</div>
      <div class="stage"><div class="board-host" id="stboard"></div></div>
      <div class="verdict" id="stVerdict"></div>
      <div class="stepper">
        <button class="btn" id="stFirst" aria-label="Start">|◀</button><button class="btn" id="stPrev" aria-label="Back">◀</button>
        <input type="range" id="stRange" min="0" max="0" value="0" aria-label="Move">
        <button class="btn" id="stNext" aria-label="Forward">▶</button><button class="btn" id="stLast" aria-label="End">▶|</button>
      </div>
    </div>
    <div class="study-side">
      <div class="summary" id="stSummary"></div>
      <div class="moves" id="stMoves"></div>
    </div>
  </div>
  <div id="stPuzzles" class="study-grid" hidden></div>
  <div id="stLab" class="tab scroll" style="position:static;display:none;padding:0"></div>`;
  board = new Board($("#stboard"), { onColumn: () => {} });
  $$("#stTabs button").forEach((b) => (b.onclick = () => { R.sub = b.dataset.k; showStudy(); }));
  $("#stFirst").onclick = () => go(0);
  $("#stPrev").onclick = () => go(R.ply - 1);
  $("#stNext").onclick = () => go(R.ply + 1);
  $("#stLast").onclick = () => go(R.game ? R.game.moves.length : 0);
  $("#stRange").oninput = (e) => go(+e.target.value);
  $("#stPick").onclick = pickGame;
  $("#stThreat").onclick = () => { R.threats = !R.threats; drawReview(); };
}

export function showStudy() {
  $$("#stTabs button").forEach((b) => b.classList.toggle("on", b.dataset.k === R.sub));
  $("#stReview").hidden = R.sub !== "review";
  $("#stPuzzles").hidden = R.sub !== "puzzles";
  $("#stLab").style.display = R.sub === "lab" ? "flex" : "none";
  if (R.sub === "review") { if (!R.game && S.history.length) studyGame(S.history[0]); else drawReview(); }
  if (R.sub === "puzzles") showPuzzles();
  if (R.sub === "lab") showLab();
}

/* ------------------------------------------------------------- review */
export function studyGame(g) {
  R.game = g; R.ply = g ? g.moves.length : 0; R.cols = []; R.tags = []; R.gen++;
  R.sub = "review";
  if (!g) return;
  const [W, H] = sizeOf(g.opts);
  board.build(W, H);
  drawReview(false);
  runAnalysis();
}

function pickGame() {
  if (!S.history.length) { toast("Finish a game first."); return; }
  sheet(`<h3>Pick a game</h3><div style="display:flex;flex-direction:column;gap:6px">${S.history.map((g, i) => `<button class="btn" data-i="${i}" style="justify-content:space-between">${gameLabel(g)}</button>`).join("")}</div><div class="row end"><button class="btn" data-x>Close</button></div>`, (el) => {
    el.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { closeSheet(); studyGame(S.history[+b.dataset.i]); }));
    el.querySelector("[data-x]").onclick = closeSheet;
  });
}
function gameLabel(g) {
  const opp = g.mode === "computer" ? "vs " + (LEVEL_NAMES[g.level] || "computer") : g.mode === "online" ? "online" : "2 players";
  const res = g.winner < 0 ? "draw" : g.you >= 0 ? (g.winner === g.you ? "won" : "lost") : (g.winner === 0 ? "Red won" : "Yellow won");
  return `<span>${esc(g.date)} · ${opp}${g.opts.popout ? " · Pop Out" : ""}</span><span class="muted">${res} · ${g.moves.length} moves</span>`;
}

function posAt(ply) { return replay(R.game.opts, R.game.moves, ply); }

async function runAnalysis() {
  const g = R.game, gen = R.gen;
  if (!g) return;
  R.running = true;
  for (let i = 0; i < g.moves.length; i++) {
    if (gen !== R.gen) return;
    const m = g.moves[i];
    if (m.d) { R.tags[i] = { tag: "best" }; continue; }
    const s = posAt(i);
    const res = await analyst.once({ cells: s.cells, W: s.W, H: s.H, toMove: s.turn === 0 ? 1 : 2, firstDisc: s.first === 0 ? 1 : 2, popout: s.popout, depth: 5, weakBudget: 1e7, strongBudget: 1.5e6 });
    if (gen !== R.gen) return;
    R.cols[i] = res.pop ? { popv: res.pop } : res.cols;
    R.tags[i] = tagMove(R.cols[i], m, s);
    drawReview(false);
  }
  R.running = false;
  drawReview(false);
}

function count(cells) { let n = 0; for (const v of cells) if (v) n++; return n; }

function tagMove(cols, m, s) {
  if (!cols) return null;
  if (cols.popv) {
    const best = Math.max(...cols.popv.map((x) => x.v));
    const mine = cols.popv.find((x) => x.c === m.c && !!x.p === !!m.p);
    if (!mine) return null;
    if (mine.v === best) return { tag: "best" };
    if (best >= PWIN - 200 && mine.v < PWIN - 200) return { tag: mine.v <= -(PWIN - 200) ? "blunder" : "mistake" };
    if (mine.v <= -(PWIN - 200)) return { tag: "blunder" };
    return { tag: best - mine.v > 25 ? "mistake" : "good" };
  }
  const b = bestLine(cols, count(s.cells), s.W, s.H);
  const pc = cols[m.c];
  if (!b || !pc || pc.cat === null || pc.cat === undefined) return { tag: "wait" };
  const bestScore = b.d !== null && cols[b.cols[0]].exact ? cols[b.cols[0]].score : null;
  const pts = bestScore !== null && pc.exact ? bestScore - pc.score : null;
  if (pc.cat < b.cat) return { tag: b.cat === 2 && pc.cat === 0 ? "blunder" : "mistake", pts };
  if (pts === null || pts === 0) return { tag: "best", pts: pts ?? 0 };
  return { tag: pts <= 2 ? "good" : "slow", pts };
}
const TAGS = { best: "Best", good: "Good", slow: "Slower", mistake: "Mistake", blunder: "Blunder", wait: "…" };

function go(ply) {
  if (!R.game) return;
  R.ply = Math.max(0, Math.min(R.game.moves.length, ply));
  drawReview(true);
}

function drawReview(animate = false) {
  const g = R.game;
  if (!g) {
    $("#stPick").textContent = "No games yet";
    $("#stSummary").innerHTML = "";
    $("#stMoves").innerHTML = `<span class="muted">Play a game in the Play tab, then review it here move by move.</span>`;
    if (!board.W) board.build(7, 6);
    return;
  }
  $("#stPick").innerHTML = gameLabel(g);
  const s = posAt(R.ply);
  board.set(s.cells, { animate: animate && S.anim });
  board.line(s.result ? s.result.line : null);
  const m = g.moves[R.ply];
  const cols = R.cols[R.ply];
  const n = count(s.cells);
  $("#stRange").max = g.moves.length; $("#stRange").value = R.ply;
  $("#stThreat").classList.toggle("on", R.threats);
  board.dots(R.threats ? threatDots(s) : null);
  // chips for the position before move R.ply, with the played column marked
  if (cols && !s.result) {
    if (cols.popv) { const { chips } = popChips(cols.popv, s.W); if (m && !m.p && chips[m.c]) chips[m.c].cls += " pick"; board.setChips(chips); }
    else { const chips = chipsFor(cols, n, s.W, s.H); if (m && !m.d && chips[m.c]) chips[m.c].cls += " pick"; board.setChips(chips); }
  } else board.setChips(null);
  // verdict line
  const vd = $("#stVerdict");
  if (s.result) vd.innerHTML = s.result.winner < 0 ? "Draw" : `${discIcon(s.result.winner === 0 ? 1 : 2)} ${esc(g.names[s.result.winner])} won`;
  else if (m) {
    const t = R.tags[R.ply];
    const who = esc(g.names[m.s]);
    const what = m.d ? "called a draw" : m.p ? `popped column ${m.c + 1}` : `played column ${m.c + 1}`;
    let extra = "";
    if (cols && !cols.popv) { const b = bestLine(cols, n, s.W, s.H); if (b && t && t.tag !== "best") extra = ` · best was ${colList(b.cols)}`; }
    vd.innerHTML = `${discIcon(m.s === 0 ? 1 : 2)} ${who} ${what}${t ? ` · <span class="tag ${t.tag}">${TAGS[t.tag]}</span>${t.pts ? ` (−${t.pts})` : ""}` : ` <span class="muted thinking">checking</span>`}${extra}`;
  } else vd.textContent = "";
  // summary per player
  const sum = [0, 1].map((seat) => {
    const mine = R.tags.map((t, i) => (g.moves[i] && g.moves[i].s === seat ? t : null)).filter(Boolean);
    const c = (k) => mine.filter((t) => t.tag === k).length;
    const pts = mine.reduce((a, t) => a + (t.pts || 0), 0);
    return `<span>${discIcon(seat === 0 ? 1 : 2, 14)} ${esc(g.names[seat])}: <b>${c("best")}</b> best · <b>${c("mistake")}</b> mistakes · <b>${c("blunder")}</b> blunders · <b>${pts}</b> pts lost</span>`;
  });
  $("#stSummary").innerHTML = sum.join("") + q("points") + (R.running ? ` <span class="muted thinking">checking moves</span>` : "");
  $("#stMoves").innerHTML = g.moves.map((mv, i) => {
    const t = R.tags[i];
    return `<span class="mv ${i === R.ply ? "cur" : ""}" data-i="${i}">${discIcon(mv.s === 0 ? 1 : 2, 12)}${i + 1}. ${mv.d ? "draw" : (mv.p ? "pop " : "") + (mv.c + 1)}${t ? ` <span class="tag ${t.tag}">${TAGS[t.tag]}</span>` : ""}</span>`;
  }).join("");
  $$("#stMoves .mv").forEach((e) => (e.onclick = () => go(+e.dataset.i)));
  const cur = $("#stMoves .mv.cur");
  if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
}

/** Empty cells that would complete four for each colour (odd/even row marked). */
export function threatDots(s) {
  const out = [];
  const { W, H, cells } = s;
  const firstDisc = s.first === 0 ? 1 : 2;
  for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) {
    const i = c * H + r;
    if (cells[i]) continue;
    for (const v of [1, 2]) {
      cells[i] = v;
      const w = winsAt(cells, W, H, c, r, v);
      cells[i] = 0;
      if (w) out.push({ i, v, odd: ((r + 1) % 2 === 1) === (v === firstDisc) });
    }
  }
  return out;
}

/* ------------------------------------------------------------ puzzles */
let PUZ = null;
const PZ = { i: 0, cells: null, toMove: 1, first: 1, W: 7, H: 6, state: "idle", gen: 0, moves: 0 };
let pboard = null;
async function loadPuzzles() {
  if (PUZ) return PUZ;
  try { PUZ = await (await fetch("data/puzzles.json")).json(); } catch (e) { PUZ = []; }
  return PUZ;
}
async function showPuzzles() {
  const el = $("#stPuzzles");
  if (!pboard) {
    el.innerHTML = `<div class="play-main">
      <div class="row between" style="flex:none"><b id="pzTitle"></b><span>${q("puzzles")}</span></div>
      <div class="stage"><div class="board-host" id="pzboard"></div></div>
      <div class="status" id="pzStatus"></div>
      <div class="actions"><button class="btn" id="pzPrev">◀ Prev</button><button class="btn" id="pzReset">Retry</button><button class="btn" id="pzHint">Hint</button><button class="btn primary" id="pzNext">Next ▶</button></div>
    </div><div class="study-side"><div class="moves" id="pzList"></div></div>`;
    pboard = new Board($("#pzboard"), { onColumn: pzTap });
    $("#pzPrev").onclick = () => openPuzzle(PZ.i - 1);
    $("#pzNext").onclick = () => openPuzzle(PZ.i + 1);
    $("#pzReset").onclick = () => openPuzzle(PZ.i);
    $("#pzHint").onclick = pzHint;
  }
  await loadPuzzles();
  if (!PUZ.length) { $("#pzStatus").textContent = "No puzzles found."; return; }
  if (PZ.state === "idle") openPuzzle(Math.max(0, PUZ.findIndex((p) => !S.puzzle.solved.includes(p.id))));
  else drawPuzzleList();
}
function openPuzzle(i) {
  if (!PUZ || !PUZ.length) return;
  PZ.i = (i + PUZ.length) % PUZ.length;
  const p = PUZ[PZ.i];
  PZ.gen++;
  PZ.W = p.W; PZ.H = p.H; PZ.cells = p.cells.split("").map(Number); PZ.toMove = p.toMove; PZ.first = p.first; PZ.state = "play"; PZ.moves = 0;
  pboard.build(p.W, p.H);
  pboard.set(PZ.cells, { animate: false });
  pboard.line(null); pboard.setChips(null);
  $("#pzTitle").textContent = `Puzzle ${PZ.i + 1} of ${PUZ.length} · win in ${p.turns}`;
  $("#pzStatus").innerHTML = `${discIcon(p.toMove)} ${p.toMove === 1 ? "Red" : "Yellow"} to play and win. Only one column works.`;
  drawPuzzleList();
}
function drawPuzzleList() {
  $("#pzList").innerHTML = PUZ.map((p, i) => `<span class="mv ${i === PZ.i ? "cur" : ""}" data-i="${i}">${S.puzzle.solved.includes(p.id) ? "✓ " : ""}${i + 1} · in ${p.turns}</span>`).join("");
  $$("#pzList .mv").forEach((e) => (e.onclick = () => openPuzzle(+e.dataset.i)));
}
function rowOf(cells, H, c) { for (let r = 0; r < H; r++) if (!cells[c * H + r]) return r; return -1; }
async function pzTap(c) {
  if (PZ.state !== "play") return;
  const { W, H } = PZ;
  const r = rowOf(PZ.cells, H, c);
  if (r < 0) { toast("That column is full."); return; }
  PZ.state = "check";
  const gen = PZ.gen;
  const before = PZ.cells.slice();
  // is this a winning move? (solver)
  const res = await analyst.once({ cells: before, W, H, toMove: PZ.toMove, firstDisc: PZ.first, popout: false, weakBudget: 3e7, strongBudget: -1 });
  if (gen !== PZ.gen) return;
  const ok = res.cols && res.cols[c] && res.cols[c].cat === 2;
  PZ.cells[c * H + r] = PZ.toMove;
  pboard.set(PZ.cells, { animate: S.anim });
  if (winsAt(PZ.cells, W, H, c, r, PZ.toMove)) {
    pboard.line(lineOf(PZ.cells, W, H, PZ.toMove));
    $("#pzStatus").innerHTML = `<span style="color:var(--good)">Solved! Four in a row.</span>`;
    PZ.state = "done";
    const id = PUZ[PZ.i].id;
    if (!S.puzzle.solved.includes(id)) { S.puzzle.solved.push(id); save(); }
    drawPuzzleList();
    return;
  }
  if (!ok) {
    pboard.setChips(chipsFor(res.cols, count(before), W, H));
    $("#pzStatus").innerHTML = `<span style="color:var(--bad)">Not that one</span>: the chips show why. Tap Retry.`;
    PZ.state = "done";
    return;
  }
  // computer defends as long as it can
  $("#pzStatus").innerHTML = `<span class="thinking">Good. The computer defends</span>`;
  const pub = { W, H, cells: PZ.cells, popout: false, first: PZ.first === 1 ? 0 : 1, turn: PZ.toMove === 1 ? 1 : 0, moves: [], result: null };
  const mv = await solverBot.move(pub, PZ.toMove === 1 ? 1 : 0, "perfect");
  if (gen !== PZ.gen) return;
  setTimeout(() => {
    if (gen !== PZ.gen) return;
    const rr = rowOf(PZ.cells, H, mv.c);
    PZ.cells[mv.c * H + rr] = 3 - PZ.toMove;
    pboard.set(PZ.cells, { animate: S.anim });
    if (hasLine(PZ.cells, W, H, 3 - PZ.toMove)) { $("#pzStatus").textContent = "The computer got four. Tap Retry."; PZ.state = "done"; return; }
    PZ.state = "play";
    $("#pzStatus").innerHTML = `${discIcon(PZ.toMove)} Keep going: find the next winning move.`;
  }, 500);
}
function lineOf(cells, W, H, v) {
  const out = [];
  for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) {
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const run = [];
      for (let k = 0; k < 4; k++) { const cc = c + dc * k, rr = r + dr * k; if (cc < 0 || cc >= W || rr < 0 || rr >= H || cells[cc * H + rr] !== v) break; run.push(cc * H + rr); }
      if (run.length === 4) out.push(...run);
    }
  }
  return out;
}
async function pzHint() {
  if (PZ.state !== "play") return;
  const gen = PZ.gen;
  const res = await analyst.once({ cells: PZ.cells, W: PZ.W, H: PZ.H, toMove: PZ.toMove, firstDisc: PZ.first, popout: false, weakBudget: 3e7, strongBudget: 4e6 });
  if (gen !== PZ.gen) return;
  pboard.setChips(chipsFor(res.cols, count(PZ.cells), PZ.W, PZ.H));
}

/* ---------------------------------------------------------------- lab */
// Tromp's results table (tromp.github.io/c4/c4.html, checked 2026-10-20) (first player: + win, = draw, - loss), widths 4..11 x heights 4..11.
const TROMP = {
  4: ["=", "=", "-", "=", "-", "-", "-", "-"],
  5: ["=", "=", "=", "=", "+", "+", "+", ""],
  6: ["=", "=", "-", "+", "-", "-", "", ""],
  7: ["=", "=", "+", "=", "+", "", "", ""],
  8: ["=", "=", "-", "+", "-", "", "", ""],
  9: ["=", "=", "+", "", "", "", "", ""],
  10: ["=", "=", "", "", "", "", "", ""],
  11: ["=", "", "", "", "", "", "", ""],
};
// First-move scores on the classic board (solver convention; verified by tests against the book).
const FIRST_7x6 = [-2, -1, 0, 1, 0, -1, -2];

function showLab() {
  const el = $("#stLab");
  const [W, H] = sizeOf({ size: S.size });
  const power = [];
  for (let r = H - 1; r >= 0; r--) for (let c = 0; c < W; c++) {
    let n = 0;
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) for (let k = 0; k < 4; k++) {
      const sc = c - dc * k, sr = r - dr * k, ec = sc + 3 * dc, er = sr + 3 * dr;
      if (sc >= 0 && sc < W && sr >= 0 && sr < H && ec >= 0 && ec < W && er >= 0 && er < H) n++;
    }
    power.push(n);
  }
  const maxP = Math.max(...power), minP = Math.min(...power);
  const heat = (v) => { const t = (v - minP) / Math.max(1, maxP - minP); return `hsl(${Math.round(210 - 170 * t)} 70% ${Math.round(42 + 18 * t)}%)`; };
  const first = W === 7 && H === 6 ? FIRST_7x6.map((s) => {
    const d = s > 0 ? `Win on move ${2 * ((45 - 2 * s) >> 1) - 1}` : s < 0 ? `Lose on move ${2 * ((44 + 2 * s) >> 1) - 2 + 2}` : "Draw";
    return { s, d };
  }) : null;
  el.innerHTML = `<div class="lab-grid" style="padding-bottom:10px">
    <div class="panel"><h2>Opening map ${q("firstmove")}</h2>
      ${first ? `<div class="mini-board" style="grid-template-columns:repeat(7,1fr)">${first.map((f) => `<div style="background:${f.s > 0 ? "#6ee7a8" : f.s < 0 ? "#f08c8c" : "#f0c27a"}">${f.s > 0 ? "W" : f.s < 0 ? "L" : "D"}</div>`).join("")}</div>
      <div class="muted" style="font-size:13px;margin-top:6px">First player's first move, columns 1–7. Middle: win on move 41 (the very last disc they own). Next to it: draw. Columns 2 and 6: loss on move 42; edges: loss on move 40.</div>`
      : `<div class="muted" style="font-size:13.5px">The opening map is for the classic 7 × 6 board. On ${W} × ${H} the overall result is ${trompText(W, H)}.</div>`}
    </div>
    <div class="panel"><h2>Board sizes ${q("sizes")}</h2>
      <table class="strength size-table"><tr><th>rows \\ cols</th>${[4, 5, 6, 7, 8, 9, 10, 11].map((w) => `<th>${w}</th>`).join("")}</tr>
      ${[4, 5, 6, 7, 8, 9, 10, 11].map((h) => `<tr><td>${h}</td>${TROMP[h].map((v, i) => `<td class="${v === "+" ? "w" : v === "-" ? "l" : v === "=" ? "d" : ""}" ${4 + i === W && h === H ? 'style="outline:2px solid var(--accent)"' : ""}>${v === "-" ? "−" : v}</td>`).join("")}</tr>`).join("")}</table>
      <div class="muted" style="font-size:12.5px;margin-top:6px">+ first player wins · = draw · − second player wins · blank: unsolved. Your board is outlined.</div>
    </div>
    <div class="panel"><h2>Cell power ${q("cellpower")}</h2>
      <div class="mini-board" style="grid-template-columns:repeat(${W},1fr);background:#1b2233">${power.map((v) => `<div style="background:${heat(v)}">${v}</div>`).join("")}</div>
    </div>
    <div class="panel"><h2>How strong is the computer?</h2>${strengthTable()}</div>
  </div>`;
}
function trompText(W, H) {
  const row = TROMP[H];
  const v = row ? row[W - 4] : "";
  return v === "+" ? "a win for the first player" : v === "-" ? "a win for the second player" : v === "=" ? "a draw" : "not known (nobody has solved it)";
}
