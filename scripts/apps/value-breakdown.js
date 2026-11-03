function closePanel(panel, trigger) {
  if (!panel || panel.hidden) return;
  panel.classList.remove("is-open");
  trigger?.setAttribute("aria-expanded", "false");
  window.setTimeout(() => {
    if (!panel.classList.contains("is-open")) panel.hidden = true;
  }, 180);
}

function openPanel(panel, trigger) {
  if (!panel) return;
  panel.hidden = false;
  trigger?.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => panel.classList.add("is-open"));
}

export function bindValueBreakdowns(sheet) {
  const root = sheet?.element;
  if (!root) return;

  const triggers = [...root.querySelectorAll("[data-action='toggleValueBreakdown']")];
  const panels = [...root.querySelectorAll("[data-value-breakdown]")];

  const closeAll = (exceptId = "") => {
    for (const panel of panels) {
      if (exceptId && panel.dataset.valueBreakdown === exceptId) continue;
      const trigger = root.querySelector(`[data-action="toggleValueBreakdown"][data-breakdown-id="${CSS.escape(panel.dataset.valueBreakdown || "")}"]`);
      closePanel(panel, trigger);
    }
  };

  for (const trigger of triggers) {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = trigger.dataset.breakdownId || "";
      const panel = root.querySelector(`[data-value-breakdown="${CSS.escape(id)}"]`);
      if (!panel) return;
      const opening = panel.hidden || !panel.classList.contains("is-open");
      closeAll(opening ? id : "");
      if (opening) {
        openPanel(panel, trigger);
        panel.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      } else closePanel(panel, trigger);
    });
  }


  for (const zone of root.querySelectorAll(".buxa-attribute-card.is-expanded .buxa-attribute-heading, .buxa-resource-name, .buxa-proficiency-name")) {
    zone.classList.add("is-breakdown-clickable");
    zone.addEventListener("click", (event) => {
      if (event.target.closest("button, input, select, textarea, a")) return;
      const owner = zone.closest("[data-attribute-card], [data-resource-card], [data-proficiency-row]");
      owner?.querySelector("[data-action='toggleValueBreakdown']")?.click();
    });
  }

  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeAll();
  });
}
