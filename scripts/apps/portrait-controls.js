import { patchActorUiState } from "../core/ui-state.js";
import { BuxaImagePicker } from "./image-picker.js";

export function bindPortraitControls(sheet) {
  const portrait = sheet.element?.querySelector?.("[data-buxa-portrait]");
  portrait?.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (!sheet.actor.isOwner) return;
    new BuxaImagePicker({ actor: sheet.actor }).render({ force: true });
  });

  const portraitImage = sheet.element?.querySelector?.("[data-buxa-portrait-image]");
  const portraitToggle = sheet.element?.querySelector?.("[data-action='togglePortraitImage']");
  if (!portraitImage || !portraitToggle) return;

  const label = portraitToggle.querySelector("[data-buxa-portrait-toggle-label]");
  const icon = portraitToggle.querySelector("[data-buxa-portrait-toggle-icon]");
  const svgEnabled = portraitToggle.dataset.svgIcons === "true";

  const apply = (mode) => {
    const normalized = mode === "token" ? "token" : "fullbody";
    const src = String(normalized === "token" ? portraitToggle.dataset.tokenSrc : portraitToggle.dataset.fullbodySrc).trim();
    if (!src) return;

    sheet._portraitMode = normalized;
    portraitImage.src = src;
    portraitImage.dataset.imageKind = normalized;

    if (label) {
      label.textContent = normalized === "token" ? "TOKEN" : "BODY";
      label.hidden = svgEnabled;
    }
    if (icon) {
      icon.hidden = !svgEnabled;
      icon.src = normalized === "token" ? portraitToggle.dataset.tokenIcon : portraitToggle.dataset.fullbodyIcon;
    }

    portraitToggle.title = normalized === "token" ? "Show Fullbody" : "Show Token";
    portraitToggle.setAttribute("aria-label", portraitToggle.title);
  };

  apply(sheet._portraitMode);
  portraitToggle.addEventListener("click", (event) => {
    event.preventDefault();
    apply(sheet._portraitMode === "token" ? "fullbody" : "token");
    void patchActorUiState(sheet.actor, { portraitMode: sheet._portraitMode });
  });
}
