# chat log — Connect Four

## 2026-10-20 — first build (builder agent under the games manager)
- **Asked:** Tim: "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." Manager brief: 7×6 + Pop Out + sizes, bitboard solver in a worker, measured levels, study mode, real-table companion, original SVG art, online via _online.
- **Built:** whole site (Play, Study, Table, Settings), wasm solver + opening book, 5 levels, 27 puzzles, online play, tools (strength, puzzles, book, two-browsers).
- **Verified:** `npm test` 22/22 with mutation checks; live smoke on WebKit iPhone + desktop (full games, every tab, 0 console errors, 0 failed requests, no overflow); `node tools/two-browsers.mjs` on the live site (join, 4 moves, reload rejoin, win seen by both) all PASS; strength run 3,700 games.
- **Open:** see progress.md NOT verified.

## 2026-10-20 — QA fixes (build 2)
- **Asked:** manager relayed the fresh QA agent's 9 bugs + 2 suspicions (computer stuck after a new game mid-think, reload lost the game, broken saved data, Undo double-counting, Hint with solver off, 320px stepper, Table one size only, tap during the falling disc, room-code length, taps during online reconnect).
- **Built:** js/saved.js (validation), game restore on reload, computer gate by game number, once-per-game record, hint on verdicts (not distances), queued taps, per-size table, stepper fits 320px, room code cleaned to 5 characters, "Reconnecting to your room" blocks taps. online.js re-copied (_online cf38e03).
- **Verified:** tests/saved.test.js failed 3/4 on the old loader, passes on the new; tools/regress.mjs 11/12 FAIL on live build 1, 12/12 PASS on build 2; npm test 26/26; smoke and two-browser online (with new reconnect check) pass.

## 2026-10-20 — visual design pass (build 3)
- **Asked:** Tim: "once you're finished with all the games, review them again for design improvements especially visually." Polish only; no rules or wording changes.
- **Built:** board.js art (shaded holes, light lip, disc shine, rounded feet + ground shadow, hover tint only over the frame, win dims the other discs); style.css (fixed status/verdict heights, bigger laptop status and player cards, Study side panels on laptop, picker ellipsis, list fade, 40px "?" hit area, online card at top, size-table glyphs); app.js adds `over` class to the end status.
- **Verified:** npm test 26/26; `node tools/regress.mjs http://127.0.0.1:8741/` 12/12; 10 states x phone + 1280 laptop WebKit shots, 0 errors, no overflow; board rect identical before/after the winning move (phone and laptop).
- **Open:** muted text contrast (~3.5:1, hub palette) and friend-mode "Red / Red" card subtitles left as Tim's call.

## 2026-10-20 — sounds, celebrations, animations (build 4)
- **Asked:** Tim: "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered." Manager ideas: disc clack pitched by fall + bounce, full-column error, Pop Out pop + settle, win confetti in the winner's colour, gentle draw, slider-release clatter on new game.
- **Built:** js/fx.js (shared _fx 1.0.2, unchanged copy), js/sfx.js (event map + custom sounds), wiring in app.js / table.js, "Sound & effects" panel in Settings, CSS so the fx rows match the site's switches and segments.
- **Verified:** tests/fx.test.js 15/15 (failed to load on the unfixed code; mutations "always win", "chime every turn", "no settle", "release ignores Animations" each caught); npm test 41/41; in-page WebKit check with a fake AudioContext 15/15 (scratchpad c4-fx-e2e.mjs); tools/regress.mjs 12/12 on local; phone + desktop shots of Settings, mid-game, win with confetti (manager scratchpad design/connect-four-fx/), 0 console errors, no overflow.

## 2026-10-20 — real-table look (build 5)
- **Asked:** Tim (all games): make each game look "almost identical to how the board or card layout looks like in real life … like you're looking through a camera that is connected to a user's glasses" (full quote in progress.md Standing instructions). Manager brief: shared `_table` kit, fx 1.0.3, research first, phone + laptop layouts, one reviewer round + fix + repeat.
- **Built:** fx.js re-copied (1.0.3); `_table` kit copied (css/table.css, js/game-table.js); Play tab on a dark wood table; board.js: see-through holes, drop slots, ridges, side legs on flared feet, slider bar with pull tab that slides out on New game / Clear; js/seats.js: each player's discs in stacks of 7 at their seat (yours near, opponent across), shrinking per disc with a lift-off animation; landscape phone puts seats beside the board; .gitattributes keeps the shared copies byte-identical.
- **Verified:** tests/seats.test.js (failed with the module missing and on two mutations, passes); npm test 45/45 (one unexplained failure in 7 runs, not reproduced); tools/regress.mjs 12/12 local; two-browsers online on the local build PASS; WebKit shots 393×659, 1280×800, 320, 659×393 landscape: 0 errors, no overflow, no page scroll; Effects speed tap leaves the site's own segments alone.
- **Open:** "Red / Red" friends subtitles and confetti over the buttons (shared fx) left as they were.
