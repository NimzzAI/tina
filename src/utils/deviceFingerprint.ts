/**
 * Generates and persists a deterministic client Device ID for security logging
 * and rate-limit enforcement. Conforms strictly to ^[a-zA-Z0-9_\-]+$ (max 128 chars).
 */
const STORAGE_KEY = 'tina_device_fingerprint_v1';

function hashString(str: string): string {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1}${hex2}`.toUpperCase();
}

function getCanvasSignature(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    ctx.textBaseline = 'top';
    ctx.font = '14px monospace';
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(10, 4, 80, 24);
    ctx.fillStyle = '#0f172a';
    ctx.fillText('TINA-SEC-FP', 14, 10);
    return canvas.toDataURL();
  } catch {
    return 'canvas-err';
  }
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,128}$/.test(existing)) {
      return existing;
    }
  } catch {
    // ignore storage errors
  }

  const components = [
    navigator.userAgent || '',
    navigator.language || '',
    String(screen.width || 0) + 'x' + String(screen.height || 0),
    String(screen.colorDepth || 24),
    String(navigator.hardwareConcurrency || 4),
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    getCanvasSignature(),
  ];

  const hwHash = hashString(components.join('||'));
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  const deviceId = `TINA-DEV-${hwHash.slice(0, 8)}-${hwHash.slice(8, 16)}-${randomSuffix}`;

  try {
    localStorage.setItem(STORAGE_KEY, deviceId);
  } catch {
    // ignore storage errors
  }

  return deviceId;
}
