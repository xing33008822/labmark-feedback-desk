import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { StudentRecord } from "@/lib/grading";

export function AnswerPanel({ student }: { student: StudentRecord }) {
  const [active, setActive] = useState<number | null>(null);
  const shot = active === null ? null : student.screenshots[active];

  return (
    <section className="flex flex-col gap-6">
      <div className="paper-sheet p-6">
        <SectionTitle title="作答摘录" note={`${student.excerpts.length} 段`} />
        <div className="mt-4 space-y-5">
          {student.excerpts.map((e) => (
            <article key={e.question} className="margin-line pl-4">
              <h3 className="font-serif text-base font-bold text-ink">{e.question}</h3>
              <p className="ruled mt-1 text-[15px] text-foreground/85">{e.answer}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="paper-sheet p-6">
        <SectionTitle title="实验结果截图" note={`共 ${student.screenshots.length} 张 · 点击放大`} />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {student.screenshots.map((s, i) => (
            <button
              key={s.caption}
              type="button"
              onClick={() => setActive(i)}
              className={`group overflow-hidden rounded-md border bg-muted text-left transition hover:border-pen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                i === 0 && student.screenshots.length % 2 === 1 ? "sm:col-span-2" : ""
              }`}
            >
              <img
                src={s.src}
                alt={s.caption}
                width={1280}
                height={800}
                loading="lazy"
                className="aspect-[16/10] w-full object-cover transition group-hover:scale-[1.01]"
              />
              <div className="border-t px-3 py-2 text-xs text-muted-foreground">{s.caption}</div>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={shot !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-5xl p-2">
          <DialogTitle className="px-2 pt-1 text-sm font-medium">{shot?.caption}</DialogTitle>
          {shot && (
            <img src={shot.src} alt={shot.caption} className="w-full rounded" width={1280} height={800} />
          )}
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
