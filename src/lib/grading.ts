export type Mark = "check" | "half" | "cross";

export interface GradeItem {
  id: string;
  label: string;
  max: number;
  score: number;
  mark: Mark;
  /** Heading of the answer area in the .docx the mark floats over; null if not found. */
  anchor: string | null;
}

export interface Excerpt {
  question: string;
  answer: string;
  code: boolean;
}

export interface Screenshot {
  src: string;
  caption: string;
}

export type IdentitySource = "cover" | "filename" | "unknown";

export interface StudentRecord {
  id: string;
  fileName: string;
  name: string;
  studentNo: string;
  identitySource: IdentitySource;
  experimentNo: number | null;
  experimentName: string;
  excerpts: Excerpt[];
  screenshots: Screenshot[];
  items: GradeItem[];
  comment: string;
  written: boolean;
  /** Things the graded copy cannot place, shown to the teacher before confirming. */
  warnings: string[];
}

export const MARKS: Record<Mark, { symbol: string; label: string }> = {
  check: { symbol: "✓", label: "对勾" },
  half: { symbol: "半✓", label: "半对" },
  cross: { symbol: "✗", label: "叉" },
};

/** Grading items and the heading keywords that locate each one's answer area in the report. */
export const GRADE_TEMPLATE: { id: string; label: string; max: number; keywords: string[] }[] = [
  { id: "goal", label: "实验目的与原理", max: 10, keywords: ["目的", "原理", "要求"] },
  { id: "code", label: "核心代码实现", max: 40, keywords: ["代码", "程序", "源码", "算法", "实现", "步骤", "内容"] },
  { id: "result", label: "运行结果截图", max: 30, keywords: ["结果", "截图", "运行", "测试"] },
  { id: "summary", label: "实验总结", max: 20, keywords: ["总结", "心得", "体会"] },
];

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

/** "85" for whole numbers, "85.5" otherwise — the characters drawn as digit images. */
export function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/** Pick each grading item's answer area from the report's section headings (each heading used once). */
export function matchAnchors(headings: string[]): Record<string, string | null> {
  const taken = new Set<number>();
  const out: Record<string, string | null> = {};
  // Summary and results first: "实验结果与分析" should not be swallowed by a broader keyword.
  const order = ["summary", "result", "goal", "code"];
  for (const id of order) {
    const t = GRADE_TEMPLATE.find((g) => g.id === id)!;
    let hit: number | null = null;
    for (const kw of t.keywords) {
      const i = headings.findIndex((h, idx) => !taken.has(idx) && h.includes(kw));
      if (i >= 0) {
        hit = i;
        break;
      }
    }
    if (hit !== null) taken.add(hit);
    out[id] = hit === null ? null : headings[hit]!;
  }
  return out;
}

export function blankItems(anchors: Record<string, string | null>): GradeItem[] {
  return GRADE_TEMPLATE.map((t) => ({
    id: t.id,
    label: t.label,
    max: t.max,
    score: 0,
    mark: "cross",
    anchor: anchors[t.id] ?? null,
  }));
}

const CN_DIGITS: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** "三" → 3, "十二" → 12, "二十" → 20, "7" → 7. */
export function chineseNumber(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s);
  if (!/^[零一二两三四五六七八九十]+$/.test(s)) return null;
  if (!s.includes("十")) return s.length === 1 ? (CN_DIGITS[s] ?? null) : null;
  const [tens, ones] = s.split("十");
  const t = tens ? (CN_DIGITS[tens] ?? NaN) : 1;
  const o = ones ? (CN_DIGITS[ones] ?? NaN) : 0;
  const n = t * 10 + o;
  return Number.isNaN(n) ? null : n;
}

/** Experiment number from names like "实验三 进程调度", "第2次实验", "实验4". */
export function experimentNumber(name: string): number | null {
  const m = name.match(/实验\s*([零一二两三四五六七八九十\d]+)/) ?? name.match(/第\s*([零一二两三四五六七八九十\d]+)\s*次/);
  return m ? chineseNumber(m[1]!) : null;
}

/** Parse `{学号}_{姓名}_{课程}_{实验名}.docx`. Returns null when the name doesn't follow it. */
export function parseFileName(fileName: string): { studentNo: string; name: string; experimentName: string } | null {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.docx$/i, "");
  const parts = base.split(/[_＿]/).map((p) => p.trim());
  if (parts.length < 2) return null;
  const [studentNo, name, , ...rest] = parts;
  if (!studentNo || !/^[A-Za-z0-9]{4,}$/.test(studentNo) || !name) return null;
  return { studentNo, name, experimentName: rest.join("_") };
}

export function experimentLabel(s: Pick<StudentRecord, "experimentNo" | "experimentName">): string {
  return s.experimentNo !== null ? `第${s.experimentNo}次实验` : s.experimentName || "未命名实验";
}

export function statusLabel(s: Pick<StudentRecord, "written">): string {
  return s.written ? "已确认" : "待复核";
}

export interface SheetData {
  name: string;
  rows: Record<string, string | number>[];
}

/** One sheet per experiment plus a summary sheet; columns 学号, 姓名, 总分, 状态. */
export function toExcelSheets(students: StudentRecord[]): SheetData[] {
  const groups = new Map<string, { no: number | null; list: StudentRecord[] }>();
  for (const s of students) {
    const key = experimentLabel(s);
    const g = groups.get(key) ?? { no: s.experimentNo, list: [] };
    g.list.push(s);
    groups.set(key, g);
  }
  const ordered = [...groups.entries()].sort(
    ([a, ga], [b, gb]) => (ga.no ?? 999) - (gb.no ?? 999) || a.localeCompare(b, "zh"),
  );
  const byNo = (a: { 学号: string | number }, b: { 学号: string | number }) =>
    String(a.学号).localeCompare(String(b.学号));

  const used = new Set<string>(["汇总"]);
  const sheets: SheetData[] = ordered.map(([label, g]) => {
    let name = label.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "实验";
    for (let n = 2; used.has(name); n++) name = `${label.slice(0, 28)}(${n})`;
    used.add(name);
    return {
      name,
      rows: g.list
        .map((s) => ({ 学号: s.studentNo, 姓名: s.name, 总分: totalScore(s.items), 状态: statusLabel(s) }))
        .sort(byNo),
    };
  });

  const people = new Map<string, { 学号: string; 姓名: string; total: number; done: number; count: number }>();
  for (const s of students) {
    const key = s.studentNo || s.name;
    const p = people.get(key) ?? { 学号: s.studentNo, 姓名: s.name, total: 0, done: 0, count: 0 };
    p.total += totalScore(s.items);
    p.count += 1;
    if (s.written) p.done += 1;
    people.set(key, p);
  }
  const summary: SheetData = {
    name: "汇总",
    rows: [...people.values()]
      .map((p) => ({
        学号: p.学号,
        姓名: p.姓名,
        总分: p.total,
        状态: p.done === p.count ? `已确认 ${p.done}/${p.count}` : `待复核 ${p.count - p.done}/${p.count}`,
      }))
      .sort(byNo),
  };
  return [summary, ...sheets];
}
