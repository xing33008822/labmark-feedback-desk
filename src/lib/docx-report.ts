/**
 * Reads a student's lab report (.docx) and writes the teacher's graded copy.
 * Runs in the browser (DOMParser/XMLSerializer + JSZip); the original bytes are never modified.
 */
import JSZip from "jszip";
import {
  GRADE_TEMPLATE,
  experimentNumber,
  formatScore,
  matchAnchors,
  parseFileName,
  type GradeItem,
  type IdentitySource,
  type Mark,
} from "./grading";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const V = "urn:schemas-microsoft-com:vml";
const PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const IMAGE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const RED = "C62828";

export interface ReportImage {
  bytes: Uint8Array;
  mime: string;
  caption: string;
}

export interface ParsedReport {
  studentNo: string;
  name: string;
  identitySource: IdentitySource;
  experimentName: string;
  experimentNo: number | null;
  sections: { heading: string; text: string; code: boolean }[];
  images: ReportImage[];
  existingComment: string;
  anchors: Record<string, string | null>;
  warnings: string[];
}

// ---------- XML helpers ----------

const norm = (s: string) => s.replace(/[\s\u3000:：]/g, "");
const els = (root: Document | Element, ns: string, tag: string) => Array.from(root.getElementsByTagNameNS(ns, tag));
const kids = (el: Element, tag: string) =>
  Array.from(el.children).filter((c) => c.namespaceURI === W && c.localName === tag);

function paraText(p: Element): string {
  let out = "";
  const walk = (n: Element) => {
    for (const c of Array.from(n.children)) {
      if (c.namespaceURI === W && c.localName === "t") out += c.textContent ?? "";
      else if (c.namespaceURI === W && c.localName === "tab") out += "\t";
      else if (c.namespaceURI === W && (c.localName === "br" || c.localName === "cr")) out += "\n";
      else if (!(c.namespaceURI === W && (c.localName === "delText" || c.localName === "instrText"))) walk(c);
    }
  };
  walk(p);
  return out;
}

const cellText = (tc: Element) => els(tc, W, "p").map(paraText).join("\n").trim();

function closest(el: Element, tag: string): Element | null {
  let n: Element | null = el.parentElement;
  while (n && !(n.namespaceURI === W && n.localName === tag)) n = n.parentElement;
  return n;
}

function gridSpan(tc: Element): number {
  const span = els(tc, W, "gridSpan")[0];
  return Number(span?.getAttributeNS(W, "val") ?? span?.getAttribute("w:val") ?? 1) || 1;
}

function nextSiblingEl(el: Element, tag: string): Element | null {
  let n = el.nextElementSibling;
  while (n && !(n.namespaceURI === W && n.localName === tag)) n = n.nextElementSibling;
  return n;
}

function cellBelow(tc: Element): Element | null {
  const tr = closest(tc, "tr");
  if (!tr) return null;
  let col = 0;
  for (const c of kids(tr, "tc")) {
    if (c === tc) break;
    col += gridSpan(c);
  }
  const next = nextSiblingEl(tr, "tr");
  if (!next) return null;
  let start = 0;
  for (const c of kids(next, "tc")) {
    const span = gridSpan(c);
    if (col >= start && col < start + span) return c;
    start += span;
  }
  return null;
}

/** A label cell ("学号", "学号：", ...) and the text that follows the label inside it, if any. */
function findLabel(doc: Document, labels: string[], scope?: Element | null) {
  const cells = els(scope ?? doc, W, "tc").filter((tc) => !els(tc, W, "tbl").length);
  for (const tc of cells) {
    const t = norm(cellText(tc));
    for (const l of labels) {
      if (t === l) return { tc, inline: "" };
      if (t.startsWith(l) && t.length <= l.length + 24 && /^[\s:：]/.test(cellText(tc).slice(l.length))) {
        return { tc, inline: cellText(tc).slice(l.length).replace(/^[\s:：]+/, "").trim() };
      }
    }
  }
  return null;
}

function valueCell(tc: Element): Element | null {
  return nextSiblingEl(tc, "tc") ?? cellBelow(tc);
}

const LABELS = {
  studentNo: ["学号"],
  name: ["姓名", "学生姓名"],
  experiment: ["实验名称", "实验题目", "实验项目", "实验项目名称"],
  grade: ["成绩", "实验成绩", "成绩评定"],
  comment: ["评语", "教师评语", "指导教师评语", "评语栏", "教师评价"],
};
const ALL_LABELS = Object.values(LABELS).flat();

function findCover(doc: Document) {
  const sn = findLabel(doc, LABELS.studentNo);
  const table = sn ? closest(sn.tc, "tbl") : null;
  const read = (hit: { tc: Element; inline: string } | null) => {
    if (!hit) return "";
    if (hit.inline) return hit.inline;
    const v = valueCell(hit.tc);
    const t = v ? cellText(v).replace(/\s+/g, " ").trim() : "";
    return ALL_LABELS.includes(norm(t)) ? "" : t;
  };
  const nameHit = findLabel(doc, LABELS.name, table) ?? findLabel(doc, LABELS.name);
  const expHit = findLabel(doc, LABELS.experiment, table) ?? findLabel(doc, LABELS.experiment);
  const gradeHit = findLabel(doc, LABELS.grade, table) ?? findLabel(doc, LABELS.grade);
  return {
    studentNo: read(sn),
    name: read(nameHit),
    experimentName: read(expHit),
    gradeCell: gradeHit ? (gradeHit.inline ? gradeHit.tc : valueCell(gradeHit.tc)) : null,
  };
}

/** Where the comment goes: the cell under 「评语」, else the cell to its right, else the label cell itself. */
function findCommentTarget(doc: Document): { cell: Element | null; afterPara: Element | null } {
  const hit = findLabel(doc, LABELS.comment);
  if (hit) {
    const below = cellBelow(hit.tc);
    if (below && !ALL_LABELS.includes(norm(cellText(below)))) return { cell: below, afterPara: null };
    const right = nextSiblingEl(hit.tc, "tc");
    if (right) return { cell: right, afterPara: null };
    return { cell: null, afterPara: els(hit.tc, W, "p").at(-1) ?? null };
  }
  const p = els(doc, W, "p").find((p) => LABELS.comment.includes(norm(paraText(p))));
  return { cell: null, afterPara: p ?? null };
}

// ---------- sections ----------

const SECTION_WORDS = /目的|原理|要求|环境|设备|内容|步骤|代码|程序|源码|算法|实现|结果|截图|运行|测试|分析|讨论|总结|心得|体会|设计/;
const CN_PREFIX = /^[一二三四五六七八九十]+\s*[、.．]/;
const NUM_PREFIX = /^([（(]?[一二三四五六七八九十\d]+[)）]|\d+\s*[、.．]|第[一二三四五六七八九十\d]+部分)/;
const CODE_FONT = /consolas|courier|menlo|monaco|mono|source code|fira code|jetbrains/i;

function isHeading(p: Element, text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 40) return false;
  if (ALL_LABELS.includes(norm(t))) return false;
  const style = els(p, W, "pStyle")[0]?.getAttributeNS(W, "val") ?? "";
  if (/heading|标题|^[1-6]$/i.test(style) && SECTION_WORDS.test(t)) return true;
  if (CN_PREFIX.test(t)) return true;
  if (NUM_PREFIX.test(t) && SECTION_WORDS.test(t) && t.length <= 24) return true;
  return /^实验(目的|原理|要求|环境|设备|内容|步骤|代码|程序|结果|分析|总结|心得|体会)/.test(t);
}

const isCodePara = (p: Element) =>
  els(p, W, "rFonts").some((f) => CODE_FONT.test(f.getAttributeNS(W, "ascii") ?? f.getAttributeNS(W, "hAnsi") ?? ""));

interface Section {
  heading: string;
  headingPara: Element;
  paras: Element[];
}

function collectSections(doc: Document): Section[] {
  const body = els(doc, W, "body")[0];
  if (!body) return [];
  const out: Section[] = [];
  let cur: Section | null = null;
  for (const p of els(body, W, "p")) {
    const text = paraText(p);
    if (ALL_LABELS.includes(norm(text)) || (closest(p, "tc") && ALL_LABELS.includes(norm(cellText(closest(p, "tc")!))))) {
      if (LABELS.comment.includes(norm(text)) || LABELS.grade.includes(norm(text))) cur = null;
      continue;
    }
    if (isHeading(p, text)) {
      cur = { heading: text.trim(), headingPara: p, paras: [] };
      out.push(cur);
    } else if (cur) cur.paras.push(p);
  }
  return out;
}

function imageRefs(p: Element): string[] {
  return [
    ...els(p, A, "blip").map((b) => b.getAttributeNS(R, "embed") ?? ""),
    ...els(p, V, "imagedata").map((b) => b.getAttributeNS(R, "id") ?? ""),
  ].filter(Boolean);
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
};

async function readRels(zip: JSZip): Promise<Document> {
  const xml = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? `<Relationships xmlns="${PKG_REL}"/>`;
  return new DOMParser().parseFromString(xml, "application/xml");
}

function relTargets(rels: Document): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of Array.from(rels.getElementsByTagName("Relationship"))) {
    const target = r.getAttribute("Target") ?? "";
    m.set(r.getAttribute("Id") ?? "", target.startsWith("/") ? target.slice(1) : `word/${target}`);
  }
  return m;
}

async function openDoc(buffer: ArrayBuffer | Uint8Array) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("不是有效的 Word 文件（缺少正文）");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Word 正文无法读取");
  return { zip, doc };
}

// ---------- parse ----------

export async function parseReport(buffer: ArrayBuffer | Uint8Array, fileName: string): Promise<ParsedReport> {
  const { zip, doc } = await openDoc(buffer);
  const rels = relTargets(await readRels(zip));
  const cover = findCover(doc);
  const fromName = parseFileName(fileName);
  const warnings: string[] = [];

  let identitySource: IdentitySource = "cover";
  let studentNo = cover.studentNo.replace(/\s+/g, "");
  let name = cover.name.replace(/\s+/g, "");
  if (!studentNo || !name) {
    if (fromName) {
      identitySource = "filename";
      studentNo ||= fromName.studentNo;
      name ||= fromName.name;
    } else identitySource = studentNo || name ? "cover" : "unknown";
  }
  if (identitySource === "filename") warnings.push("封面表格里没读到学号或姓名，已按文件名识别");
  if (identitySource === "unknown") warnings.push("封面和文件名都读不到学号姓名，请核对");

  const experimentName = cover.experimentName || fromName?.experimentName || "";
  const sections = collectSections(doc);
  const images: ReportImage[] = [];
  let figure = 0;
  for (const s of sections) {
    for (const p of [s.headingPara, ...s.paras]) {
      for (const rid of imageRefs(p)) {
        const path = rels.get(rid);
        const ext = path?.split(".").pop()?.toLowerCase() ?? "";
        const file = path ? zip.file(path) : null;
        if (!file || !MIME[ext]) continue;
        figure += 1;
        images.push({ bytes: await file.async("uint8array"), mime: MIME[ext]!, caption: `图${figure} · ${s.heading}` });
      }
    }
  }

  const anchors = matchAnchors(sections.map((s) => s.heading));
  for (const t of GRADE_TEMPLATE) if (!anchors[t.id]) warnings.push(`没找到「${t.label}」对应的作答区，这一项不会盖勾叉`);
  const target = findCommentTarget(doc);
  if (!target.cell && !target.afterPara) warnings.push("没找到「评语」单元格，评语不会写入");
  if (!cover.gradeCell) warnings.push("封面表里没找到「成绩」格，总分不会写入");

  return {
    studentNo,
    name,
    identitySource,
    experimentName,
    experimentNo: experimentNumber(experimentName) ?? experimentNumber(fileName),
    sections: sections.map((s) => {
      const lines = s.paras.map(paraText);
      const codeCount = s.paras.filter(isCodePara).length;
      return {
        heading: s.heading,
        text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
        code: /代码|程序|源码/.test(s.heading) || (s.paras.length > 0 && codeCount / s.paras.length > 0.5),
      };
    }),
    images,
    existingComment: target.cell ? cellText(target.cell) : "",
    anchors,
    warnings,
  };
}

// ---------- write graded copy ----------

export interface GradeAssets {
  marks: Record<Mark, Uint8Array>;
  /** Keys "0"–"9" and "."; width/height are the PNG's pixel size. */
  digits: Record<string, { bytes: Uint8Array; width: number; height: number }>;
}

export interface GradedResult {
  bytes: Uint8Array;
  placedMarks: string[];
  comment: boolean;
  grade: boolean;
}

const CM = 360000; // EMU per cm
const NS_DECL = `xmlns:w="${W}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="${A}" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="${R}"`;

function graphic(id: number, rid: string, cx: number, cy: number, name: string) {
  return `<wp:docPr id="${id}" name="${name} ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>`;
}

function floatingRun(id: number, rid: string, size: number) {
  return `<w:r ${NS_DECL}><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="${251660000 + id}" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:align>right</wp:align></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${Math.round(-0.35 * CM)}</wp:posOffset></wp:positionV><wp:extent cx="${size}" cy="${size}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>${graphic(id, rid, size, size, "批改标记")}</wp:anchor></w:drawing></w:r>`;
}

function inlineRun(id: number, rid: string, cx: number, cy: number) {
  return `<w:r ${NS_DECL}><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>${graphic(id, rid, cx, cy, "成绩数字")}</wp:inline></w:drawing></w:r>`;
}

function importXml(doc: Document, xml: string): Element {
  const frag = new DOMParser().parseFromString(xml, "application/xml");
  return doc.importNode(frag.documentElement, true) as Element;
}

function clearCell(doc: Document, tc: Element): void {
  for (const c of Array.from(tc.children)) if (!(c.namespaceURI === W && c.localName === "tcPr")) tc.removeChild(c);
}

function textPara(doc: Document, line: string): Element {
  const p = doc.createElementNS(W, "w:p");
  const r = doc.createElementNS(W, "w:r");
  const rPr = doc.createElementNS(W, "w:rPr");
  const color = doc.createElementNS(W, "w:color");
  color.setAttributeNS(W, "w:val", RED);
  rPr.appendChild(color);
  const t = doc.createElementNS(W, "w:t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = line;
  r.append(rPr, t);
  p.appendChild(r);
  return p;
}

export async function writeGradedCopy(
  original: ArrayBuffer | Uint8Array,
  grading: { items: GradeItem[]; comment: string; total: number },
  assets: GradeAssets,
): Promise<GradedResult> {
  // Work on a copy so the student's original bytes stay untouched.
  const copy = original instanceof Uint8Array ? original.slice() : new Uint8Array(original.slice(0));
  const { zip, doc } = await openDoc(copy);
  const relsDoc = await readRels(zip);
  const relsRoot = relsDoc.documentElement;

  let nextId = Math.max(0, ...els(doc, "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", "docPr").map((d) => Number(d.getAttribute("id")) || 0)) + 1;
  const relIds = new Set(Array.from(relsDoc.getElementsByTagName("Relationship")).map((r) => r.getAttribute("Id")));
  const media = new Map<string, string>();
  const addImage = (key: string, bytes: Uint8Array) => {
    const existing = media.get(key);
    if (existing) return existing;
    let n = 1;
    while (relIds.has(`rIdGrade${n}`)) n++;
    const rid = `rIdGrade${n}`;
    relIds.add(rid);
    const target = `media/grade_${key}.png`;
    zip.file(`word/${target}`, bytes);
    const rel = relsDoc.createElementNS(PKG_REL, "Relationship");
    rel.setAttribute("Id", rid);
    rel.setAttribute("Type", IMAGE_REL);
    rel.setAttribute("Target", target);
    relsRoot.appendChild(rel);
    media.set(key, rid);
    return rid;
  };

  // 1) Marks floating over each answer area (实验总结 included).
  const sections = collectSections(doc);
  const placedMarks: string[] = [];
  for (const item of grading.items) {
    const section = item.anchor ? sections.find((s) => s.heading === item.anchor) : undefined;
    if (!section) continue;
    const rid = addImage(`mark_${item.mark}`, assets.marks[item.mark]);
    section.headingPara.appendChild(importXml(doc, floatingRun(nextId++, rid, Math.round(1.5 * CM))));
    placedMarks.push(item.id);
  }

  // 2) Comment as editable text in the cell under 「评语」.
  const target = findCommentTarget(doc);
  const lines = grading.comment.split(/\r?\n/);
  let comment = false;
  if (target.cell) {
    clearCell(doc, target.cell);
    for (const l of lines) target.cell.appendChild(textPara(doc, l));
    comment = true;
  } else if (target.afterPara) {
    let ref: Element = target.afterPara;
    for (const l of lines) {
      const p = textPara(doc, l);
      ref.parentNode!.insertBefore(p, ref.nextSibling);
      ref = p;
    }
    comment = true;
  }

  // 3) Total score built from digit images in the cover table's 「成绩」 cell.
  const gradeCell = findCover(doc).gradeCell;
  let grade = false;
  if (gradeCell) {
    clearCell(doc, gradeCell);
    const p = doc.createElementNS(W, "w:p");
    const pPr = doc.createElementNS(W, "w:pPr");
    const jc = doc.createElementNS(W, "w:jc");
    jc.setAttributeNS(W, "w:val", "center");
    pPr.appendChild(jc);
    p.appendChild(pPr);
    const h = Math.round(0.85 * CM);
    for (const ch of formatScore(grading.total)) {
      const d = assets.digits[ch];
      if (!d) continue;
      const rid = addImage(`digit_${ch === "." ? "dot" : ch}`, d.bytes);
      p.appendChild(importXml(doc, inlineRun(nextId++, rid, Math.round((h * d.width) / d.height), h)));
    }
    gradeCell.appendChild(p);
    grade = true;
  }

  // Package bookkeeping: png content type, relationships, document.
  const ctPath = "[Content_Types].xml";
  const ct = new DOMParser().parseFromString((await zip.file(ctPath)!.async("string")), "application/xml");
  const hasPng = Array.from(ct.getElementsByTagName("Default")).some((d) => d.getAttribute("Extension")?.toLowerCase() === "png");
  if (!hasPng) {
    const d = ct.createElementNS(ct.documentElement.namespaceURI, "Default");
    d.setAttribute("Extension", "png");
    d.setAttribute("ContentType", "image/png");
    ct.documentElement.insertBefore(d, ct.documentElement.firstChild);
  }
  const ser = new XMLSerializer();
  const withDecl = (d: Document) => {
    const s = ser.serializeToString(d);
    return s.startsWith("<?xml") ? s : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${s}`;
  };
  zip.file(ctPath, withDecl(ct));
  zip.file("word/_rels/document.xml.rels", withDecl(relsDoc));
  zip.file("word/document.xml", withDecl(doc));

  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { bytes, placedMarks, comment, grade };
}

export function gradedFileName(fileName: string): string {
  return fileName.replace(/^.*[\\/]/, "").replace(/\.docx$/i, "") + "_批改稿.docx";
}
