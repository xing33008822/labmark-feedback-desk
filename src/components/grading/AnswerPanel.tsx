import { useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { StudentRecord } from "@/lib/grading";

const SOURCE: Record<StudentRecord["identitySource"], string> = {
  cover: "学号姓名读自封面表格",
  filename: "学号姓名读自文件名",
  unknown: "学号姓名未识别",
};

export function AnswerPanel({ student }: { student: StudentRecord }) {
  const [active, setActive] = useState<number | null>(null);
  const shot = active === null ? null : student.screenshots[active];

  return (
    <section className="flex flex-col gap-6">
      <div className="paper-sheet px-5 py-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{student.fileName}</span>
          </span>
          <span>{SOURCE[student.identitySource]}</span>
        </div>
        {student.warnings.length > 0 && (
          <ul className="mt-2 space-y-1 border-t pt-2 text-half">
            {student.warnings.map((w) => (
              <li key={w} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="paper-sheet p-6">
        <SectionTitle title="作答摘录" note={`${student.excerpts.length} 段`} />
        {student.excerpts.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">没有识别到「一、实验目的」这类分节标题。</p>
        ) : (
          <div className="mt-4 space-y-5">
            {student.excerpts.map((e, i) => (
              <article key={`${e.question}-${i}`} className="margin-line pl-4">
                <h3 className="font-serif text-base font-bold text-ink">{e.question}</h3>
                {e.code ? (
                  <pre className="mt-2 max-h-96 overflow-auto rounded-md border bg-muted px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground/90">
                    {e.answer || "（无文字内容）"}
                  </pre>
                ) : (
                  <p className="ruled mt-1 whitespace-pre-wrap text-[15px] text-foreground/85">
                    {e.answer || "（无文字内容）"}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="paper-sheet p-6">
        <SectionTitle
          title="实验结果截图"
          note={student.screenshots.length ? `共 ${student.screenshots.length} 张 · 点击放大` : "报告里没有图片"}
        />
        {student.screenshots.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {student.screenshots.map((s, i) => (
              <button
                key={s.src}
                type="button"
                onClick={() => setActive(i)}
                className={`group overflow-hidden rounded-md border bg-muted text-left transition hover:border-pen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  i === 0 && student.screenshots.length % 2 === 1 ? "sm:col-span-2" : ""
                }`}
              >
                <img
                  src={s.src}
                  alt={s.caption}
                  loading="lazy"
                  className="aspect-[16/10] w-full object-contain transition group-hover:scale-[1.01]"
                />
                <div className="border-t px-3 py-2 text-xs text-muted-foreground">{s.caption}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={shot != null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-5xl p-2">
          <DialogTitle className="px-2 pt-1 text-sm font-medium">{shot?.caption}</DialogTitle>
          {shot && <img src={shot.src} alt={shot.caption} className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b pb-2">
      <h2 className="font-serif text-lg font-bold text-ink">{title}</h2>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}
