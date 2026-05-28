/**
 * Native bridge — detects Capacitor runtime and wraps native APIs.
 * Import from here instead of directly from @capacitor/* so web builds
 * never break when native plugins are unavailable.
 */
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

// ─── Push notifications ───────────────────────────────────────────────────────

export async function requestPushPermission(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const result = await PushNotifications.requestPermissions();
    if (result.receive === 'granted') {
      await PushNotifications.register();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function onPushToken(cb: (token: string) => void) {
  if (!isNative) return;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.addListener('registration', ({ value }) => cb(value));
}

// ─── Local notifications (IoT alerts on device) ───────────────────────────────

export async function scheduleLocalNotification(opts: {
  id: number;
  title: string;
  body: string;
  schedule?: Date;
}) {
  if (!isNative) {
    // Fallback to Web Notifications API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(opts.title, { body: opts.body, icon: '/icon-192.png' });
    }
    return;
  }
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.schedule({
    notifications: [{
      id: opts.id,
      title: opts.title,
      body: opts.body,
      schedule: opts.schedule ? { at: opts.schedule } : undefined,
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#6366f1',
    }],
  });
}

// ─── Network status ───────────────────────────────────────────────────────────

export async function getNetworkStatus(): Promise<{ connected: boolean; type: string }> {
  if (!isNative) {
    return { connected: navigator.onLine, type: 'unknown' };
  }
  const { Network } = await import('@capacitor/network');
  const status = await Network.getStatus();
  return { connected: status.connected, type: status.connectionType };
}

export async function onNetworkChange(cb: (connected: boolean) => void) {
  if (!isNative) {
    window.addEventListener('online',  () => cb(true));
    window.addEventListener('offline', () => cb(false));
    return;
  }
  const { Network } = await import('@capacitor/network');
  await Network.addListener('networkStatusChange', s => cb(s.connected));
}

// ─── Haptics ─────────────────────────────────────────────────────────────────

export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (!isNative) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  await Haptics.impact({ style: map[style] });
}

// ─── Device info ─────────────────────────────────────────────────────────────

export async function getDeviceInfo() {
  if (!isNative) return null;
  const { Device } = await import('@capacitor/device');
  return Device.getInfo();
}

// ─── Persistent storage (survives app reinstall on iOS) ──────────────────────

export async function nativeSet(key: string, value: string) {
  if (!isNative) { localStorage.setItem(key, value); return; }
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key, value });
}

export async function nativeGet(key: string): Promise<string | null> {
  if (!isNative) return localStorage.getItem(key);
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key });
  return value;
}

export async function nativeRemove(key: string) {
  if (!isNative) { localStorage.removeItem(key); return; }
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.remove({ key });
}
