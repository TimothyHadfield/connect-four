// Written by tools/strength.mjs. Do not edit by hand.
export const STRENGTH = {
 "levels": [
  "perfect",
  "strong",
  "medium",
  "easy",
  "beginner"
 ],
 "pairs": {
  "perfect>strong": {
   "w": 176,
   "d": 6,
   "n": 200
  },
  "strong>perfect": {
   "w": 18,
   "d": 6,
   "n": 200
  },
  "perfect>medium": {
   "w": 189,
   "d": 9,
   "n": 200
  },
  "medium>perfect": {
   "w": 2,
   "d": 9,
   "n": 200
  },
  "perfect>easy": {
   "w": 198,
   "d": 0,
   "n": 200
  },
  "easy>perfect": {
   "w": 2,
   "d": 0,
   "n": 200
  },
  "perfect>beginner": {
   "w": 200,
   "d": 0,
   "n": 200
  },
  "beginner>perfect": {
   "w": 0,
   "d": 0,
   "n": 200
  },
  "strong>medium": {
   "w": 279,
   "d": 53,
   "n": 400
  },
  "medium>strong": {
   "w": 68,
   "d": 53,
   "n": 400
  },
  "strong>easy": {
   "w": 366,
   "d": 18,
   "n": 400
  },
  "easy>strong": {
   "w": 16,
   "d": 18,
   "n": 400
  },
  "strong>beginner": {
   "w": 400,
   "d": 0,
   "n": 400
  },
  "beginner>strong": {
   "w": 0,
   "d": 0,
   "n": 400
  },
  "medium>easy": {
   "w": 335,
   "d": 23,
   "n": 400
  },
  "easy>medium": {
   "w": 42,
   "d": 23,
   "n": 400
  },
  "medium>beginner": {
   "w": 400,
   "d": 0,
   "n": 400
  },
  "beginner>medium": {
   "w": 0,
   "d": 0,
   "n": 400
  },
  "easy>beginner": {
   "w": 362,
   "d": 1,
   "n": 400
  },
  "beginner>easy": {
   "w": 37,
   "d": 1,
   "n": 400
  }
 },
 "random": {
  "perfect": "100%",
  "strong": "100%",
  "medium": "100%",
  "easy": "100%",
  "beginner": "89%"
 },
 "perfect": {
  "games": 900,
  "worse": 1,
  "lostOpenings": 353
 },
 "games": 3700,
 "date": "2026-10-20",
 "note": "each opening played twice with colours swapped; Rand = score against a player choosing columns at random."
};
