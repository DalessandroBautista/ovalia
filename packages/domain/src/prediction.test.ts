import { describe, expect, it } from "vitest";
import { scorePrediction } from "./prediction";

describe("prode scoring", () => {
  it("awards five points for the exact score", () => {
    expect(scorePrediction({ home: 24, away: 18 }, { home: 24, away: 18 })).toBe(5);
  });

  it("awards three points for winner and exact margin", () => {
    expect(scorePrediction({ home: 30, away: 20 }, { home: 21, away: 11 })).toBe(3);
  });

  it("awards one point for predicting the correct winner", () => {
    expect(scorePrediction({ home: 27, away: 25 }, { home: 18, away: 10 })).toBe(1);
  });

  it("awards no points for the wrong outcome", () => {
    expect(scorePrediction({ home: 12, away: 19 }, { home: 20, away: 18 })).toBe(0);
  });
});
