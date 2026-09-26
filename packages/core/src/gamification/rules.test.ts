import { describe, expect, it } from "vitest";
import { lessonXp, passesCheckpoint, recordActivity, type StreakState } from "./rules.js";

const base: StreakState = { current: 3, longest: 5, lastActiveDay: "2026-09-25", freezesAvailable: 1 };

describe("lessonXp", () => {
  it("awards per-answer XP, completion XP and a perfect bonus", () => {
    expect(lessonXp(10, 10)).toBe(25);
    expect(lessonXp(7, 10)).toBe(17);
  });

  it("rejects impossible results", () => {
    expect(() => lessonXp(11, 10)).toThrow(RangeError);
  });
});

describe("recordActivity", () => {
  it("starts a streak on first activity", () => {
    const { state, outcome } = recordActivity({ current: 0, longest: 0, lastActiveDay: null, freezesAvailable: 0 }, "2026-09-26");
    expect(outcome).toBe("extended");
    expect(state.current).toBe(1);
  });

  it("extends on consecutive days", () => {
    const { state, outcome } = recordActivity(base, "2026-09-26");
    expect(outcome).toBe("extended");
    expect(state.current).toBe(4);
  });

  it("ignores repeat activity on the same day", () => {
    expect(recordActivity(base, "2026-09-25").outcome).toBe("unchanged");
  });

  it("uses a freeze to cover one missed day", () => {
    const { state, outcome } = recordActivity(base, "2026-09-27");
    expect(outcome).toBe("frozen");
    expect(state.current).toBe(4);
    expect(state.freezesAvailable).toBe(0);
  });

  it("resets when missed days exceed freezes, keeping the longest streak", () => {
    const { state, outcome } = recordActivity(base, "2026-09-29");
    expect(outcome).toBe("reset");
    expect(state.current).toBe(1);
    expect(state.longest).toBe(5);
  });

  it("tracks a new longest streak", () => {
    const { state } = recordActivity({ ...base, current: 5 }, "2026-09-26");
    expect(state.longest).toBe(6);
  });
});

describe("passesCheckpoint", () => {
  it("unlocks at 70% (FR-12)", () => {
    expect(passesCheckpoint(7, 10)).toBe(true);
    expect(passesCheckpoint(6, 10)).toBe(false);
    expect(passesCheckpoint(0, 0)).toBe(false);
  });
});
