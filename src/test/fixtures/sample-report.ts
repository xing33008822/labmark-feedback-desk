/** Builds a lab report .docx shaped like the class template (cover table, numbered sections, 评语 table). */
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

export interface SampleOptions {
  studentNo?: string;
  name?: string;
  className?: string;
  experimentName?: string;
  goal: string;
  principle: string;
  code: string[];
  images: Uint8Array[];
  summary: string;
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };
const cell = (text: string, width: number, span = 1, height?: number) =>
  new TableCell({
    borders,
    columnSpan: span,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, size: 24 })] })],
    ...(height ? {} : {}),
  });

export async function buildSampleReport(o: SampleOptions): Promise<Uint8Array> {
  const cover = new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [1800, 2700, 1800, 2700],
    rows: [
      new TableRow({ children: [cell("课程名称", 1800), cell("操作系统", 7200, 3)] }),
      new TableRow({ children: [cell("实验名称", 1800), cell(o.experimentName ?? "", 7200, 3)] }),
      new TableRow({
        children: [cell("学号", 1800), cell(o.studentNo ?? "", 2700), cell("姓名", 1800), cell(o.name ?? "", 2700)],
      }),
      new TableRow({
        children: [cell("班级", 1800), cell(o.className ?? "", 2700), cell("成绩", 1800), cell("", 2700)],
      }),
    ],
  });

  const h = (text: string) =>
    new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun({ text, bold: true, size: 28 })] });
  const body = (text: string) => new Paragraph({ children: [new TextRun({ text, size: 24 })] });

  const commentTable = new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [9000],
    rows: [
      new TableRow({ children: [cell("评语", 9000)] }),
      new TableRow({
        height: { value: 1800, rule: "atLeast" },
        children: [
          new TableCell({
            borders,
            width: { size: 9000, type: WidthType.DXA },
            children: [new Paragraph("")],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 } } },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [new TextRun({ text: "操作系统实验报告", bold: true, size: 36 })],
          }),
          cover,
          h("一、实验目的"),
          body(o.goal),
          h("二、实验原理"),
          body(o.principle),
          h("三、实验代码"),
          ...o.code.map((l) => new Paragraph({ children: [new TextRun({ text: l, font: "Consolas", size: 20 })] })),
          h("四、实验结果"),
          ...o.images.map(
            (img, i) =>
              new Paragraph({
                children: [
                  new ImageRun({
                    type: "jpg",
                    data: img,
                    transformation: { width: 480, height: 300 },
                    altText: { title: `结果${i + 1}`, description: `运行结果${i + 1}`, name: `result${i + 1}` },
                  }),
                ],
              }),
          ),
          h("五、实验总结"),
          body(o.summary),
          new Paragraph({ spacing: { before: 300 }, children: [] }),
          commentTable,
        ],
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
