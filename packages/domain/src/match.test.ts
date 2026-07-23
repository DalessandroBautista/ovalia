import { describe, expect, it } from "vitest";
import { advanceMatch, createScheduledMatch } from "./match";

describe("match lifecycle", () => {
  it("moves a fixture through live and final states", () => {
    const scheduled = createScheduledMatch("2026-07-25T18:00:00.000Z");
    const live = advanceMatch(scheduled, { type: "kickoff", at: "2026-07-25T18:02:00.000Z" });
    const final = advanceMatch(live, { type: "finish", at: "2026-07-25T19:55:00.000Z" });

    expect(live.status).toBe("live");
    expect(final.status).toBe("final");
  });

  it("rejects an impossible transition", () => {
    const scheduled = createScheduledMatch("2026-07-25T18:00:00.000Z");
    expect(() => advanceMatch(scheduled, { type: "finish", at: "2026-07-25T19:55:00.000Z" })).toThrow(
      "A scheduled match cannot finish before kickoff"
    );
  });
});
