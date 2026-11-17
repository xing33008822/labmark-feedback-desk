import { describe, expect, it } from "vitest";
import { clampScore, suggestMark, totalScore, type GradeItem } from "./grading";

describe("grading rules", () => {
  it("full marks suggests a check", () => expect(suggestMark(40, 40)).toBe("check"));
  it("zero suggests a cross", () => expect(suggestMark(0, 20)).toBe("cross"));
  it("partial score suggests a half check", () => expect(suggestMark(15, 20)).toBe("half"));
  it("score cannot exceed the item's max or go below zero", () => {
    expect(clampScore(55, 40)).toBe(40);
    expect(clampScore(-3, 40)).toBe(0);
  });
  it("total adds item scores", () => {
    const items = [
      { id: "a", label: "a", max: 10, score: 8, mark: "half" },
      { id: "b", label: "b", max: 40, score: 36.5, mark: "half" },
    ] as GradeItem[];
    expect(totalScore(items)).toBe(44.5);
  });
});
