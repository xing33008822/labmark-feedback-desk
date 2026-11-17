export type Mark = "check" | "half" | "cross";

export interface GradeItem {
  id: string;
  label: string;
  max: number;
  score: number;
  mark: Mark;
}

export interface Excerpt {
  question: string;
  answer: string;
}

export interface Screenshot {
  src: string;
  caption: string;
}

export interface StudentRecord {
  id: string;
  name: string;
  studentNo: string;
  className: string;
  experimentNo: number;
  experimentTitle: string;
  excerpts: Excerpt[];
  screenshots: Screenshot[];
  items: GradeItem[];
  comment: string;
  written: boolean;
}

export const MARKS: Record<Mark, { symbol: string; label: string }> = {
  check: { symbol: "✓", label: "对勾" },
  half: { symbol: "半✓", label: "半对" },
  cross: { symbol: "✗", label: "叉" },
};

/** Clamp a typed score into [0, max], rounding to 0.5. */
export function clampScore(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 2) / 2;
  return Math.min(Math.max(rounded, 0), max);
}

/** Full marks → check, zero → cross, anything in between → half check. */
export function suggestMark(score: number, max: number): Mark {
  if (score >= max) return "check";
  if (score <= 0) return "cross";
  return "half";
}

export function totalScore(items: GradeItem[]): number {
  return items.reduce((sum, i) => sum + i.score, 0);
}

export function totalMax(items: GradeItem[]): number {
  return items.reduce((sum, i) => sum + i.max, 0);
}

/** One row per student for the Excel summary. */
export function toExcelRows(students: StudentRecord[]) {
  return students.map((s) => {
    const row: Record<string, string | number> = {
      学号: s.studentNo,
      姓名: s.name,
      班级: s.className,
      实验: `第${s.experimentNo}次实验`,
    };
    for (const item of s.items) {
      row[`${item.label}(${item.max})`] = item.score;
      row[`${item.label}标记`] = MARKS[item.mark].symbol;
    }
    row["总分"] = totalScore(s.items);
    row["评语"] = s.comment;
    row["已写入Word"] = s.written ? "是" : "否";
    return row;
  });
}
