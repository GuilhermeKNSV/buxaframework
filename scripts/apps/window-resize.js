/**
 * Buxa ApplicationV2 resize grip.
 *
 * Foundry's built-in resize affordance can be occluded by custom sheet layouts.
 * This small additive control only uses the public ApplicationV2.setPosition API;
 * it does not patch core drag handlers or set fixed sheet dimensions in CSS.
 * Every supported Buxa app opts in during _onRender().
 */
const MIN_WIDTH = 320;
const MIN_HEIGHT = 260;

export function calculateWindowResize(start, dx, dy, minimum = {}) {
  const width = Math.max(Number(minimum.width) || MIN_WIDTH, Math.round(start.width + dx));
  const height = Math.max(Number(minimum.height) || MIN_HEIGHT, Math.round(start.height + dy));
  return { width, height };
}

/** Append once per window root; safe to call again after each partial render. */
export function enableWindowResize(app, minimum = {}) {
  const root = app?.element;
  if (!root || typeof app.setPosition !== "function" || !app.options?.window?.resizable || app.minimized) return null;

  const existing = root.querySelector?.("[data-buxa-window-resize]");
  if (existing) return existing;

  const doc = root.ownerDocument;
  if (!doc?.createElement) return null;
  const grip = doc.createElement("button");
  grip.type = "button";
  grip.className = "buxa-window-resize-grip";
  grip.dataset.buxaWindowResize = "";
  grip.setAttribute("aria-label", "Resize window. Use the arrow keys to change its size.");
  grip.setAttribute("title", "Drag to resize · Arrow keys to adjust");
  grip.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center" aria-hidden="true"></i>';
  root.appendChild(grip);

  const currentSize = () => {
    const bounds = root.getBoundingClientRect?.() ?? {};
    return {
      width: Number(app.position?.width) || bounds.width || MIN_WIDTH,
      height: Number(app.position?.height) || bounds.height || MIN_HEIGHT
    };
  };

  const setSize = (size) => {
    if (root.isConnected === false || app.minimized || root.classList?.contains?.("minimized")) return;
    app.setPosition(size);
  };

  grip.addEventListener("keydown", (event) => {
    const steps = {
      ArrowRight: [24, 0],
      ArrowLeft: [-24, 0],
      ArrowDown: [0, 24],
      ArrowUp: [0, -24]
    };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    const [dx, dy] = step;
    setSize(calculateWindowResize(currentSize(), dx, dy, minimum));
  });

  grip.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const start = currentSize();
    let last = start;
    let active = true;
    const view = doc.defaultView;

    const onMove = (moveEvent) => {
      if (!active || moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      last = calculateWindowResize(start, moveEvent.clientX - startX, moveEvent.clientY - startY, minimum);
      setSize(last);
    };
    const stop = (upEvent) => {
      if (!active || (upEvent?.pointerId != null && upEvent.pointerId !== pointerId)) return;
      active = false;
      doc.removeEventListener("pointermove", onMove);
      doc.removeEventListener("pointerup", stop);
      doc.removeEventListener("pointercancel", stop);
      view?.removeEventListener?.("blur", stop);
      grip.classList.remove("is-resizing");
      // Apply the final pointer position even if a move event was throttled.
      if (upEvent?.clientX != null && upEvent?.clientY != null && upEvent.type !== "pointercancel") {
        last = calculateWindowResize(start, upEvent.clientX - startX, upEvent.clientY - startY, minimum);
        setSize(last);
      }
    };

    grip.classList.add("is-resizing");
    doc.addEventListener("pointermove", onMove, { passive: false });
    doc.addEventListener("pointerup", stop);
    doc.addEventListener("pointercancel", stop);
    view?.addEventListener?.("blur", stop);
  });

  return grip;
}
