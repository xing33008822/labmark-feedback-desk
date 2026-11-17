import { MARKS, totalMax, totalScore, toExcelRows, type StudentRecord } from "./grading";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportExcel(students: StudentRecord[], experimentNo: number) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(toExcelRows(students));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, `第${experimentNo}次实验`);
  XLSX.writeFile(book, `第${experimentNo}次实验_成绩汇总.xlsx`);
}

export async function writeWord(student: StudentRecord) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
  } = await import("docx");

  const RED = "C0392B";
  const cell = (text: string, opts: { bold?: boolean; color?: string } = {}) =>
    new TableCell({
      width: { size: 25, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, size: 22, ...(opts.bold ? { bold: true } : {}), ...(opts.color ? { color: opts.color } : {}) })],
        }),
      ],
    });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: ["评分项", "满分", "得分", "批改"].map((t) => cell(t, { bold: true })),
      }),
      ...student.items.map(
        (i) =>
          new TableRow({
            children: [
              cell(i.label),
              cell(String(i.max)),
              cell(String(i.score), { color: RED, bold: true }),
              cell(MARKS[i.mark].symbol, { color: RED, bold: true }),
            ],
          }),
      ),
      new TableRow({
        children: [
          cell("总分", { bold: true }),
          cell(String(totalMax(student.items))),
          cell(String(totalScore(student.items)), { color: RED, bold: true }),
          cell(""),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `第${student.experimentNo}次实验 · ${student.experimentTitle}`,
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({
                text: `姓名：${student.name}    学号：${student.studentNo}    班级：${student.className}`,
                size: 22,
              }),
            ],
          }),
          table,
          new Paragraph({
            spacing: { before: 300 },
            children: [new TextRun({ text: "评语：", bold: true, size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: student.comment, color: RED, size: 22 })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  download(blob, `${student.studentNo}_${student.name}_第${student.experimentNo}次实验批改.docx`);
}
