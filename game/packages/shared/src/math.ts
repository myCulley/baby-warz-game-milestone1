import type { Vec3 } from "./types.js";
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const distanceSquared = (a: Vec3, b: Vec3) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
export function normalized2(x: number, z: number) {
  const length = Math.hypot(x, z);
  return length > 1 ? { x: x / length, z: z / length } : { x, z };
}
export const copyVec3 = (value: Vec3): Vec3 => ({
  x: value.x,
  y: value.y,
  z: value.z,
});
