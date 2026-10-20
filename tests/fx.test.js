/* Sound & effects: the event -> sound map for real games, the Settings switches, and the
 * end-of-game celebration. Uses the real js/fx.js with a fake AudioContext (counts what plays)
 * and fake elements (count animations). */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ---- fakes: audio that "plays", a tiny DOM for the animation helpers
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
const node = (x) => Object.assign({ connect() {}, disconnect() {} }, x);
class FakeAC {
  constructor() { this.sampleRate = 8000; this.state = "running"; this.destination = {}; this.t = 0; }
  get currentTime() { return (this.t += 1); } // a new time each call, so the 80 ms throttle never hides a sound
  createGain() { return node({ gain: param() }); }
  createDynamicsCompressor() { return node({}); }
  createOscillator() { return node({ type: "sine", frequency: param(), start() {}, stop() {} }); }
  createBiquadFilter() { return node({ type: "", frequency: param(), Q: param() }); }
  createBufferSource() { return node({ start() {}, stop() {} }); }
  createStereoPanner() { return node({ pan: param() }); }
  createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
  resume() { return Promise.resolve(); }
}
globalThis.AudioContext = FakeAC;
let animations = 0;
const fakeEl = () => ({
  style: {}, isConnected: true, textContent: "", firstChild: null,
  animate() { animations++; const a = { onfinish: null, oncancel: null }; setTimeout(() => a.onfinish && a.onfinish(), 1); return a; },
  getBoundingClientRect() { return { left: 0, top: 0, width: 40, height: 40 }; },
  appendChild(c) { return c; }, setAttribute() {}, remove() {},
});
globalThis.document = {
  addEventListener() {}, createElement: fakeEl, createElementNS: fakeEl,
  body: { appendChild(c) { return c; } }, head: { appendChild() {} }, getElementById: () => null,
};
globalThis.innerWidth = 393; globalThis.innerHeight = 659;
globalThis.requestAnimationFrame = (f) => setTimeout(() => f(Date.now()), 16);

await import("../js/fx.js");
const FX = globalThis.FX;
const { defineSounds, react, release, refuse, eventsFor, boardAnim } = await import("../js/sfx.js");
const { game } = await import("../js/game.js");

FX.init({ game: "connect-four-test", clicks: false });
defineSounds();
FX.unlock();

// spy: names that really played (FX.play returns true only when sound is on and allowed)
let played = [], celebrated = [];
const realPlay = FX.play, realCelebrate = FX.celebrate;
FX.play = (n, o) => { const ok = realPlay(n, o); if (ok) played.push(n); return ok; };
FX.celebrate = (o) => { celebrated.push(o.kind); return realCelebrate(o); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// celebrate() plays its fanfare / cheer / lose through fx.js's own play(), which the spy can't
// see: count those as all real plays minus the ones the spy saw.
let base = 0;
const celebSounds = () => FX.stats.plays - base - played.length;
beforeEach(() => { FX.reset(); played = []; celebrated = []; animations = 0; base = FX.stats.plays; });

/** Play a scripted game through the real engine, calling react() after every move like the page does. */
function playGame(moves, ctx, options = { size: "7x6" }) {
  let s = game.setup(2, options);
  let prev = game.publicView(JSON.parse(JSON.stringify(s)));
  const board = { discs: new Map(), H: s.H, W: s.W };
  for (const m of moves) {
    s = game.apply(s, s.turn, m);
    const pub = game.publicView(JSON.parse(JSON.stringify(s)));
    for (let i = 0; i < pub.cells.length; i++) if (pub.cells[i] && !board.discs.has(i)) { const w = fakeEl(); w.firstChild = fakeEl(); board.discs.set(i, w); }
    react(prev, pub, { board, status: fakeEl(), players: [fakeEl(), fakeEl()], animMs: 0, ...ctx });
    prev = pub;
  }
  return s;
}
const fakeBoard = () => ({ W: 7, H: 6, discLayer: fakeEl(), xy: () => [0, 0], makeDisc: fakeEl });
// Red (seat 0, you) wins with four across the bottom; Yellow (computer) stacks on column 0... then 6
const RED_WINS = [{ c: 1 }, { c: 1 }, { c: 2 }, { c: 2 }, { c: 3 }, { c: 6 }, { c: 4 }];

test("a vs-computer game makes the right sounds in order, and a win celebrates", async () => {
  const s = playGame(RED_WINS, { mode: "computer", me: 0, level: "medium" });
  assert.equal(s.result.winner, 0);
  await wait(400);
  const drops = played.filter((n) => n === "clack").length;
  assert.equal(drops, RED_WINS.length, "one clack per disc dropped");
  // your-turn chime after each computer move (3 computer moves, the game ends on your move)
  assert.equal(played.filter((n) => n === "turn").length, 3);
  assert.deepEqual(celebrated, ["win"]);
  assert.equal(celebSounds(), 2, "fanfare + cheer");
  assert.ok(!played.includes("error"));
});

test("losing to the computer: 'lose', not 'win'", async () => {
  playGame([{ c: 0 }, ...RED_WINS], { mode: "computer", me: 0 }); // now Yellow (computer, seat 1) makes the four
  await wait(300);
  assert.deepEqual(celebrated, ["lose"]);
  assert.equal(celebSounds(), 1, "the lose tune only, no cheer");
});

test("two players on one device: no your-turn chime, and the winner always gets confetti", async () => {
  playGame(RED_WINS, { mode: "friends", me: -1 });
  await wait(300);
  assert.equal(played.filter((n) => n === "turn").length, 0);
  assert.deepEqual(celebrated, ["win"]);
});

test("online: each player sees their own result", async () => {
  playGame(RED_WINS, { mode: "online", me: 1 });
  await wait(300);
  assert.deepEqual(celebrated, ["lose"]);
  assert.equal(played.filter((n) => n === "turn").length, 3, "chime when the other player's move makes it my turn");
});

test("beating Perfect adds the big sparkle", async () => {
  playGame(RED_WINS, { mode: "computer", me: 0, level: "perfect" });
  await wait(1100);
  assert.deepEqual(celebrated, ["win", "big"]);
});

test("Pop Out: pop, then the column settles", async () => {
  // Red bottom of col 0 with Yellow above; Red pops it out
  const moves = [{ c: 0 }, { c: 0 }, { c: 3 }, { c: 4 }, { c: 0, p: true }];
  playGame(moves, { mode: "computer", me: 0 }, { size: "7x6", popout: true });
  await wait(400);
  assert.ok(played.includes("discPop"));
  assert.ok(played.includes("settle"));
});

test("drop pitch follows the fall: a disc landing high is pitched up", () => {
  let s = game.setup(2, { size: "7x6" });
  const prev0 = game.publicView(JSON.parse(JSON.stringify(s)));
  s = game.apply(s, 0, { c: 0 });
  const e1 = eventsFor(prev0, game.publicView(s))[0];
  for (let i = 0; i < 4; i++) s = game.apply(s, s.turn, { c: 0 });
  const prev = game.publicView(JSON.parse(JSON.stringify(s)));
  s = game.apply(s, s.turn, { c: 0 });
  const e6 = eventsFor(prev, game.publicView(s))[0];
  assert.equal(e1.r, 0); assert.equal(e6.r, 5);
  assert.ok(e6.fall < e1.fall);
});

test("Undo / reload (more than one move changed) stays silent", () => {
  let s = game.setup(2, { size: "7x6" });
  const prev = game.publicView(JSON.parse(JSON.stringify(s)));
  s = game.apply(s, 0, { c: 0 }); s = game.apply(s, 1, { c: 1 });
  assert.deepEqual(eventsFor(prev, game.publicView(s)), []);
  assert.deepEqual(eventsFor(null, game.publicView(s)), []);
});

test("Sound off: nothing plays, all game long", async () => {
  FX.set("sound", false);
  playGame(RED_WINS, { mode: "computer", me: 0 });
  refuse(fakeEl());
  release({ W: 7, H: 6 }, [1, 2, 1], 7, 6);
  await wait(400);
  assert.deepEqual(played, []);
  assert.equal(FX.stats.plays - base, 0, "not even the fanfare");
});

test("Game sounds off: no disc sounds, alerts and celebrations still on", async () => {
  FX.set("moves", false);
  playGame(RED_WINS, { mode: "computer", me: 0 });
  await wait(450);
  assert.ok(!played.includes("clack"));
  assert.ok(played.includes("turn"));
  assert.equal(celebSounds(), 2);
});

test("Celebrations off: no celebration sound or confetti", async () => {
  FX.set("celebrations", false);
  playGame(RED_WINS, { mode: "computer", me: 0 });
  await wait(400);
  assert.deepEqual(celebrated, ["win"], "the page still asks");
  assert.equal(celebSounds(), 0, "but no fanfare or cheer");
  assert.ok(played.includes("clack"));
});

test("Animations off: no animation runs (board drop too), sounds still play", async () => {
  // control: with animations on, the same game animates (winning discs pop, chip pops)
  playGame(RED_WINS, { mode: "computer", me: 0 });
  refuse(fakeEl());
  await wait(500);
  assert.ok(animations > 0, "control: animations run when on");
  assert.equal(boardAnim(true), 1);
  FX.set("animSpeed", "fast");
  assert.equal(boardAnim(true), 0.55, "Fast shortens the board's own drop");
  assert.equal(boardAnim(false), 0, "the Drop animation switch still works");

  animations = 0;
  release(fakeBoard(), [1, 2, 1, 0, 0, 0], 7, 6);
  assert.equal(animations, 3, "control: the old discs fall out of the board");

  FX.set("animations", false);
  animations = 0; played = [];
  playGame(RED_WINS, { mode: "computer", me: 0 });
  refuse(fakeEl());
  release(fakeBoard(), [1, 2, 1, 0, 0, 0], 7, 6);
  await wait(500);
  assert.equal(animations, 0);
  assert.ok(played.includes("release"), "the release still sounds");
  assert.equal(boardAnim(true), 0, "board drop is instant");
  assert.ok(played.includes("clack") && played.includes("error"));
});

test("illegal tap: soft error", () => {
  refuse(fakeEl());
  assert.deepEqual(played, ["error"]);
});

test("new game: the slider release clatters", () => {
  release({ W: 7, H: 6, discLayer: null }, [1, 0, 2], 7, 6);
  assert.deepEqual(played, ["release"]);
  played = [];
  release({ W: 7, H: 6 }, [0, 0, 0], 7, 6);
  assert.deepEqual(played, [], "empty board: nothing to release");
});

test("a draw is gentle: no confetti, no fanfare", async () => {
  // 5x4 filled with no four: columns in order a pattern known to draw
  let s = game.setup(2, { size: "5x4" });
  const order = [0, 1, 0, 1, 1, 0, 1, 0, 2, 3, 2, 3, 3, 2, 3, 2, 4, 4, 4, 4];
  let prev = game.publicView(JSON.parse(JSON.stringify(s)));
  for (const c of order) {
    s = game.apply(s, s.turn, { c });
    const pub = game.publicView(JSON.parse(JSON.stringify(s)));
    react(prev, pub, { mode: "computer", me: 0, animMs: 0, status: fakeEl(), players: [fakeEl(), fakeEl()] });
    prev = pub;
    if (s.result) break;
  }
  assert.equal(s.result && s.result.winner, -1, "fixture is a draw");
  await wait(300);
  assert.deepEqual(celebrated, []);
  assert.ok(played.includes("drawTone"));
});
