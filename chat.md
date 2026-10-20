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
