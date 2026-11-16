/**
 * Tiny shared "atmosphere" context. One direction of data flow:
 * the wire wordmark WRITES energy when strings are plucked; the fog shader
 * READS it as uHoverEnergy. Loosely coupled — neither knows the other exists.
 */
export const atmosphere = {
  energy: 0,
  /** x in normalised footer space (0..1) of the last disturbance */
  x: 0.5,
  pulse(amount: number, x = 0.5) {
    this.energy = Math.min(1.5, this.energy + amount)
    this.x = x
  },
  decay(dt: number) {
    this.energy *= Math.pow(0.95, dt * 60)
  },
}
