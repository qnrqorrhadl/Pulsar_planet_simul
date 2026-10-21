export const degToRad = (deg) => (deg * Math.PI) / 180;

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
