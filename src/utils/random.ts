/**
 * generates a random number in the range `[min, max)`
 * @param min number
 * @param max number
 */
export function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * generates a random number in the range `[min, max]`
 * @param min number
 * @param max number
 */
export function randomInclusive(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
