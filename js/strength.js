/* The measured "How strong?" table (numbers come from tools/strength.mjs). */
import { STRENGTH } from "./strength-data.js";
import { LEVELS, LEVEL_NAMES } from "./ai.js";

export function strengthTable() {
  if (!STRENGTH || !STRENGTH.pairs) return `<p>Not measured yet.</p>`;
  const lv = LEVELS.filter((l) => STRENGTH.levels.includes(l));
  const cell = (a, b) => {
    if (a === b) return "–";
    const p = STRENGTH.pairs[a + ">" + b];
    if (!p) return "";
    return `${Math.round(100 * (p.w + p.d / 2) / p.n)}%`;
  };
  return `<p style="font-size:13px">Row level's score against the column level (win = 1, draw = ½), ${STRENGTH.note}</p>
  <table class="strength"><tr><th></th>${lv.map((l) => `<th>${LEVEL_NAMES[l].slice(0, 4)}</th>`).join("")}${STRENGTH.random ? "<th>Rand</th>" : ""}</tr>
  ${lv.map((a) => `<tr><td>${LEVEL_NAMES[a]}</td>${lv.map((b) => `<td>${cell(a, b)}</td>`).join("")}${STRENGTH.random ? `<td>${STRENGTH.random[a] ?? ""}</td>` : ""}</tr>`).join("")}</table>
  ${STRENGTH.perfect ? `<p style="font-size:13px">Games start from a random first move for each side, so some starts are already lost. <b>Perfect</b> ${STRENGTH.perfect.worse === 0 ? "never did worse than its start allowed" : `did worse than its start allowed in ${STRENGTH.perfect.worse} games`} (${STRENGTH.perfect.games} games; it began ${STRENGTH.perfect.lostOpenings} of them already lost).</p>` : ""}
  <p style="font-size:12.5px">Measured ${STRENGTH.date}, ${STRENGTH.games} games in all, classic 7 × 6 board, starting player alternating.</p>`;
}
