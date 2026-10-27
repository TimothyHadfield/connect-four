/* Connect Four: page controller (tabs, Play, online rooms, Settings). */
import "./fx.js";
import { defineSounds, react, refuse, release, scoreBump, boardAnim } from "./sfx.js";
import { game, SIZES, setBot, sizeOf } from "./game.js";
import { createLocal, createOnline } from "./online.js";
import { Board } from "./board.js";
import { Analyst, BotClient, chipsFor, bestLine, popChips, colList } from "./analysis.js";
import { LEVELS, LEVEL_NAMES, botMove, useFast, useBook } from "./ai.js";
import { makeFast, fitsWasm } from "./fast.js";
import { decodeBook } from "./book.js";
import { S, save, $, $$, esc, toast, sheet, closeSheet, help, q, discIcon, ordinal, hooks, today } from "./ui.js";
import { HELP } from "./help.js";
import { initStudy, showStudy, studyGame } from "./study.js";
import { initTable, showTable } from "./table.js";
import { renderSettings } from "./settings.js";
import { seatHTML, discsLeft, discsEach, liftOff } from "./seats.js";
import "./profile.js";
import { C4_LEVELS, C4_ACHIEVEMENTS, dailyOpening, profileResult, seedFromHistory } from "./profile-c4.js";

const COLOR = ["Red", "Yellow"];
const disc = (seat) => (seat === 0 ? 1 : 2);

/* ------------------------------------------------------------------ tabs */
let curTab = "play";
export function goTab(name, push = true) {
  if (!["play", "study", "table", "settings"].includes(name)) name = "play";
  curTab = name;
  $$(".tab").forEach((t) => t.classList.toggle("active", t.id === "tab-" + name));
  $$("nav.tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  if (push && location.hash !== "#" + name) history.pushState({ tab: name }, "", "#" + name);
  if (name === "study") showStudy();
  if (name === "table") showTable();
  if (name === "settings") renderSettings();
  if (name === "play") refreshAnalysis();
}
$$("nav.tabs button").forEach((b) => (b.onclick = () => goTab(b.dataset.tab)));
window.addEventListener("popstate", () => {
  // Back with a sheet open closes the sheet and stays on this screen
  if ($("#overlay").classList.contains("show")) { closeSheet(); history.pushState({ tab: curTab }, "", "#" + curTab); return; }
  goTab((location.hash || "#play").slice(1), false);
});
document.addEventListener("click", (e) => {
  const h = e.target.closest("[data-help]");
  if (h) { e.preventDefault(); e.stopPropagation(); const [t, b] = HELP[h.dataset.help] || ["Help", ""]; help(t, b); }
});

/* ------------------------------------------------------------------ play */
const analyst = new Analyst(21);
const bot = new BotClient(22);
setBot(botMove);

const P = {
  mode: "computer",     // computer | friends | online
  room: null, snap: null,
  human: 0, comp: 1,    // seats in computer mode
  level: S.level,
  gen: 0,               // bumps on every new game: late computer moves / analysis are dropped
  botGen: -1,           // the game number the computer is thinking for (a new game frees it)
  gameId: 0,            // one id per game, kept through Undo: the record counts each game once
  counted: 0,           // gameId whose result is already in the record
  resuming: false,      // true while a saved online room reconnects after a reload
  popMode: false,
  cols: null, pop: null, hint: false,
  animUntil: 0,
  saved: false,
  daily: false,         // this game is today's Daily game (no hints, no undo, counts once a day)
  options: null,
  onlineView: "home",   // home | lobby | joining (when mode online and not playing)
};

const root = $("#tab-play");
root.innerHTML = `
<div class="play-grid">
  <div class="play-main">
    <div class="tabletop tbl-surface tbl-wood-dark" id="ptable">
      <button type="button" class="pf-open c4-me" id="bMe" aria-label="My stats"></button>
      <div class="players" id="pl"></div>
      <div class="stage" id="pstage"><div class="board-host" id="pboard"></div></div>
      <div id="ponline" class="online-wrap" hidden></div>
      <div class="status" id="pstatus"></div>
      <div class="verdict" id="pverdict"></div>
    </div>
    <div class="actions" id="pactions">
      <button class="btn" id="bHint"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>Hint</button>
      <button class="btn" id="bUndo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>Undo</button>
      <button class="btn" id="bPop" hidden>Pop</button>
      <button class="btn" id="bDraw" hidden>Draw</button>
      <button class="btn" id="bLeave" hidden>Leave</button>
      <button class="btn primary" id="bNew">New game</button>
    </div>
  </div>
  <aside class="side"><div class="ctrl" id="pctrl"></div><div class="side-body" id="pside"></div></aside>
</div>`;

FX.init({ game: "connect-four", accent: "#6ea8fe" });
defineSounds();
FX.onChange(() => settingsChanged("fx"));

/* ------------------------------------------------- player profile (My stats) */
Profile.init({
  game: "connect-four", levels: C4_LEVELS, achievements: C4_ACHIEVEMENTS, name: S.name,
  modes: { help: { name: "Computer, with help" }, friends: { name: "2 players" }, online: { name: "Online" } },
  daily: { title: "Daily game", onPlay: () => startDaily() },
  onChange: (what) => { if (what === "me" || what === "import") { if (Profile.name && Profile.name !== S.name) { S.name = Profile.name; save(); } paintMe(); } },
});
seedFromHistory(Profile, S.history);
function paintMe() { $("#bMe").innerHTML = `${Profile.avatarSVG(Profile.avatar, 28)}<span>My stats</span>`; }
paintMe();
$("#bMe").onclick = () => Profile.openPanel();

/** Today's Daily game: the day's opening (same for everyone) against Strong, 7 × 6, you are Red. */
async function startDaily() {
  if (dailyOn()) { goTab("play"); toast("Your Daily game is on the table"); return; }
  if (Profile.daily.played()) { Profile.openPanel({ tab: "daily" }); return; }
  if (P.mode === "online") { abandonDaily(); if (online) await online.leave(); $("#ponline").hidden = true; $("#pstage").hidden = false; }
  const day = Profile.daily.date();
  const moves = dailyOpening(Profile.daily.rng(day));
  newLocalGame("computer", { level: "strong", daily: true, dailyDate: day, resume: {
    id: Date.now(), options: { size: "7x6", popout: false, first: 0, level: "strong" }, names: [S.name || "You", "Computer"], moves } });
  toast("Daily game: today's opening vs Strong");
}
/** A Daily game is on the table and not finished. */
function dailyOn() { return P.daily && P.mode === "computer" && !!(P.snap && P.snap.pub && !P.snap.pub.result); }
/** Leaving an unfinished Daily (new game, online, board size) counts it as lost, so it can't be retried. */
function abandonDaily() {
  if (!dailyOn()) return;
  Profile.recordResult({ mode: "computer", level: "strong", won: false, daily: true, date: P.dailyDate });
  P.daily = false;
  toast("Daily game left: counted as a loss");
}

const board = new Board($("#pboard"), { onColumn: (c) => onColumn(c) });
board.anim = boardAnim(S.anim);

function curOptions() {
  return { size: S.size, popout: !!S.popout, level: P.level };
}

export function newLocalGame(mode = P.mode, opts = {}) {
  if (!opts.daily) abandonDaily();
  P.gen++;
  if (P.room && P.room.close && P.mode !== "online") P.room.close();
  const resume = opts.resume || null;
  P.mode = mode;
  P.level = opts.level || S.level;
  P.popMode = false; P.hint = false; P.cols = null; P.pop = null; P.saved = false;
  P.daily = !!opts.daily && mode === "computer";
  P.dailyDate = P.daily ? opts.dailyDate || today() : "";
  P.helped = !!opts.helped;   // solver chips, a hint or undo were used: counted, not rated
  P.gameId = resume ? resume.id : Date.now();
  let first = 0;
  if (resume) first = resume.options.first;
  else if (mode === "computer") {
    const st = opts.starts || S.starts;
    const youFirst = st === "you" ? true : st === "computer" ? false : S.nextStart === 0;
    if (st === "alternate") { S.nextStart = 1 - S.nextStart; save(); }
    first = youFirst ? P.human : P.comp;
  } else if (mode === "friends") {
    first = S.nextStart === 1 ? 1 : 0;
  }
  P.options = resume ? { ...resume.options, level: P.level } : { ...curOptions(), first };
  let names = mode === "computer" ? [S.name || "You", "Computer"] : ["Red", "Yellow"];
  if (mode === "computer" && P.human === 1) names.reverse();
  if (resume && resume.names && resume.names.every((n) => n)) names = resume.names;
  P.room = createLocal({ game, seats: ["human", "human"], options: P.options, names });
  P.room.on("change", (s) => { if (!P.silent) render(s); });
  P.room.on("error", (e) => toast(e.message || String(e)));
  const [W, H] = sizeOf(P.options);
  const old = { cells: board.cells.slice(), W: board.W, H: board.H };
  P.fxPrev = null;
  board.build(W, H);
  if (!resume) release(board, old.cells, old.W, old.H);
  bot.warm(W, H);
  if (!resume) { P.room.start(); return; }
  P.silent = true;
  P.room.start();
  for (const m of resume.moves) P.room.act(m.d ? { draw: true } : m.p ? { c: m.c, p: true } : { c: m.c }, m.s);
  P.silent = false;
  render(P.room.view(P.room.state.turn), { animate: false });
}

/** Keeps the unfinished local game in storage so a reload brings it back. */
function saveCurrent(pub) {
  if (P.mode === "online") return;
  const cur = pub && !pub.result && pub.moves.length
    ? { mode: P.mode, id: P.gameId, level: P.level, options: { size: pub.size, popout: pub.popout, first: pub.first, level: P.level }, names: P.snap.seats.map((x) => x.name), moves: pub.moves, ...(P.daily ? { daily: P.dailyDate } : {}), ...(P.helped ? { helped: true } : {}) }
    : null;
  if (JSON.stringify(cur) === JSON.stringify(S.current)) return;
  S.current = cur;
  save();
}

function replayTo(moves) {
  // Undo: rebuild the local room and replay the remaining moves without animation.
  const gen = ++P.gen;
  const opts = P.options;
  P.room.close && P.room.close();
  const names = P.snap.seats.map((s) => s.name);
  P.room = createLocal({ game, seats: ["human", "human"], options: opts, names });
  P.room.on("change", (s) => { if (!P.silent && gen === P.gen) render(s); });
  P.room.on("error", (e) => toast(e.message || String(e)));
  P.silent = true;
  P.room.start();
  for (const m of moves) P.room.act(m.d ? { draw: true } : m.p ? { c: m.c, p: true } : { c: m.c }, m.s);
  P.silent = false;
  P.saved = false;
  P.popMode = false;
  P.fxPrev = null;
  render(P.room.view(P.room.state.turn), { animate: false });
}

function mySeatNow() {
  const s = P.snap;
  if (!s) return -1;
  if (P.mode === "computer") return P.human;
  if (P.mode === "friends") return s.pub ? s.pub.turn : 0;
  return s.mySeat;
}
function isMyTurn() {
  const s = P.snap;
  if (!s || !s.pub || s.pub.result) return false;
  if (s.status && s.status !== "playing") return false;
  if (P.resuming) return false;
  if (P.mode === "online") return s.myTurn;
  if (P.mode === "computer") return s.pub.turn === P.human;
  return true;
}

function onColumn(c) {
  const s = P.snap;
  if (!s || !s.pub) return;
  if (s.pub.result) { refuse(null); toast("Game over. Tap New game."); return; }
  if (P.resuming) { toast("Reconnecting to your room…"); return; }
  if (!isMyTurn()) { refuse(null); toast(P.mode === "computer" ? "Wait for the computer." : "Not your turn."); return; }
  // two players on one phone: a double tap would also play the other player's disc
  const now = performance.now();
  if (P.mode === "friends" && now - (P.lastTap || 0) < 350) return;
  P.lastTap = now;
  const wait = P.animUntil - 120 - performance.now();
  if (wait > 0) {
    // the last disc is still falling: play this tap as soon as it lands
    const gen = P.gen, moves = s.pub.moves.length;
    clearTimeout(P.queued);
    P.queued = setTimeout(() => { if (gen === P.gen && P.snap && P.snap.pub.moves.length === moves) { P.lastTap = 0; onColumn(c); } }, wait + 10);
    return;
  }
  const seat = s.pub.turn;
  const { W, H, cells } = s.pub;
  let a;
  if (P.popMode) {
    if (cells[c * H] !== disc(seat)) { refuse($("#pboard")); toast("Pop only your own bottom disc."); return; }
    a = { c, p: true };
  } else {
    if (cells[c * H + H - 1]) { refuse($("#pboard")); toast("That column is full."); return; }
    a = { c };
  }
  P.popMode = false;
  act(a, seat);
}

async function act(a, seat) {
  P.hint = false;
  // A refused move is reported once, by the room's "error" event.
  if (P.mode === "online") await P.room.act(a);
  else P.room.act(a, seat);
}

function render(snap, { animate = true } = {}) {
  P.snap = snap;
  if (P.mode === "online" && snap.status !== "playing" && snap.status !== "finished") { renderOnline(snap); return; }
  $("#ponline").hidden = true; $("#pstage").hidden = false;
  const pub = snap.pub;
  if (!pub) return;
  if (board.W !== pub.W || board.H !== pub.H) { board.build(pub.W, pub.H); animate = false; }
  const fxPrev = P.fxPrev;
  P.fxPrev = pub;
  const ms = board.set(pub.cells, { animate: animate && S.anim });
  P.animUntil = performance.now() + ms;
  board.line(pub.result ? pub.result.line : null);
  const last = lastCell(pub);
  board.last(pub.result ? -1 : last);
  board.popMarks(P.popMode ? popCols(pub) : null);
  renderPlayers(snap);
  renderStatus(snap);
  renderActions(snap);
  // sounds + effects for the move that just happened (online: the other player's moves too)
  const gen = P.gen;
  react(fxPrev, pub, {
    mode: P.mode, me: P.mode === "computer" ? P.human : P.mode === "online" ? snap.mySeat : -1,
    level: P.level, animMs: ms, board, status: $("#pstatus"), players: $$("#pl .pl"), alive: () => gen === P.gen,
  });
  board.setChips(null);
  P.cols = null; P.pop = null;
  $("#pverdict").textContent = "";
  if (P.mode !== "online") saveCurrent(pub);
  if (pub.result) onFinished(snap);
  else {
    if (P.mode === "online") P.saved = false; // a new online game: its result gets saved when it ends
    maybeBot(snap, ms);
    refreshAnalysis();
  }
  renderSide();
  // the disc just played came off its player's stacks
  const m = pub.moves[pub.moves.length - 1];
  if (animate && S.anim && fxPrev && m && !m.p && !m.d && pub.moves.length === fxPrev.moves.length + 1) {
    const near = nearSeat(snap);
    liftOff($$("#pl .pl")[m.s], disc(m.s), discsLeft(pub.cells, disc(m.s), pub.W, pub.H), discsEach(pub.W, pub.H), "c4:" + m.s, m.s === near ? "up" : "down");
  }
}

/** The seat at the near edge of the table (yours). */
function nearSeat(snap) {
  if (P.mode === "computer") return P.human;
  if (P.mode === "online") return snap.mySeat >= 0 ? snap.mySeat : 0;
  return 0;
}

function lastCell(pub) {
  const m = pub.moves[pub.moves.length - 1];
  if (!m || m.p || m.d) return -1;
  const { H, cells } = pub;
  for (let r = H - 1; r >= 0; r--) if (cells[m.c * H + r]) return m.c * H + r;
  return -1;
}
function popCols(pub) {
  const me = disc(pub.turn), out = [];
  for (let c = 0; c < pub.W; c++) if (pub.cells[c * pub.H] === me) out.push(c);
  return out;
}

function renderPlayers(snap) {
  const pub = snap.pub;
  const rec = matchScore();
  const wide = matchMedia("(min-width: 900px)").matches;
  $("#pl").innerHTML = [0, 1].map((i) => {
    const seat = snap.seats[i] || {};
    let sub = COLOR[i];
    if (P.mode === "computer") sub = i === P.comp ? LEVEL_NAMES[P.level] : COLOR[i];
    if (P.mode === "online") sub = seat.kind === "computer" ? "Computer" : seat.online ? (i === snap.mySeat ? "You" : "Online") : "Away";
    if (sub === (seat.name || COLOR[i])) sub = ""; // two players are named Red / Yellow: say the colour once
    const turn = !pub.result && pub.turn === i;
    const near = i === nearSeat(snap);
    return seatHTML({ v: disc(i), left: discsLeft(pub.cells, disc(i), pub.W, pub.H), total: discsEach(pub.W, pub.H), name: seat.name || COLOR[i], sub,
      score: rec ? (i === P.human ? rec.w : rec.l) : null, turn, near, h: wide ? (near ? 60 : 44) : near ? 46 : 32, seed: "c4:" + i });
  }).join("");
}

function matchScore() {
  if (P.mode !== "computer") return null;
  const o = P.options || curOptions();
  const k = P.level + ":" + o.size + (o.popout ? ":pop" : "");
  return S.record[k] || { w: 0, d: 0, l: 0 };
}

function renderStatus(snap) {
  const pub = snap.pub, el = $("#pstatus");
  el.className = "status";
  if (pub.result) {
    el.classList.add("over");
    const w = pub.result.winner;
    if (w < 0) { el.textContent = pub.result.why === "repeat" ? "Draw: same position 3 times" : pub.result.why === "called" ? "Draw called" : "Draw: the board is full"; return; }
    const name = snap.seats[w] ? snap.seats[w].name : COLOR[w];
    if (P.mode === "computer") { el.classList.add(w === P.human ? "win" : "loss"); el.innerHTML = w === P.human ? "You win!" : "The computer wins"; }
    else if (P.mode === "online") { el.classList.add(w === snap.mySeat ? "win" : "loss"); el.innerHTML = `${discIcon(disc(w))} ${esc(name)} wins`; }
    else el.innerHTML = `${discIcon(disc(w))} ${esc(name)} wins!`;
    return;
  }
  const t = pub.turn;
  if (P.resuming) el.innerHTML = `<span class="thinking">Reconnecting to your room</span>`;
  else if (P.mode === "computer") el.innerHTML = (t === P.human ? `${discIcon(disc(t))} Your turn${P.popMode ? ": pick a disc to pop" : ""}` : `<span class="thinking">Computer is thinking</span>`) + (P.daily ? " · Daily" : "");
  else if (P.mode === "online") el.innerHTML = snap.myTurn ? `${discIcon(disc(t))} Your turn${P.popMode ? ": pick a disc to pop" : ""}` : `${discIcon(disc(t))} <span class="thinking">${esc(snap.seats[t].name)} is playing</span>${snap.hostAway ? " · host offline" : ""}`;
  else el.innerHTML = `${discIcon(disc(t))} ${esc(snap.seats[t].name)}'s turn${P.popMode ? ": pick a disc to pop" : ""}`;
}

function renderActions(snap) {
  const pub = snap.pub;
  const online = P.mode === "online";
  $("#bUndo").hidden = online || P.daily;
  $("#bLeave").hidden = !online;
  $("#bHint").hidden = P.daily;
  $("#bUndo").disabled = !pub.moves.length || (P.mode === "computer" && !pub.moves.some((m) => m.s === P.human));
  const canPop = pub.popout && !pub.result && isMyTurn() && popCols(pub).length > 0;
  $("#bPop").hidden = !pub.popout;
  $("#bPop").disabled = !canPop;
  $("#bPop").classList.toggle("on", P.popMode);
  const full = pub.cells.every((v) => v);
  $("#bDraw").hidden = !(pub.popout && full && !pub.result);
  $("#bNew").hidden = online && !pub.result;
  $("#bNew").textContent = online ? "New room" : "New game";
  $("#bHint").disabled = !!pub.result || !isMyTurn();
}

$("#bHint").onclick = () => {
  P.hint = true; P.helped = true;
  const known = P.pop || (P.cols && P.cols.every((x) => !x || (x.cat !== null && x.cat !== undefined)));
  if (!known) { P.hintShown = -1; if (!P.cols && !P.pop) refreshAnalysis(true); toast("Thinking…", 900); return; }
  showHint();
};
function showHint(quiet = false) {
  const pub = P.snap.pub;
  const say = (t) => { if (!quiet) toast(t); };
  if (P.pop) {
    const { chips, best } = popChips(P.pop, pub.W);
    if (best && best.p) { say(`Best: pop column ${best.c + 1}`); board.popMarks([best.c]); }
    else if (best) { chips[best.c] = { ...chips[best.c], cls: (chips[best.c].cls || "") + " pick" }; board.setChips(chips); say(`Best: column ${best.c + 1}`); }
    return;
  }
  const b = bestLine(P.cols, count(pub.cells), pub.W, pub.H);
  if (!b) return;
  const chips = chipsFor(P.cols, count(pub.cells), pub.W, pub.H);
  for (const c of b.cols) if (chips[c]) chips[c].cls += " pick";
  board.setChips(chips);
  say(`Best: ${colList(b.cols)}${b.d ? (b.d.result === "win" ? `, win in ${b.d.turns}` : b.d.result === "loss" ? `, still lose in ${b.d.turns}` : ", draw") : ""}`);
}
$("#bUndo").onclick = () => {
  const pub = P.snap.pub;
  P.helped = true;
  let moves = pub.moves.slice();
  if (P.mode === "computer") {
    // back to your previous turn
    while (moves.length && moves[moves.length - 1].s !== P.human) moves.pop();
    if (moves.length) moves.pop();
  } else moves.pop();
  replayTo(moves);
};
$("#bPop").onclick = () => { P.popMode = !P.popMode; render(P.snap, { animate: false }); };
$("#bDraw").onclick = () => act({ draw: true }, P.snap.pub.turn);
$("#bNew").onclick = () => (P.mode === "online" ? leaveOnline(true) : newGameSheet());
$("#bLeave").onclick = () => leaveOnline(false);

function count(cells) { let n = 0; for (const v of cells) if (v) n++; return n; }

/* --------------------------------------------------------- the computer */
function maybeBot(snap, animMs) {
  if (P.mode !== "computer") return;
  const pub = snap.pub;
  if (pub.result || pub.turn !== P.comp || P.botGen === P.gen) return;
  const gen = P.gen;
  P.botGen = gen;
  const t0 = performance.now();
  bot.move(pub, P.comp, P.level).then((m) => {
    const wait = Math.max(0, Math.max(animMs + 150, 450) - (performance.now() - t0));
    setTimeout(() => {
      if (P.botGen === gen) P.botGen = -1;
      if (gen !== P.gen || !P.room) return;
      const s = P.room.state;
      if (s.result || s.turn !== P.comp) return;
      P.room.act(m, P.comp);
    }, wait);
  }).catch((e) => { if (P.botGen === gen) P.botGen = -1; toast("Computer error: " + e.message); });
}

/* ----------------------------------------------------------- the solver */
function refreshAnalysis(force = false) {
  const s = P.snap;
  if (!s || !s.pub || s.pub.result || curTab !== "play") return;
  if (!isMyTurn() || P.daily) { analyst.cancel(); return; }
  if (!S.showSolver && !force && !P.hint) return;
  const pub = s.pub;
  const gen = P.gen, moves = pub.moves.length;
  analyst.analyze({ cells: pub.cells, W: pub.W, H: pub.H, toMove: disc(pub.turn), firstDisc: disc(pub.first), popout: pub.popout, depth: 5,
    weakBudget: 4e7, strongBudget: 8e6 }, (m) => {
    if (gen !== P.gen || !P.snap || P.snap.pub.moves.length !== moves) return;
    if (m.error) return;
    if (m.pop) { P.pop = m.pop; }
    else P.cols = m.cols;
    if (S.showSolver || P.hint) drawChips();
    // a hint needs only win / draw / lose for every column, not the exact distances
    const ready = m.done || (!m.pop && m.cols && m.cols.every((x) => !x || (x.cat !== null && x.cat !== undefined)));
    if (P.hint && ready) { showHint(P.hintShown === moves); P.hintShown = moves; }
  });
}
function drawChips() {
  const pub = P.snap.pub;
  P.helped = true; // the solver's answers were on screen during this game
  if (P.pop) {
    const { chips, best } = popChips(P.pop, pub.W);
    board.setChips(chips);
    $("#pverdict").innerHTML = best ? verdictPop(best) : "";
    return;
  }
  const n = count(pub.cells);
  board.setChips(chipsFor(P.cols, n, pub.W, pub.H));
  const b = bestLine(P.cols, n, pub.W, pub.H);
  $("#pverdict").innerHTML = b ? verdictText(b) : "";
}
function verdictText(b) {
  const cols = colList(b.cols);
  if (b.cat === 2) return `Best: <b>${cols}</b> · you can win${b.d ? ` on your ${ordinal(b.d.turns)} turn` : ""} ${q("chips")}`;
  if (b.cat === 1) return `Best: <b>${cols}</b> · a draw with best play ${q("chips")}`;
  return `Best: <b>${cols}</b> · lost with best play${b.d ? `, holds out ${b.d.turns} turns` : ""} ${q("chips")}`;
}
function verdictPop(best) {
  return `Best: <b>${best.p ? "pop" : "drop in"} column ${best.c + 1}</b> ${q("popchips")}`;
}

/* ------------------------------------------------------------- finish */
function onFinished(snap) {
  analyst.cancel();
  if (P.saved || P.mode === "online" && !snap.pub) return;
  P.saved = true;
  const pub = snap.pub;
  const w = pub.result.winner;
  const firstTime = P.counted !== P.gameId;
  P.counted = P.gameId;
  if (P.mode === "computer" && firstTime) {
    const k = P.level + ":" + pub.size + (pub.popout ? ":pop" : "");
    const r = S.record[k] || { w: 0, d: 0, l: 0 };
    if (w < 0) r.d++; else if (w === P.human) r.w++; else r.l++;
    S.record[k] = r;
    renderPlayers(snap);
    if (w >= 0) {
      // the score counts up once the last disc has landed
      const sc = $$("#pl .pl")[w] && $$("#pl .pl")[w].querySelector(".sc");
      const to = w === P.human ? r.w : r.l, gen = P.gen;
      if (sc) { sc.textContent = to - 1; setTimeout(() => { if (gen === P.gen) scoreBump(sc, to - 1, to, w === P.human ? "var(--good)" : "var(--bad)"); }, Math.max(0, P.animUntil - performance.now()) + 80); }
    }
  }
  // an online game seen finished again after a reload is not counted a second time
  const onlineSeen = P.mode === "online" && seenOnline(snap);
  // the player profile (My stats): each game once
  let elo = null;
  if ((firstTime && P.mode !== "online") || (P.mode === "online" && !onlineSeen)) {
    const you = P.mode === "computer" ? P.human : P.mode === "online" ? snap.mySeat : -1;
    const res = profileResult({ mode: P.mode, level: P.level, pub, you, daily: P.daily, helped: P.helped && !P.daily });
    elo = Profile.recordResult(P.daily ? { ...res, date: P.dailyDate } : res).elo;
  }
  // two players: the loser starts the next game (after a draw, the other player starts)
  if (P.mode === "friends" && firstTime) S.nextStart = w >= 0 ? 1 - w : 1 - (pub.first || 0);
  if (!onlineSeen) {
    const id = P.mode === "online" ? Date.now() : P.gameId;
    S.history = S.history.filter((g) => g.id !== id);
    S.history.unshift({
      id, date: today(), mode: P.mode, level: P.mode === "computer" ? P.level : null,
      opts: { size: pub.size, popout: pub.popout, first: pub.first }, names: snap.seats.map((s) => s.name),
      you: P.mode === "computer" ? P.human : P.mode === "online" ? snap.mySeat : -1,
      moves: pub.moves, winner: w, why: pub.result.why,
    });
    S.history = S.history.slice(0, 40);
    save();
  }
  const eloTxt = elo ? ` <span class="elo-ch" style="color:var(--${elo.change >= 0 ? "good" : "bad"})">Elo ${elo.change >= 0 ? "+" : "−"}${Math.abs(elo.change)}</span>` : "";
  $("#pverdict").innerHTML = `<button class="btn small" id="bReview">Review this game</button>${eloTxt}`;
  $("#bReview").onclick = () => { studyGame(S.history[0]); goTab("study"); };
}

/** true if this finished online game (room code + moves) was already counted on this device. */
function seenOnline(snap) {
  const key = (snap.code || "") + "|" + snap.pub.moves.map((m) => (m.d ? "d" : (m.p ? "p" : "") + m.c)).join(",");
  let last = null;
  try { last = localStorage.getItem("c4:onlineDone"); } catch (e) { /* blocked */ }
  if (last === key) return true;
  try { localStorage.setItem("c4:onlineDone", key); } catch (e) { /* blocked */ }
  return false;
}

/* --------------------------------------------------------- side panel */
function renderSide() {
  const el = $("#pside");
  const pub = P.snap && P.snap.pub;
  if (!pub) { el.innerHTML = ""; return; }
  const rec = matchScore();
  const list = pub.moves.map((m, i) => `<span class="mv">${discIcon(disc(m.s), 12)}${i + 1}. ${m.d ? "draw" : (m.p ? "pop " : "") + (m.c + 1)}</span>`).join("");
  el.innerHTML = `
    <div class="panel"><h2>Game</h2>
      <div class="muted" style="font-size:13.5px">${esc(pub.size.replace("x", " × "))}${pub.popout ? " · Pop Out" : ""} · ${P.mode === "computer" ? (P.daily ? "Daily game · " : "") + "vs computer (" + LEVEL_NAMES[P.level] + ")" : P.mode === "friends" ? "2 players, one device" : "online"}</div>
      ${rec ? `<div style="margin-top:6px;font-size:14px">Record: <b>${rec.w}</b> won · <b>${rec.d}</b> drawn · <b>${rec.l}</b> lost</div>` : ""}
    </div>
    <div class="panel"><h2>How to read the chips ${q("chips")}</h2>
      <div class="muted" style="font-size:13.5px">Above each column: what happens if you drop there and both sides then play perfectly. "Win in 5" = your winning disc is your 5th turn from now.</div>
    </div>
    <div class="panel" style="flex:1;min-height:120px;display:flex;flex-direction:column"><h2>Moves</h2><div class="moves">${list || '<span class="muted">No moves yet.</span>'}</div></div>`;
}

/* ------------------------------------------------------------ new game */
function dailyWord() {
  if (dailyOn()) return "In progress";
  const r = Profile.daily.result();
  return r ? { w: "Won", l: "Lost", d: "Drawn", p: "Played" }[r.r] + " · next one tomorrow" : "Not played";
}
export function newGameSheet() {
  let mode = P.mode === "online" ? "computer" : P.mode, level = S.level, starts = S.starts;
  const draw = (el) => {
    el.innerHTML = `
      <h3>New game</h3>
      <div class="field"><span class="label">Opponent</span>
        <div class="seg" id="ngMode">${[["computer", "Computer"], ["friends", "Friend"], ["online", "Online"], ["daily", "Daily"]].map(([k, t]) => `<button data-k="${k}" class="${mode === k ? "on" : ""}">${t}</button>`).join("")}</div></div>
      ${mode === "computer" ? `
      <div class="field"><span class="label">Level ${q("levels")}</span>
        <div class="seg" id="ngLevel">${LEVELS.map((k) => `<button data-k="${k}" class="${level === k ? "on" : ""}" style="font-size:12.5px">${LEVEL_NAMES[k]}</button>`).join("")}</div></div>
      <div class="field"><span class="label">Who starts</span>
        <div class="seg" id="ngStart">${[["you", "You"], ["computer", "Computer"], ["alternate", "Take turns"]].map(([k, t]) => `<button data-k="${k}" class="${starts === k ? "on" : ""}">${t}</button>`).join("")}</div></div>` : ""}
      ${mode === "friends" ? `<p>Pass the phone. Red and Yellow take turns; the loser of each game starts the next.</p>` : ""}
      ${mode === "online" ? `<p>Make a room and send the code, or join a friend's room.</p>` : ""}
      ${mode === "daily" ? `<p>Today's opening against Strong, the same for everyone. No hints or undo.</p>
      <div class="muted" style="font-size:13.5px">Today: <b style="color:var(--text)">${dailyWord()}</b> · streak <b style="color:var(--text)">${Profile.daily.streak().cur}</b></div>`
      : `<div class="muted" style="font-size:13.5px">Board: <b style="color:var(--text)">${S.size.replace("x", " × ")}${S.popout ? " · Pop Out" : ""}</b> · change it in Settings</div>
      ${dailyOn() ? `<div style="font-size:13.5px;color:var(--warm)">Your Daily game will count as a loss.</div>` : ""}`}
      <div class="row end"><button class="btn" data-x>Cancel</button><button class="btn primary" data-go ${mode === "daily" && Profile.daily.played() && !dailyOn() ? "disabled" : ""}>${mode === "online" ? "Continue" : mode === "daily" && dailyOn() ? "Back to it" : "Start"}</button></div>`;
    el.querySelectorAll("#ngMode button").forEach((b) => (b.onclick = () => { mode = b.dataset.k; draw(el); }));
    el.querySelectorAll("#ngLevel button").forEach((b) => (b.onclick = () => { level = b.dataset.k; draw(el); }));
    el.querySelectorAll("#ngStart button").forEach((b) => (b.onclick = () => { starts = b.dataset.k; draw(el); }));
    el.querySelector("[data-x]").onclick = closeSheet;
    el.querySelector("[data-go]").onclick = () => {
      closeSheet();
      if (mode === "online") { openOnline(); return; }
      if (mode === "daily") { startDaily(); return; }
      S.level = level; S.starts = starts; save();
      newLocalGame(mode, { level, starts });
    };
  };
  sheet("", draw);
}

/* -------------------------------------------------------------- online */
let online = null;
function getOnline() {
  if (!online) {
    online = createOnline({ game, gameId: "connect-four", botDelayMs: 700 });
    online.on("change", (s) => { P.lastOnline = s; if (P.mode === "online") render(s); });
    online.on("error", (m) => toast(m));
  }
  return online;
}
async function loadMainThreadSolver(W, H) {
  // Computer seats in an online room run in the host's page (online.js calls game.bot directly).
  try {
    if (fitsWasm(W, H)) useFast(await makeFast(await (await fetch("js/solver.wasm")).arrayBuffer(), W, H, 20));
    if (W === 7 && H === 6) useBook(decodeBook(new Uint8Array(await (await fetch("data/book7x6.bin")).arrayBuffer())));
  } catch (e) { /* computer falls back to look-ahead */ }
}
function openOnline() {
  abandonDaily();
  P.gen++;
  if (P.room && P.mode !== "online" && P.room.close) P.room.close();
  P.mode = "online";
  P.room = getOnline();
  P.fxPrev = null;
  P.onlineView = "home";
  renderOnline({ status: "none" });
}
function renderOnline(snap) {
  $("#pstage").hidden = true;
  const box = $("#ponline");
  box.hidden = false;
  $("#pl").innerHTML = ""; $("#pstatus").textContent = ""; $("#pverdict").textContent = "";
  $$("#pactions .btn").forEach((b) => (b.hidden = true));
  const st = snap.status;
  if (st === "lobby") {
    const host = snap.isHost;
    box.innerHTML = `<div class="panel" style="display:flex;flex-direction:column;gap:10px">
      <div class="muted" style="text-align:center">Room code ${q("roomcode")}</div>
      <div class="code" id="code">${esc(snap.code)}</div>
      <div id="seats">${snap.seats.map((x, i) => `<div class="seat"><span>${discIcon(disc(i))} <span class="on-dot ${x.online ? "on" : ""}"></span>${esc(x.kind === "empty" ? "Open seat" : x.name)}${i === snap.mySeat ? " (you)" : ""}${x.isHost ? " · host" : ""}</span>
        ${host && i !== snap.mySeat ? `<button class="btn small" data-seat="${i}" data-kind="${x.kind === "computer" ? "empty" : "computer"}">${x.kind === "computer" ? "Open seat" : "Computer"}</button>` : `<span class="muted">${x.kind === "computer" ? "computer" : ""}</span>`}</div>`).join("")}</div>
      <div class="muted" style="font-size:13.5px">${esc((snap.options.size || "7x6").replace("x", " × "))}${snap.options.popout ? " · Pop Out" : ""} · ${snap.options.first === 1 ? "Yellow" : "Red"} starts</div>
      <div class="row">${host ? `<button class="btn primary grow" id="oStart">Start</button>` : `<span class="muted grow">Waiting for the host to start…</span>`}<button class="btn" id="oLeave">Leave</button></div></div>`;
    box.querySelectorAll("[data-seat]").forEach((b) => (b.onclick = () => online.setSeat(+b.dataset.seat, b.dataset.kind)));
    if (host) $("#oStart").onclick = async () => {
      const r = await online.start();
      if (!r.ok) toast(r.message);
    };
    $("#oLeave").onclick = () => leaveOnline(false);
    return;
  }
  const waiting = st === "joining";
  box.innerHTML = `<div class="panel" style="display:flex;flex-direction:column;gap:10px">
    <h2>Play online ${q("online")}</h2>
    <input type="text" id="oName" maxlength="20" placeholder="Your name" autocomplete="nickname" value="${esc(S.name)}">
    <button class="btn primary" id="oCreate">Create room</button>
    <div class="row"><input type="text" id="oCode" placeholder="Room code" autocapitalize="characters" style="text-transform:uppercase"><button class="btn" id="oJoin">Join</button></div>
    <div class="muted" style="font-size:13.5px;min-height:18px" id="oMsg">${waiting ? "Waiting for the host to let you in…" : st === "closed" ? "The room was closed." : ""}</div>
    <button class="btn" id="oBack">Back to the computer</button></div>`;
  const name = () => { const n = $("#oName").value.trim() || "Player"; S.name = n; save(); return n; };
  $("#oCreate").onclick = async () => {
    $("#oMsg").textContent = "Making a room…";
    const [W, H] = sizeOf({ size: S.size });
    loadMainThreadSolver(W, H);
    const r = await online.createRoom({ name: name(), seats: ["human", "empty"], options: { size: S.size, popout: !!S.popout, first: 0, level: S.level } });
    if (!r.ok) $("#oMsg").textContent = r.message;
  };
  // codes are 5 letters/digits: drop spaces and dashes people paste, then limit the length
  $("#oCode").oninput = (e) => { const v = e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 5); if (v !== e.target.value) e.target.value = v; };
  $("#oJoin").onclick = async () => {
    const code = $("#oCode").value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 5);
    if (!code) { $("#oMsg").textContent = "Type the room code first."; return; }
    $("#oMsg").textContent = "Joining…";
    const r = await online.joinRoom(code, name());
    if (!r.ok) $("#oMsg").textContent = r.message;
  };
  $("#oBack").onclick = () => leaveOnline(false, true);
}
async function leaveOnline(newRoom, toComputer) {
  if (online) await online.leave();
  if (newRoom) { openOnline(); return; }
  P.mode = "computer";
  $("#ponline").hidden = true; $("#pstage").hidden = false;
  newLocalGame("computer");
}

/* --------------------------------------------------------------- boot */
initStudy({ ordinal });
initTable();
const startTab = (location.hash || "#play").slice(1);
history.replaceState({ tab: startTab }, "", "#" + startTab);
let hadRoom = false;
try { hadRoom = !!JSON.parse(localStorage.getItem("online.connect-four") || "null"); } catch (e) {}
P.resuming = hadRoom;
if (S.current) newLocalGame(S.current.mode, { level: S.current.level, resume: S.current, helped: !!S.current.helped,
  daily: !!S.current.daily && !Profile.daily.played(S.current.daily), dailyDate: S.current.daily });
else newLocalGame("computer");
goTab(startTab, false);
getOnline().resume().then((back) => {
  P.resuming = false;
  if (!back) { if (hadRoom && P.snap && P.snap.pub) render(P.snap, { animate: false }); return; }
  P.gen++;
  if (P.room && P.room.close && P.mode !== "online") P.room.close();
  P.mode = "online"; P.room = online; P.fxPrev = null;
  const s = P.lastOnline || { status: "none" };
  if (s.options) { const [W, H] = sizeOf(s.options); loadMainThreadSolver(W, H); }
  render(s);
}).catch(() => { P.resuming = false; if (P.snap && P.snap.pub) render(P.snap, { animate: false }); });

// Laptop: the board takes the whole table column; the status, verdict and buttons sit at the top
// of the side column. Phone: they go back on the table / under it. Same elements, just moved.
function placeControls(wide) {
  const ctrl = $("#pctrl"), main = $("#ptable").parentElement;
  if (wide) ctrl.append($("#pstatus"), $("#pverdict"), $("#pactions"));
  else { $("#ptable").append($("#pstatus"), $("#pverdict")); main.append($("#pactions")); }
}
placeControls(matchMedia("(min-width: 900px)").matches);
// laptop window dragged across the 900 px layout change: move the controls, redraw the seats at the new size
try { matchMedia("(min-width: 900px)").addEventListener("change", (e) => { placeControls(e.matches); if (P.snap && P.snap.pub && !$("#pstage").hidden) renderPlayers(P.snap); }); } catch (e) { /* old browser */ }

hooks.settingsChanged = settingsChanged;
function settingsChanged(what) {
  board.anim = boardAnim(S.anim);
  if (what === "board" && P.mode !== "online") newLocalGame(P.mode === "friends" ? "friends" : "computer");
  if (what === "solver" && P.snap && P.snap.pub && !P.snap.pub.result) { if (!S.showSolver) { board.setChips(null); $("#pverdict").textContent = ""; analyst.cancel(); } else refreshAnalysis(); }
}
export { P };
