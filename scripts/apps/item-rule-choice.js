/**
 * Searchable, accessible source selector for the Increase/Dice editors.
 * The original <select> remains the single source of truth for saving data.
 * Menu is portalled to <body> so the Foundry scrollable dialog cannot clip it.
 */
const MAX_RESULTS = 160;

const simplify = (text) => String(text ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/\u0131/g, "i").toLowerCase();

export function describeItemChoice(option) {
  const text = String(option?.textContent ?? "").trim();
  const split = text.indexOf(" · ");
  return split < 0 ? { group: "OPTIONS", label: text } : {
    group: text.slice(0, split).trim(), label: text.slice(split + 3).trim()
  };
}

export function listItemChoices(select, query = "") {
  const options = [...(select?.options ?? [])].filter((entry) => !entry.disabled && entry.value !== "");
  const occurrences = new Map();
  for (const option of options) {
    const { group, label } = describeItemChoice(option);
    const key = `${group}\0${label}`;
    occurrences.set(key, (occurrences.get(key) || 0) + 1);
  }
  const normalized = simplify(query.trim());
  return options.map((option) => {
    const { group, label } = describeItemChoice(option);
    const duplicate = (occurrences.get(`${group}\0${label}`) || 0) > 1;
    const id = option.value.includes(":") ? option.value.split(":")[1] : option.value;
    return { value: option.value, group, label, id, duplicate, selected: option.selected };
  }).filter((entry) => !normalized || simplify(`${entry.group} ${entry.label} ${entry.id}`).includes(normalized));
}

/** Enhances an individual native select. Returns a cleanup and refresh handle. */
function createChoicePicker(select) {
  const wrapper = document.createElement("span");
  wrapper.className = "buxa-choice";
  select.before(wrapper);
  wrapper.append(select);
  select.classList.add("buxa-choice-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "buxa-choice-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML = '<span class="buxa-choice-trigger-value"></span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
  trigger.setAttribute("aria-label", select.dataset.buxaSearchPicker || "Select a source");
  wrapper.append(trigger);

  let panel = null;
  let searchInput = null;
  let results = null;
  let ac = null;
  let visibleLimit = MAX_RESULTS;
  const labelElement = trigger.querySelector(".buxa-choice-trigger-value");
  const renderLabel = () => {
    const item = listItemChoices(select).find((option) => option.value === select.value);
    labelElement.textContent = item ? `${item.label}${item.duplicate ? ` · ${item.id}` : ""}` : (select.selectedOptions[0]?.textContent || "Choose a source");
    trigger.title = item ? `${item.group} · ${item.label}${item.duplicate ? ` (${item.id})` : ""}` : "Choose a source";
    trigger.disabled = select.disabled;
    if (select.disabled && panel) close(false);
  };

  const close = (restoreFocus = false) => {
    if (!panel) return;
    ac?.abort();
    ac = null;
    panel.remove();
    panel = searchInput = results = null;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus && trigger.isConnected) trigger.focus();
  };

  const place = () => {
    if (!panel) return;
    const rectangle = trigger.getBoundingClientRect();
    const width = Math.min(Math.max(rectangle.width, 300), Math.max(80, window.innerWidth - 20));
    panel.style.width = `${width}px`;
    const height = panel.offsetHeight;
    const spaceBelow = window.innerHeight - rectangle.bottom - 10;
    const above = spaceBelow < Math.min(height, 230) && rectangle.top > spaceBelow;
    const left = Math.max(10, Math.min(rectangle.left, window.innerWidth - width - 10));
    const top = above ? Math.max(8, rectangle.top - height - 5) : Math.min(window.innerHeight - 20, rectangle.bottom + 5);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };

  const choose = (value) => {
    select.value = value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    renderLabel();
    close(true);
  };

  const renderResults = () => {
    if (!results) return;
    results.replaceChildren();
    const choices = listItemChoices(select, searchInput?.value || "");
    if (!choices.length) {
      const empty = document.createElement("p");
      empty.className = "buxa-choice-empty";
      empty.textContent = "No matching sources. Try another search.";
      results.append(empty);
    }
    let group = "";
    for (const choice of choices.slice(0, visibleLimit)) {
      if (choice.group !== group) {
        group = choice.group;
        const heading = document.createElement("div");
        heading.className = "buxa-choice-group";
        heading.textContent = group;
        results.append(heading);
      }
      const item = document.createElement("button");
      item.type = "button";
      item.className = `buxa-choice-option${choice.selected ? " is-selected" : ""}`;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", choice.selected ? "true" : "false");
      const name = document.createElement("span");
      name.textContent = choice.label;
      item.append(name);
      if (choice.duplicate) {
        const id = document.createElement("small");
        id.textContent = `ID: ${choice.id}`;
        id.title = "Different configured entries with the same name";
        item.append(id);
      }
      if (choice.selected) {
        const check = document.createElement("i");
        check.className = "fa-solid fa-check";
        check.setAttribute("aria-hidden", "true");
        item.append(check);
      }
      item.addEventListener("click", () => choose(choice.value));
      results.append(item);
    }
    if (choices.length > visibleLimit) {
      // Never hide valid configured choices behind an arbitrary first-page cap.
      // Load in small batches to avoid creating thousands of DOM nodes at once.
      const more = document.createElement("button");
      more.type = "button";
      more.className = "buxa-choice-more";
      more.textContent = `Show more (${choices.length - visibleLimit} remaining)`;
      more.setAttribute("aria-label", `Show more source options, ${choices.length - visibleLimit} remaining`);
      more.addEventListener("click", () => {
        const priorLimit = visibleLimit;
        visibleLimit += MAX_RESULTS;
        renderResults();
        const buttons = results.querySelectorAll(".buxa-choice-option");
        buttons[priorLimit]?.focus?.();
      });
      results.append(more);
    }
    place();
  };

  const open = () => {
    if (panel || select.disabled) return;
    // Only one source menu may be open inside a Foundry window at once.
    document.dispatchEvent(new CustomEvent("buxa-choice-close", { detail: trigger }));
    ac = new AbortController();
    const { signal } = ac;
    panel = document.createElement("div");
    panel.className = "buxa-choice-popover";
    panel.setAttribute("role", "group");
    panel.innerHTML = '<div class="buxa-choice-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" autocomplete="off" spellcheck="false" aria-label="Filter options"></div><div class="buxa-choice-results" role="listbox"></div>';
    searchInput = panel.querySelector("input");
    searchInput.placeholder = select.dataset.buxaSearchPicker || "Search options...";
    results = panel.querySelector(".buxa-choice-results");
    document.body.append(panel);
    trigger.setAttribute("aria-expanded", "true");
    renderResults();
    place();
    searchInput.focus();
    searchInput.addEventListener("input", () => { visibleLimit = MAX_RESULTS; renderResults(); }, { signal });
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); close(true); }
      else if (event.key === "Enter") {
        const first = results.querySelector(".buxa-choice-option");
        if (first) { event.preventDefault(); first.click(); }
      } else if (event.key === "ArrowDown") {
        const first = results.querySelector(".buxa-choice-option");
        if (first) { event.preventDefault(); first.focus(); }
      }
    }, { signal });
    results.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); close(true); }
      if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
      const options = [...results.querySelectorAll(".buxa-choice-option")];
      const index = options.indexOf(document.activeElement);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = options[index + delta];
      if (next) { event.preventDefault(); next.focus(); }
      else if (index === 0 && delta < 0) { event.preventDefault(); searchInput.focus(); }
    }, { signal });
    document.addEventListener("pointerdown", (event) => {
      if (panel?.contains(event.target) || wrapper.contains(event.target)) return;
      close();
    }, { capture: true, signal });
    document.addEventListener("focusin", (event) => {
      if (panel?.contains(event.target) || wrapper.contains(event.target)) return;
      close();
    }, { signal });
    document.addEventListener("buxa-choice-close", (event) => {
      if (event.detail !== trigger) close();
    }, { signal });
    window.addEventListener("resize", place, { signal });
    // Scrolling the sheet can occur while focusing the search input. Keep the
    // portalled menu anchored instead of inadvertently dismissing it.
    document.addEventListener("scroll", (event) => {
      if (!panel?.contains(event.target)) place();
    }, { capture: true, signal });
  };

  const click = (event) => { event.preventDefault(); if (panel) close(true); else open(); };
  trigger.addEventListener("click", click);
  const change = () => renderLabel();
  select.addEventListener("change", change);
  renderLabel();
  return {
    refresh: renderLabel,
    destroy: () => {
      close();
      select.removeEventListener("change", change);
      trigger.removeEventListener("click", click);
      select.classList.remove("buxa-choice-native");
      select.removeAttribute("aria-hidden");
      select.removeAttribute("tabindex");
      wrapper.before(select);
      wrapper.remove();
    }
  };
}

export function createItemChoiceManager(root) {
  const choices = new Map();
  return {
    refresh() {
      for (const select of root.querySelectorAll("select[data-buxa-search-picker]")) {
        if (!choices.has(select)) choices.set(select, createChoicePicker(select));
      }
      for (const [select, picker] of choices) {
        if (!select.isConnected) { picker.destroy(); choices.delete(select); }
        else picker.refresh();
      }
    },
    destroy() {
      for (const picker of choices.values()) picker.destroy();
      choices.clear();
    }
  };
}
