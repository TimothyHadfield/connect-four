/* The rules sheet and the guided first game (shared kit js/coach.js: never edit that one here).
 * Rules in our own words, the same rules js/game.js plays. */

export function rules() {
  return {
    title: "Connect Four rules",
    intro: "The classic game, plus the extra boards and rules (Pop Out, Five, Power) you can pick in Settings or New game.",
    foot: "Connect Four is a Hasbro trademark; this is a free fan-made site.",
    sections: [
      { id: "goal", title: "Goal", short: "Goal", html: "<p>Be the first to get <b>four of your colour in a line</b>: across, up and down, or diagonal.</p><p class=\"tip\">Look for two ways to win at once: your opponent can only block one of them.</p>" },
      { id: "setup", title: "Setting up", short: "Setup", html: "<ul><li>The standing frame has 7 columns and 6 rows. Each player takes the 21 discs of one colour.</li><li>Red starts (in New game you choose who starts against the computer; with two players the loser starts the next game).</li></ul>" },
      { id: "turn", title: "Your turn", short: "Turn", html: "<ul><li>Drop one disc into any column that isn't full. It falls to the lowest empty hole.</li><li>Then it's the other player's turn. You can't pass.</li></ul>" },
      { id: "end", title: "End of the game", short: "End", html: "<ul><li>Four in a row wins at once.</li><li>A full board with no four is a <b>draw</b>.</li><li>Pull the slider at the bottom and the discs fall out for the next game (New game).</li></ul>" },
      { id: "pop", title: "Pop Out", short: "Pop Out", html: "<p>Switch it on in Settings. On your turn you may, instead of dropping, <b>pop one of your own discs out of the bottom row</b>; the column above slides down one hole.</p><ul><li>A pop that makes four for both colours wins for the player who popped.</li><li>When the board is full you must pop, or you may call a draw.</li><li>The same position three times is a draw.</li></ul>" },
      { id: "five", title: "Five in a row", short: "Five", html: "<p>The boxed Five-in-a-Row version. Pick <b>Five</b> under Rules.</p><ul><li>The frame is 9 columns by 6 rows. The two outer columns start full of alternating discs (left: Red at the bottom, right: Yellow).</li><li>You need <b>five</b> of your colour in a line. The starting discs count.</li><li>Each player still plays 21 discs; a full board is a draw.</li></ul>" },
      { id: "power", title: "Power discs", short: "Power", html: "<p>House rules after the Power Up edition. Pick <b>Power</b> under Rules. Once per game each, tap <b>Power</b> and play one instead of a normal disc:</p><ul><li><b>Anvil</b>: your disc that knocks every disc below it out of the column and lands on the bottom.</li><li><b>Bomb</b>: pop one of the other player's discs out of the bottom row; the column slides down. If that makes four for both colours, the bomber wins.</li><li><b>Wall</b>: a grey disc that counts for nobody.</li></ul>" },
      { id: "sizes", title: "Other boards", short: "Boards", html: "<table><tr><th>Board</th><th>Name</th></tr><tr><td>7 × 6</td><td>Classic</td></tr><tr><td>6 × 5</td><td>Small</td></tr><tr><td>8 × 7</td><td>Big</td></tr><tr><td>9 × 7</td><td>Huge</td></tr><tr><td>5 × 4</td><td>Tiny</td></tr></table><p>The rules stay the same; only the frame changes.</p>" },
      { id: "videos", title: "Videos", short: "Videos", html: "<p>Good watching, all on YouTube (opens a new tab):</p><ul>" +
        [["https://www.youtube.com/watch?v=0EhClCmrg08", "How to Play Connect 4: Quick Rules Guide", "TableTopTurns"],
         ["https://www.youtube.com/watch?v=YqqcNjQMX18", "The Best Strategy to Win at Connect 4 (Odd Even Strategy)", "Keith Galli"],
         ["https://www.youtube.com/watch?v=3R1Cx6uGjMw", "How to win at Connect 4 almost every time!", "Keith Galli"],
         ["https://www.youtube.com/watch?v=yDWPi1pZ0Po", "Connect Four (is it always a first-player win?)", "Numberphile"]]
          .map(([u, t, by]) => `<li><a href="${u}" target="_blank" rel="noopener">${t}</a> <span class=\"muted\">· ${by}</span></li>`).join("") + "</ul>" },
      { id: "help", title: "Chips, Hint and Undo", short: "Help", html: "<ul><li><b>Chips</b> (Settings › Show the solver) sit above each column: what happens if you drop there and both sides then play perfectly.</li><li><b>Hint</b> shows the best column. <b>Undo</b> takes back your last turn.</li><li>A game with any of these counts in My stats under \"with help\" and doesn't change your Elo. Leaving a game after your first disc counts as a loss.</li></ul>" },
    ],
  };
}

/** The guided first game's steps. ctx: { pub: () => the guided game's public state or null, you: seat } */
export function steps(ctx) {
  const pub = () => ctx.pub();
  const mine = () => { const p = pub(); return p ? p.moves.filter((m) => m.s === ctx.you).length : 0; };
  const myTurn = () => { const p = pub(); return !!p && !p.result && p.turn === ctx.you; };
  const over = () => { const p = pub(); return !!p && !!p.result; };
  // true once you've dropped another disc since the step first showed (a player who plays on moves the tour on)
  const playedOn = () => { let n = null; return () => { const m = mine(); if (n === null) n = m; return m > n; }; };
  const vis = (sel) => { const el = document.querySelector(sel); return el && el.getClientRects().length ? el : null; };
  // phone on its side: the board fills the height, so a note about the board points at the computer's seat
  // (right of the board) and stays narrow, instead of scrolling in the thin strip under the board
  const sideways = () => typeof matchMedia === "function" && matchMedia("(orientation: landscape) and (max-height: 500px)").matches;
  const board = () => (sideways() && vis("#pl .pl.far")) || "#pboard";
  const steps = [
    { title: "Your first game", text: "You're Red against the Beginner computer. Get four in a line (across, up or diagonal) before Yellow does.", target: board, until: playedOn(), next: true },
    { title: "Drop a disc", text: "Tap a column: the disc falls to the lowest empty hole. The middle column is the strongest start.", target: board, when: myTurn, until: () => mine() > 0 },
    { title: "Yellow's turn", text: "Yellow answered. Your discs come off your stacks at the near edge, as on a real table.", target: () => vis("#pl .pl.near") || "#pboard", when: () => mine() > 0 && myTurn(), until: playedOn(), next: true },
    { title: "The chips", text: "The chips show what happens if you drop there and both sides then play perfectly. Turn them on in Settings.", target: board, when: myTurn, until: playedOn(), next: true, skipIf: over },
    { title: "Hint and Undo", text: "Hint shows the best column; Undo takes back your turn. Chips, Hint or Undo make a game \"with help\": no Elo change.", target: () => vis("#bHint") || "#pactions", until: playedOn(), next: true, skipIf: over },
    { title: "Play it out", text: "Block any three Yellow discs in a line, and play on until someone gets four.", target: board, until: over, skipIf: over },
    { title: "My stats", text: "Your results, Elo for each level, achievements and the Daily game. This guided game isn't counted.", target: "#bMe", when: over },
    { title: "Your next game", text: "Pick a level, who starts, or today's Daily game. The full rules are in Settings.", target: () => vis("#bNew") || "#pactions" },
  ];
  // a wider note (fewer lines) where there's room; narrow beside the board when sideways
  return steps.map((st) => ({ ...st, get width() { return sideways() && st.target === board ? 300 : 520; } }));
}
