// Two separate headless browsers (Safari engine, iPhone size) play an online room
// on the REAL Firebase project: create, join by code, alternate moves, reload mid-game,
// play to a win, both see the same ending, host closes the room.
//   node tools/two-browsers.mjs [url] [--engine webkit|chromium] [--shots dir]
// Needs playwright from ~/.claude/tools/node_modules.
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
const require = createRequire(join(homedir(), ".claude/tools/") + "x.js");
const pw = require("playwright");

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith("http")) || "https://timothyhadfield.github.io/connect-four/";
const engine = args.includes("--engine") ? args[args.indexOf("--engine") + 1] : "webkit";
const shots = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
const fail = (m) => { console.error("FAIL: " + m); process.exit(1); };

const opts = engine === "webkit" ? { ...pw.devices["iPhone 13"], viewport: { width: 393, height: 659 } } : {};
const bA = await pw[engine].launch(), bB = await pw[engine].launch();
const A = await (await bA.newContext(opts)).newPage(), B = await (await bB.newContext(opts)).newPage();
const errs = [], noise = [];
let reloading = false;
for (const [n, p] of [["A", A], ["B", B]]) {
  p.on("console", (m) => { if (m.type() === "error" && !/BloomFilter/.test(m.text())) (reloading && n === "B" ? noise : errs).push(n + ": " + m.text()); });
  p.on("pageerror", (e) => (reloading && n === "B" ? noise : errs).push(n + " pageerror: " + e.message));
}
const shot = async (p, name) => { if (shots) await p.screenshot({ path: `${shots}/${name}.png` }); };

async function goOnline(p, name) {
  await p.goto(url);
  await p.waitForSelector("#pboard svg");
  await p.click("#bNew");
  await p.click("#ngMode button[data-k='online']");
  await p.click("[data-go]");
  await p.waitForSelector("#oName");
  await p.fill("#oName", name);
}
await goOnline(A, "Alice");
await goOnline(B, "Bob");
await A.click("#oCreate");
await A.waitForSelector("#code", { timeout: 25000 });
const code = (await A.textContent("#code")).trim();
console.log("room code", code);
await shot(A, "online-lobby");

await B.fill("#oCode", code);
await B.click("#oJoin");
await A.waitForFunction(() => /Bob/.test(document.querySelector("#seats").textContent), null, { timeout: 30000 });
console.log("PASS Bob is seated");
await A.click("#oStart");
await A.waitForSelector("#pstage:not([hidden]) #pboard svg", { timeout: 25000 });
await B.waitForSelector("#pstage:not([hidden]) #pboard svg", { timeout: 25000 });
console.log("PASS both see the board");

const myTurn = (p) => p.waitForFunction(() => /Your turn/.test(document.querySelector("#pstatus").textContent), null, { timeout: 30000 });
const drop = async (p, c) => { await myTurn(p); await p.waitForTimeout(700); await p.click(`#pboard .hit[data-col='${c}']`); };
const discs = (p) => p.$$eval("#pboard .disc", (e) => e.length);

// Alice (red, starts) builds a column-1 tower; Bob plays column 2.
await drop(A, 0); await drop(B, 1); await drop(A, 0); await drop(B, 1);
await A.waitForFunction(() => document.querySelectorAll("#pboard .disc").length === 4, null, { timeout: 20000 });
console.log("PASS 4 moves through the network");
await shot(B, "online-mid-bob");

// Bob reloads mid-game and must be put back in his seat
reloading = true;
await B.reload();
await B.waitForSelector("#pstage:not([hidden]) #pboard svg", { timeout: 30000 });
await B.waitForFunction(() => document.querySelectorAll("#pboard .disc").length === 4, null, { timeout: 30000 });
reloading = false;
console.log("PASS Bob reloaded and is back in the game with 4 discs on the board");

await drop(A, 0); await drop(B, 1); await drop(A, 0);
for (const [p, n] of [[A, "Alice"], [B, "Bob"]]) {
  await p.waitForFunction(() => /win/i.test(document.querySelector("#pstatus").textContent), null, { timeout: 30000 });
  console.log(`PASS ${n} sees: ${(await p.textContent("#pstatus")).trim()}`);
}
if ((await discs(A)) !== 7 || (await discs(B)) !== 7) fail("disc counts differ at the end");
await shot(A, "online-end-alice"); await shot(B, "online-end-bob");
// host leaves (hands over or closes)
await A.click("#bLeave").catch(() => {});
await A.waitForTimeout(1500);
if (noise.length) console.log(`note: ${noise.length} cut-off request messages while Bob's page reloaded`);
if (errs.length) fail("console errors:\n" + errs.join("\n"));
console.log(`PASS no console errors (${engine})`);
await bA.close(); await bB.close();
