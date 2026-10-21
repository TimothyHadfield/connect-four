# Connect Four — project rules

Static site on GitHub Pages: https://timothyhadfield.github.io/connect-four/ (repo TimothyHadfield/connect-four). $0, no build step for the site, ES modules.

- Read `progress.md` first.
- Browser regressions: `node tools/regress.mjs [url]` and odd situations `node tools/edge.mjs [url] [shotDir]` (headless WebKit; default the live site).
- Tests: `npm test` (node --test "tests/*.test.js"). About 40 s; the random-games and book-vs-solver checks dominate.
- `js/solver.wasm` is built from `wasm/solver.ts` with `npm run build:wasm` (AssemblyScript, dev dependency only). Commit the .wasm; the site never builds anything.
- `data/book7x6.bin` comes from `tools/forced-solve.mjs` then `tools/build-book.mjs` (Tromp's UCI 8-ply data, CC BY 4.0, credited in Settings › About). Only rebuild if the book format changes.
- `data/puzzles.json` comes from `node tools/make-puzzles.mjs 40 11`; a test re-checks every answer.
- Strength numbers in `js/strength-data.js` come from `node tools/strength.mjs`. Rerun after any change to `js/ai.js` and update progress.md.
- `js/online.js` is the shared copy from `../_online/`. Never edit it here; copy it again if `_online` changes. gameId is "connect-four". Online check: `node tools/two-browsers.mjs` (live site, real Firebase).
- Never import `./app.js` from another module: index.html loads it as `app.js?v=N`, so a plain import creates a second copy of the page. Shared bits live in `ui.js` (`hooks`, `ordinal`, `BUILD`).
- Bump `?v=` in index.html and `BUILD` in ui.js on every deploy (cache).
- Original art and wording only. Never copy Hasbro art or rule-sheet text. "Connect Four" is Hasbro's trademark (noted in About).
- Local server: `python -m http.server <port> --bind 127.0.0.1` from this folder. Check with `node ~/.claude/tools/phone-view.mjs`.
- Handoff files (`progress.md`, `chat.md`, docs) are edited with the Edit/Write tools only.
