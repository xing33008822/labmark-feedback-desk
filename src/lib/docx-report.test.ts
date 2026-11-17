import { readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildSampleReport } from "@/test/fixtures/sample-report";
import { parseReport, writeGradedCopy, type GradeAssets } from "./docx-report";
import { blankItems, totalScore } from "./grading";

const asset = (n: string) => new Uint8Array(readFileSync(path.resolve(__dirname, "../assets/marks", `${n}.png`)));
const shot = new Uint8Array(readFileSync(path.resolve(__dirname, "../assets/shot-1.jpg")));
const assets: GradeAssets = {
  marks: { check: asset("check"), half: asset("half"), cross: asset("cross") },
  digits: Object.fromEntries(
    [..."0123456789."].map((c) => [c, { bytes: asset(`digit-${c === "." ? "dot" : c}`), width: 120, height: 176 }]),
  ),
};

const base = {
  goal: "理解进程调度。",
  principle: "时间片轮转。",
  code: ["int main() {", "  return 0;", "}"],
  images: [shot, shot],
  summary: "收获很多。",
};

async function docXml(bytes: Uint8Array) {
  return (await (await JSZip.loadAsync(bytes)).file("word/document.xml")!.async("string"));
}

describe("reading a report", () => {
  it("reads 学号 and 姓名 from the cover table before the file name", async () => {
    const bytes = await buildSampleReport({ ...base, studentNo: "2023012401", name: "陈思远", experimentName: "实验三 进程调度" });
    const r = await parseReport(bytes, "9999_别人_操作系统_实验一.docx");
    expect(r.studentNo).toBe("2023012401");
    expect(r.name).toBe("陈思远");
    expect(r.identitySource).toBe("cover");
    expect(r.experimentNo).toBe(3);
  });

  it("falls back to {学号}_{姓名}_操作系统_{实验名}.docx when the cover is blank", async () => {
    const bytes = await buildSampleReport(base);
    const r = await parseReport(bytes, "2023012405_李明_操作系统_实验二 进程同步.docx");
    expect(r.studentNo).toBe("2023012405");
    expect(r.name).toBe("李明");
    expect(r.identitySource).toBe("filename");
    expect(r.experimentNo).toBe(2);
  });

  it("finds an answer area for every grading item, including 实验总结, and the screenshots", async () => {
    const r = await parseReport(await buildSampleReport({ ...base, studentNo: "1", name: "x" }), "a.docx");
    expect(r.anchors).toEqual({ goal: "一、实验目的", code: "三、实验代码", result: "四、实验结果", summary: "五、实验总结" });
    expect(r.images).toHaveLength(2);
  });
});

describe("writing the graded copy", () => {
  it("puts marks, comment and digit-image score in the copy and leaves the original untouched", async () => {
    const original = await buildSampleReport({ ...base, studentNo: "2023012401", name: "陈思远", experimentName: "实验三" });
    const before = original.slice();
    const parsed = await parseReport(original, "a.docx");
    const items = blankItems(parsed.anchors).map((i) => ({ ...i, score: i.id === "summary" ? 15.5 : i.max, mark: i.id === "summary" ? ("half" as const) : ("check" as const) }));
    const total = totalScore(items);
    expect(total).toBe(95.5);

    const res = await writeGradedCopy(original, { items, comment: "思路清晰。\n总结可再具体些。", total }, assets);
    expect(original).toEqual(before);
    expect(res.placedMarks).toEqual(["goal", "code", "result", "summary"]);

    const xml = await docXml(res.bytes);
    const dom = new DOMParser().parseFromString(xml, "application/xml");
    const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    // Four floating marks.
    expect(dom.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", "anchor")).toHaveLength(4);
    // Comment is text in the cell under 评语.
    const cells = Array.from(dom.getElementsByTagNameNS(W, "tc"));
    const label = cells.findIndex((c) => c.textContent === "评语");
    expect(cells[label + 1]!.textContent).toBe("思路清晰。总结可再具体些。");
    // Score "95.5" = four inline digit images in the 成绩 cell.
    const gradeIdx = cells.findIndex((c) => c.textContent === "成绩");
    expect(cells[gradeIdx + 1]!.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", "inline")).toHaveLength(4);

    const reparsed = await parseReport(res.bytes, "a.docx");
    expect(reparsed.studentNo).toBe("2023012401");
    expect(reparsed.existingComment).toContain("思路清晰");
  });
});
