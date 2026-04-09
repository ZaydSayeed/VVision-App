let _reloadCallback: (() => void) | null = null;

export function registerReminderReload(fn: () => void) {
  _reloadCallback = fn;
}

export function triggerReminderReload() {
  _reloadCallback?.();
}
