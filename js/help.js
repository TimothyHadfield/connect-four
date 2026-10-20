/* Text behind the small "?" buttons: says WHY, in plain words. */
import { strengthTable } from "./strength.js";

export const HELP = {
  chips: ["What the chips mean", `
    <p>Each chip says what happens if you drop in that column and then <b>both players play perfectly</b>.</p>
    <p><b>Win in 5</b>: you can force a win, and your winning disc is your 5th turn from now. <b>Lose in 9</b>: the other side can force a win on their 9th turn. <b>Draw</b>: nobody can force a win.</p>
    <p>Why trust it: the app has a full solver. On the classic board it uses John Tromp's database of every 8-disc position plus its own search, so the verdict is exact, not a guess. A dashed chip is still being worked out.</p>`],
  popchips: ["Pop Out numbers", `
    <p>Pop Out isn't solved here: popping lets positions repeat, so the game can go on and on.</p>
    <p>Instead the computer looks 5 moves ahead. <b>Win in N</b> / <b>Lose in N</b> means it found a forced result inside that window. Other chips are a score: plus is good for you, minus is bad.</p>`],
  levels: ["How strong is each level?", `<p>Each level played thousands of games against the others (and against random play). The win rates below are measured, not guessed.</p><p><b>Perfect</b> solves the position exactly on 7 × 6, 6 × 5, 8 × 7 and 5 × 4 when it can in time; on 9 × 7 (unsolved) and in Pop Out it looks ahead instead, so there it can be beaten.</p>${strengthTable()}`],
  online: ["Online play", `
    <p>One player makes a room and reads out the 5-letter code; the other types it in. Moves show up on both phones within a second.</p>
    <p>If someone drops out, reloading the page puts them back in their seat. It's free: no account, nothing to install.</p>`],
  roomcode: ["Room code", `<p>Friends type this code on their own phone to join. Rooms can't be found any other way, and they're deleted when the host closes them or after two days.</p>`],
  tablemode: ["Entering a real board", `
    <p>Pick a colour, then tap a column to drop that colour in. Do the columns bottom to top, like the real board.</p>
    <p>The app works out whose turn it is from the number of discs and who started.</p>`],
  threats: ["Threats and odd/even rows", `
    <p>A dot marks an empty spot that would finish four in a row for that colour.</p>
    <p>Why rows matter: near the end, spots fill up from the bottom, and whoever is forced to play under a threat loses. As a rule of thumb the <b>first player</b> wants threats on <b>odd rows</b> (1st, 3rd, 5th from the bottom) and the <b>second player</b> on <b>even rows</b>. Dots with a white edge are on the row that suits their colour.</p>`],
  points: ["Points lost", `
    <p>Each move is scored against the best move in that position.</p>
    <p><b>Best</b>: kept the best result. <b>Slower</b>: still the same result, but the win comes later (or the loss sooner). <b>Mistake</b>: a win became a draw, or a draw became a loss. <b>Blunder</b>: a win became a loss.</p>
    <p>Points lost = how many turns the move gave away, counted by the solver. A changed result costs many points.</p>`],
  puzzles: ["Puzzles", `<p>Positions from sensible practice games where exactly one column wins by force (checked by the solver). Find it, then keep going until you've connected four. The computer defends perfectly.</p>`],
  firstmove: ["Opening map", `<p>What each first move leads to if both sides then play perfectly. On the classic 7 × 6 board only the middle column wins for the player who starts; the two next to it draw.</p>`],
  sizes: ["Other boards", `<p>Results with perfect play for each board size, from John Tromp's results table. + = the first player wins, = = draw, − = the second player wins. Blank = nobody has solved it yet.</p>`],
  cellpower: ["Cell power", `<p>How many different four-in-a-rows pass through each spot. The middle spots are part of the most lines, which is why the centre column is so strong.</p>`],
  solver: ["Show the solver while playing", `<p>Shows the chips above the columns on your turn. Turn it off to play blind; the Hint button still shows the best move when you ask.</p>`],
  popout: ["Pop Out", `
    <p>On your turn, either drop a disc or <b>pop one of your own discs out of the bottom row</b>; the column slides down.</p>
    <p>If a pop makes four in a row for both colours, the player who popped wins. With a full board you can pop or call it a draw. The same position three times is a draw.</p>`],
  starts: ["Who starts", `<p>On the classic board the player who starts can always win with perfect play, so taking turns is the fair choice.</p>`],
};
