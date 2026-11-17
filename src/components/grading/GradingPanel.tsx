import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MARKS,
  clampScore,
  suggestMark,
  totalMax,
  totalScore,
  type Mark,
  type StudentRecord,
} from "@/lib/grading";
import { SectionTitle } from "./AnswerPanel";

interface Props {
  student: StudentRecord;
  phrases: string[];
  onChange: (next: StudentRecord) => void;
  onWriteWord: () => void;
  onExportExcel: () => void;
  busy: "word" | "excel" | null;
}

const markStyle: Record<Mark, { on: string; off: string }> = {
  check: { on: "bg-ok text-pen-foreground border-ok", off: "hover:bg-ok-soft hover:text-ok" },
  half: { on: "bg-half text-pen-foreground border-half", off: "hover:bg-half-soft hover:text-half" },
  cross: { on: "bg-pen text-pen-foreground border-pen", off: "hover:bg-pen-soft hover:text-pen" },
};

export function GradingPanel({ student, phrases, onChange, onWriteWord, onExportExcel, busy }: Props) {
  const total = totalScore(student.items);
  const max = totalMax(student.items);

  const updateItem = (id: string, patch: { score?: number; mark?: Mark }) => {
    onChange({
      ...student,
      written: false,
      items: student.items.map((i) => {
        if (i.id !== id) return i;
        if (patch.score !== undefined) {
          const score = clampScore(patch.score, i.max);
          return { ...i, score, mark: suggestMark(score, i.max) };
        }
        return { ...i, ...patch };
      }),
    });
  };

  const addPhrase = (p: string) =>
    onChange({
      ...student,
      written: false,
      comment: student.comment ? `${student.comment}${p}` : p,
    });

  return (
    <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
      <div className="paper-sheet p-6">
        <div className="flex items-end justify-between border-b pb-3">
          <h2 className="font-serif text-lg font-bold text-ink">评分项</h2>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">总分</div>
            <div className="pen-score text-4xl leading-none">
              {total}
              <span className="ml-1 text-base text-muted-foreground">/ {max}</span>
            </div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-xs text-muted-foreground">
          <span className="py-2">项目</span>
          <span className="w-24 text-center">分数</span>
          <span className="w-[132px] text-center">勾叉</span>
        </div>

        <ul className="divide-y">
          {student.items.map((item) => (
            <li key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 py-3">
              <span className="text-sm font-medium">{item.label}</span>
              <label className="flex w-24 items-center gap-1 rounded-md border bg-background px-2 focus-within:ring-2 focus-within:ring-ring">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={item.max}
                  step={0.5}
                  value={item.score}
                  onChange={(e) => updateItem(item.id, { score: Number(e.target.value) })}
                  aria-label={`${item.label}得分`}
                  className="pen-score h-9 w-full bg-transparent text-right text-lg outline-none"
                />
                <span className="text-xs text-muted-foreground">/{item.max}</span>
              </label>
              <div className="flex w-[132px] gap-1" role="radiogroup" aria-label={`${item.label}勾叉`}>
                {(Object.keys(MARKS) as Mark[]).map((m) => {
                  const on = item.mark === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      title={MARKS[m].label}
                      onClick={() => updateItem(item.id, { mark: m })}
                      className={cn(
                        "flex h-9 w-10 items-center justify-center rounded-md border font-serif text-lg font-bold transition",
                        on ? markStyle[m].on : cn("bg-background text-muted-foreground", markStyle[m].off),
                      )}
                    >
                      {MARKS[m].symbol}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          输入分数后会自动推荐：满分 ✓、零分 ✗、其余半对 ✓̸，可手动改。
        </p>
      </div>

      <div className="paper-sheet p-6">
        <SectionTitle title="评语" note="已写好的评语，可直接修改" />
        <Textarea
          value={student.comment}
          onChange={(e) => onChange({ ...student, written: false, comment: e.target.value })}
          rows={5}
          className="ruled mt-4 resize-none border-dashed bg-background py-0 text-[15px] text-pen"
          aria-label="评语"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {phrases.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => addPhrase(p)}
              className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-pen hover:text-pen"
            >
              + {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="pen" size="xl" onClick={onWriteWord} disabled={busy !== null}>
          {busy === "word" ? <Loader2 className="animate-spin" /> : <FileText />}
          确认写入 Word
        </Button>
        <Button variant="outline" size="xl" onClick={onExportExcel} disabled={busy !== null}>
          {busy === "excel" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
          导出 Excel
        </Button>
      </div>
    </aside>
  );
}
