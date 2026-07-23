import { describe, expect, it } from "vitest";
import { calculateMatchPoints } from "./standings";

describe("rugby standings points", () => {
  it("awards a win plus a four-try bonus", () => {
    expect(calculateMatchPoints({ homeScore: 31, awayScore: 20, homeTries: 4, awayTries: 2 })).toEqual({
      home: 5,
      away: 0
    });
  });

  it("awards a losing bonus inside seven points", () => {
    expect(calculateMatchPoints({ homeScore: 22, awayScore: 18, homeTries: 2, awayTries: 1 })).toEqual({
      home: 4,
      away: 1
    });
  });

  it("awards two points each for a draw", () => {
    expect(calculateMatchPoints({ homeScore: 17, awayScore: 17, homeTries: 2, awayTries: 2 })).toEqual({
      home: 2,
      away: 2
    });
  });
});
