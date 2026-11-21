// A small seeded random number generator (mulberry32) plus helpers built on it: the same
// seed always builds the same city and runs the same game, which is what makes the
// screenshot scenes and the attract mode repeatable. Nothing in the game uses Math.random.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Helpers over a random() function: ranges, integers, choices and coin flips. */
export function rngHelpers(random) {
  return {
    range(min, max) {
      return min + random() * (max - min);
    },
    int(min, max) {
      return min + Math.floor(random() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(random() * list.length) % list.length];
    },
    chance(p) {
      return random() < p;
    },
  };
}
