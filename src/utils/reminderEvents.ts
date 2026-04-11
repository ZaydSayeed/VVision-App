// ── Reminder reload ──────────────────────────────────────
let _reminderReloadCb: (() => void) | null = null;

export function registerReminderReload(fn: () => void) {
  _reminderReloadCb = fn;
}

export function triggerReminderReload() {
  _reminderReloadCb?.();
}

// ── Task reload ──────────────────────────────────────────
let _taskReloadCb: (() => void) | null = null;

export function registerTaskReload(fn: () => void) {
  _taskReloadCb = fn;
}

export function triggerTaskReload() {
  _taskReloadCb?.();
}

// ── Medication reload ────────────────────────────────────
let _medReloadCb: (() => void) | null = null;

export function registerMedReload(fn: () => void) {
  _medReloadCb = fn;
}

export function triggerMedReload() {
  _medReloadCb?.();
}
