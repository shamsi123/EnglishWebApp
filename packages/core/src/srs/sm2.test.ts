import { describe, expect, it } from "vitest";
import { dueCount, INITIAL_EASE, MIN_EASE, newCard, review } from "./sm2.js";

const now = new Date("2026-09-26T08:00:00Z");

describe("SM-2", () => {
  it("schedules 1, 6, then interval × ease days for successful reviews", () => {
    let card = newCard(now);
    card = review(card, 4, now);
    expect(card.intervalDays).toBe(1);
    card = review(card, 4, now);
    expect(card.intervalDays).toBe(6);
    card = review(card, 4, now);
    expect(card.intervalDays).toBe(Math.round(6 * card.easeFactor));
    expect(card.repetitions).toBe(3);
  });

  it("resets repetitions on a lapse and lowers ease", () => {
    let card = review(review(newCard(now), 5, now), 5, now);
    card = review(card, 1, now);
    expect(card.repetitions).toBe(0);
    expect(card.intervalDays).toBe(1);
    expect(card.easeFactor).toBeLessThan(INITIAL_EASE + 0.2);
  });

  it("never drops ease below the minimum", () => {
    let card = newCard(now);
    for (let i = 0; i < 20; i++) card = review(card, 0, now);
    expect(card.easeFactor).toBe(MIN_EASE);
  });

  it("counts due cards", () => {
    const due = newCard(now);
    const later = review(newCard(now), 5, now);
    expect(dueCount([due, later], now)).toBe(1);
    expect(dueCount([due, later], new Date("2026-09-28T00:00:00Z"))).toBe(2);
  });
});
