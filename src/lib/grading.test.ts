import { describe, expect, it } from "vitest";
import {
  chineseNumber,
  clampScore,
  parseFileName,
  suggestMark,
  toExcelSheets,
  totalScore,
  type GradeItem,
  type StudentRecord,
} from "./grading";

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
      { id: "a", label: "a", max: 10, score: 8, mark: "half", anchor: null },
      { id: "b", label: "b", max: 40, score: 36.5, mark: "half", anchor: null },
    ] as GradeItem[];
    expect(totalScore(items)).toBe(44.5);
  });
  it("file name {学号}_{姓名}_操作系统_{实验名}.docx gives 学号 and 姓名", () => {
    expect(parseFileName("2023012401_陈思远_操作系统_实验三进程调度.docx")).toEqual({
      studentNo: "2023012401",
      name: "陈思远",
      experimentName: "实验三进程调度",
    });
  });
  it("reads Chinese experiment numbers", () => {
    expect(chineseNumber("三")).toBe(3);
    expect(chineseNumber("十二")).toBe(12);
  });
});

const rec = (no: string, name: string, exp: number, score: number, written: boolean): StudentRecord => ({
  id: `${no}-${exp}`,
  fileName: "",
  name,
  studentNo: no,
  identitySource: "cover",
  experimentNo: exp,
  experimentName: "",
  excerpts: [],
  screenshots: [],
  items: [{ id: "a", label: "a", max: 100, score, mark: "half", anchor: null }],
  comment: "",
  written,
  warnings: [],
});

describe("Excel export", () => {
  const sheets = toExcelSheets([rec("02", "乙", 1, 80, true), rec("01", "甲", 1, 90, false), rec("01", "甲", 2, 70, true)]);

  it("has a summary sheet plus one sheet per experiment", () => {
    expect(sheets.map((s) => s.name)).toEqual(["汇总", "第1次实验", "第2次实验"]);
  });
  it("columns are 学号, 姓名, 总分, 状态", () => {
    for (const s of sheets) expect(Object.keys(s.rows[0]!)).toEqual(["学号", "姓名", "总分", "状态"]);
  });
  it("experiment sheet lists each student's total and status", () => {
    expect(sheets[1]!.rows).toEqual([
      { 学号: "01", 姓名: "甲", 总分: 90, 状态: "待复核" },
      { 学号: "02", 姓名: "乙", 总分: 80, 状态: "已确认" },
    ]);
  });
  it("summary adds up a student's experiments", () => {
    expect(sheets[0]!.rows[0]).toEqual({ 学号: "01", 姓名: "甲", 总分: 160, 状态: "待复核 1/2" });
  });
});
