import { getWarningSettings } from "./notification-settings.js";

const CONTAINER_ID = "buxa-toast-stack";
const MAX_TOASTS = 5;
const dismissTimers = new WeakMap();

const TYPES = Object.freeze({
  info: { title: "NOTICE", icon: "fa-solid fa-circle-info" },
  success: { title: "SAVED", icon: "fa-solid fa-check" },
  warning: { title: "WARNING", icon: "fa-solid fa-triangle-exclamation" },
  error: { title: "ERROR", icon: "fa-solid fa-xmark" }
});

function cleanMessage(message) {
  return String(message ?? "")
    .replace(/^Buxa Framework:\s*/i, "")
    .replace(/^Buxa:\s*/i, "")
    .trim();
}

function toastContainer(position) {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = CONTAINER_ID;
    container.className = "buxa-toast-stack";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "false");
    document.body.append(container);
  }
  container.dataset.position = position;
  return container;
}

/** Reposition existing notifications when module settings change, too. */
export function syncNotificationPlacement() {
  if (typeof document === "undefined") return;
  const container = document.getElementById(CONTAINER_ID);
  if (container) container.dataset.position = getWarningSettings().position;
}

function dismissToast(toast) {
  if (!toast || toast.dataset.closing === "true") return;
  toast.dataset.closing = "true";
  const timer = dismissTimers.get(toast);
  if (timer !== undefined) window.clearTimeout(timer);
  dismissTimers.delete(toast);
  toast.classList.add("is-leaving");
  window.setTimeout(() => toast.remove(), 190);
}

function trimStack(container) {
  const toasts = [...container.querySelectorAll(".buxa-toast:not(.is-leaving)")];
  while (toasts.length >= MAX_TOASTS) dismissToast(toasts.shift());
}

/** timeout is an optional millisecond override, with 0 explicitly meaning sticky. */
export function notify(type, message, { title = null, timeout = null, position = null } = {}) {
  if (typeof document === "undefined" || !document.body) return null;
  const normalizedType = TYPES[type] ? type : "info";
  const meta = TYPES[normalizedType];
  const text = cleanMessage(message);
  if (!text) return null;

  const settings = getWarningSettings();
  const placement = ["left", "center", "right"].includes(position) ? position : settings.position;
  const container = toastContainer(placement);
  trimStack(container);

  const toast = document.createElement("section");
  toast.className = `buxa-toast is-${normalizedType}`;
  toast.setAttribute("role", normalizedType === "error" || normalizedType === "warning" ? "alert" : "status");

  const accent = document.createElement("span");
  accent.className = "buxa-toast-accent";
  accent.setAttribute("aria-hidden", "true");

  const icon = document.createElement("i");
  icon.className = `${meta.icon} buxa-toast-icon`;
  icon.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  copy.className = "buxa-toast-copy";
  const heading = document.createElement("strong");
  heading.textContent = String(title ?? meta.title);
  const body = document.createElement("p");
  body.textContent = text;
  copy.append(heading, body);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "buxa-toast-close";
  close.setAttribute("aria-label", "Dismiss notification");
  close.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
  close.addEventListener("click", () => dismissToast(toast));

  const timer = document.createElement("span");
  timer.className = "buxa-toast-timer";
  timer.setAttribute("aria-hidden", "true");

  toast.append(accent, icon, copy, close, timer);
  container.append(toast);
  requestAnimationFrame(() => {
    if (toast.dataset.closing !== "true") toast.classList.add("is-visible");
  });

  // IMPORTANT: Number(null) === 0. An omitted timeout must use the configured
  // duration, not become a permanent notification (regression in 0.10.1).
  const requestedDuration = timeout == null ? settings.durationSeconds * 1000 : Number(timeout);
  const duration = Number.isFinite(requestedDuration) ? Math.max(0, requestedDuration) : settings.durationSeconds * 1000;
  if (duration > 0) {
    toast.style.setProperty("--buxa-toast-duration", `${duration}ms`);
    dismissTimers.set(toast, window.setTimeout(() => dismissToast(toast), duration));
  } else {
    timer.hidden = true;
  }
  return toast;
}

export function notifyInfo(message, options) { return notify("info", message, options); }
export function notifySuccess(message, options) { return notify("success", message, options); }
export function notifyWarning(message, options) { return notify("warning", message, options); }
export function notifyError(message, options) { return notify("error", message, options); }
