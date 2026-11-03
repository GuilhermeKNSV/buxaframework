/** One-click rebirth sequence. Keeps the full-bar gate alive through the charge,
 * commits only after confirmation, and never displays the tier reveal on failure. */
export async function activateAttributeRebirth(button, {
  confirm, commit, reveal, chargeDuration = null
} = {}) {
  if (!button || button.dataset.buxaRebirthBusy === "true") return false;
  button.dataset.buxaRebirthBusy = "true";
  button.setAttribute("aria-busy", "true");
  button.disabled = true;
  const card = button.closest?.("[data-attribute-card]");
  let claimed = false;
  try {
    if (!await confirm()) return false;
    card?.classList.add("is-rebirth-charging");
    const prefersLessMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    const ms = chargeDuration ?? (prefersLessMotion ? 0 : 880);
    if (ms > 0) await new Promise(resolve => setTimeout(resolve, ms));
    const result = await commit();
    if (!result) return false;
    claimed = true;
    card?.classList.add("is-rebirth-breaking");
    await reveal(result);
    return result;
  } finally {
    if (!claimed) card?.classList.remove("is-rebirth-charging", "is-rebirth-breaking");
    button.disabled = false;
    button.removeAttribute("aria-busy");
    delete button.dataset.buxaRebirthBusy;
  }
}

/** Ephemeral visual only; rebirth data always comes from the Actor document. */
export function attachRebirthBurst(card) {
  if (!card?.ownerDocument?.createElement || card.querySelector?.('.buxa-rebirth-burst')) return;
  const effect = card.ownerDocument.createElement('span');
  effect.className = 'buxa-rebirth-burst';
  effect.setAttribute('aria-hidden', 'true');
  effect.innerHTML = '<i class="fa-solid fa-lock-open"></i><span></span><span></span><span></span><span></span>';
  card.appendChild(effect);
}
