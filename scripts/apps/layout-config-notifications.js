import { notifyWarning } from "../core/notifications.js";
import { normalizeWarningSettings } from "../core/notification-settings.js";

export function readWarningSettings(root) {
  return normalizeWarningSettings({
    durationSeconds: root?.querySelector("[data-warning-dismiss-seconds]")?.value,
    position: root?.querySelector('[data-warning-position]:checked')?.value
  });
}

/** Demonstration uses unsaved form values, without mutating world settings. */
export function previewWarningSettings(root) {
  const { durationSeconds, position } = readWarningSettings(root);
  return notifyWarning("This is a preview of Buxa's notification style and placement.", {
    timeout: durationSeconds * 1000,
    position
  });
}
