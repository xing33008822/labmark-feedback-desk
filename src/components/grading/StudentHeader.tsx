import { ChevronLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { experimentLabel, type StudentRecord } from "@/lib/grading";

interface Props {
  student: StudentRecord;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function StudentHeader({ student, index, total, onPrev, onNext }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b bg-ink text-ink-foreground">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-10 gap-y-3 px-6 py-4">
        <Field label="姓名" value={student.name} large />
        <Field label="学号" value={student.studentNo} mono />
        <div className="flex items-baseline gap-3">
          <span className="text-xs tracking-widest opacity-60">实验</span>
          <span className="font-serif text-2xl font-bold">
            {student.experimentNo !== null ? (
              <>
                第<span className="mx-1 text-pen-soft">{student.experimentNo}</span>次实验
              </>
            ) : (
              experimentLabel(student)
            )}
          </span>
          {student.experimentName && student.experimentNo !== null && (
            <span className="hidden text-sm opacity-70 md:inline">· {student.experimentName}</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs opacity-80">
            {student.written ? (
              <CheckCircle2 className="size-4 text-ok-soft" />
            ) : (
              <Circle className="size-4" />
            )}
            {student.written ? "批改稿已写出" : "待复核"}
          </span>
          <div className="flex items-center gap-1 rounded-md border border-ink-foreground/20 p-0.5">
            <Button
              size="icon"
              variant="ink"
              onClick={onPrev}
              disabled={index === 0}
              aria-label="上一位学生"
            >
              <ChevronLeft />
            </Button>
            <span className="w-14 text-center font-mono text-sm">
              {index + 1} / {total}
            </span>
            <Button
              size="icon"
              variant="ink"
              onClick={onNext}
              disabled={index === total - 1}
              aria-label="下一位学生"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function Field({
  label,
  value,
  large,
  mono,
}: {
  label: string;
  value: string;
  large?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs tracking-widest opacity-60">{label}</span>
      <span
        className={
          large
            ? "font-serif text-2xl font-bold"
            : mono
              ? "font-mono text-lg tracking-wide"
              : "text-lg"
        }
      >
        {value}
      </span>
    </div>
  );
}
