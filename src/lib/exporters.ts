import checkUrl from "@/assets/marks/check.png";
import halfUrl from "@/assets/marks/half.png";
import crossUrl from "@/assets/marks/cross.png";
import d0 from "@/assets/marks/digit-0.png";
import d1 from "@/assets/marks/digit-1.png";
import d2 from "@/assets/marks/digit-2.png";
import d3 from "@/assets/marks/digit-3.png";
import d4 from "@/assets/marks/digit-4.png";
import d5 from "@/assets/marks/digit-5.png";
import d6 from "@/assets/marks/digit-6.png";
import d7 from "@/assets/marks/digit-7.png";
import d8 from "@/assets/marks/digit-8.png";
import d9 from "@/assets/marks/digit-9.png";
import dDot from "@/assets/marks/digit-dot.png";
import { gradedFileName, writeGradedCopy, type GradeAssets, type GradedResult } from "./docx-report";
import { toExcelSheets, totalScore, type StudentRecord } from "./grading";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let assetsPromise: Promise<GradeAssets> | null = null;
function loadAssets(): Promise<GradeAssets> {
  const bytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());
  const digit = async (url: string) => {
    const b = await bytes(url);
    const bmp = await createImageBitmap(new Blob([b], { type: "image/png" }));
    return { bytes: b, width: bmp.width, height: bmp.height };
  };
  const digits: Record<string, string> = { "0": d0, "1": d1, "2": d2, "3": d3, "4": d4, "5": d5, "6": d6, "7": d7, "8": d8, "9": d9, ".": dDot };
  assetsPromise ??= (async () => ({
    marks: { check: await bytes(checkUrl), half: await bytes(halfUrl), cross: await bytes(crossUrl) },
    digits: Object.fromEntries(await Promise.all(Object.entries(digits).map(async ([k, u]) => [k, await digit(u)] as const))),
  }))();
  return assetsPromise;
}

async function graded(buffer: ArrayBuffer, s: StudentRecord): Promise<GradedResult> {
  return writeGradedCopy(buffer, { items: s.items, comment: s.comment, total: totalScore(s.items) }, await loadAssets());
}

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Writes the teacher's graded copy of this student's own report; the original stays as uploaded. */
export async function downloadGradedCopy(buffer: ArrayBuffer, s: StudentRecord): Promise<GradedResult> {
  const res = await graded(buffer, s);
  download(new Blob([res.bytes as BlobPart], { type: DOCX }), gradedFileName(s.fileName));
  return res;
}

export async function downloadGradedZip(list: { buffer: ArrayBuffer; student: StudentRecord }[]) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const { buffer, student } of list) zip.file(gradedFileName(student.fileName), (await graded(buffer, student)).bytes);
  download(await zip.generateAsync({ type: "blob" }), `批改稿_${list.length}份.zip`);
}

export async function exportExcel(students: StudentRecord[]) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  for (const s of toExcelSheets(students)) {
    const sheet = XLSX.utils.json_to_sheet(s.rows, { header: ["学号", "姓名", "总分", "状态"] });
    sheet["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(book, sheet, s.name);
  }
  XLSX.writeFile(book, `班级成绩_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
