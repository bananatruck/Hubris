export type DataChangedMessage = { type: 'hubris/data-changed' };

export function isDataChangedMessage(value: unknown): value is DataChangedMessage {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === 'hubris/data-changed';
}

export function notifyDataChanged() {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('hubris');
    channel.postMessage({ type: 'hubris/data-changed' } satisfies DataChangedMessage);
    channel.close();
  }
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      void chrome.runtime.sendMessage({ type: 'hubris/data-changed' } satisfies DataChangedMessage).catch(() => undefined);
    } catch {
      // Extension contexts can close while a write completes.
    }
  }
}
