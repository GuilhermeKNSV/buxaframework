import { changeProficiency } from "../core/proficiencies.js";
import { activateProficiencyRoll } from "./proficiency-roll.js";

function signed(value) {
  const number = Number(value) || 0;
  return number >= 0 ? `+${number}` : String(number);
}

export function bindProficiencyControls(sheet, { queueMutation, rememberFx } = {}) {
  if (!sheet?.element) return;

  const applyResult = (proficiencyId, result) => {
    if (!result?.delta) return;
    rememberFx?.({ kind: "proficiency", id: proficiencyId, tone: result.delta < 0 ? "loss" : "gain" });
    const pointsDelta = Number(result.pointsAfter) - Number(result.pointsBefore);
    if (pointsDelta) rememberFx?.({
      kind: "proficiencyPoints",
      tone: pointsDelta < 0 ? "spend" : "gain",
      text: signed(pointsDelta)
    });
  };

  for (const button of sheet.element.querySelectorAll("[data-action='proficiencyIncrease'], [data-action='proficiencyDecrease']")) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const proficiencyId = button.dataset.proficiencyId;
      const delta = button.dataset.action === "proficiencyIncrease" ? 1 : -1;
      const task = async () => applyResult(proficiencyId, await changeProficiency(sheet.actor, proficiencyId, delta));
      if (queueMutation) void queueMutation(task);
      else void task();
    });
  }

  for (const button of sheet.element.querySelectorAll("[data-action='proficiencyRoll']")) {
    const activate = (event) => {
      event.preventDefault();
      event.stopPropagation();
      void activateProficiencyRoll(sheet, button);
    };
    button.addEventListener("click", activate);
    button.addEventListener("contextmenu", activate);
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " " && event.key !== "ContextMenu") return;
      activate(event);
    });
  }
}
