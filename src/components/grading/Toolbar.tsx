import { useState } from "react";
import { Archive, Check, ChevronsUpDown, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { experimentLabel, totalScore, type StudentRecord } from "@/lib/grading";
import { ImportButtons } from "./ImportControls";

interface Props {
  students: StudentRecord[];
  currentId: string;
  onPick: (id: string) => void;
  onFiles: (f: File[]) => Promise<void>;
  onZip: () => Promise<void>;
  onRemove: () => void;
}

export function Toolbar({ students, currentId, onPick, onFiles, onZip, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [zipping, setZipping] = useState(false);
  const done = students.filter((s) => s.written).length;
  const current = students.find((s) => s.id === currentId);

  return (
    <div className="border-b bg-paper">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-6 py-2.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-56 justify-between">
              <span className="truncate">
                {current ? `${current.name} · ${current.studentNo}` : "选择学生"}
              </span>
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-96 p-0">
            <div className="border-b px-3 py-2 text-xs text-muted-foreground">
              共 {students.length} 份报告 · 已确认 {done} 份
            </div>
            <ul className="max-h-96 overflow-y-auto py-1">
              {students.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(s.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted",
                      s.id === currentId && "bg-muted",
                    )}
                  >
                    <span className={cn("size-4 shrink-0", s.written ? "text-ok" : "text-transparent")}>
                      <Check className="size-4" />
                    </span>
                    <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{s.studentNo}</span>
                    <span className="flex-1 truncate font-medium">{s.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{experimentLabel(s)}</span>
                    <span className="pen-score w-8 shrink-0 text-right">{totalScore(s.items)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        <span className="text-xs text-muted-foreground">
          已确认 {done} / {students.length}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ImportButtons onFiles={onFiles} />
          <Button
            size="sm"
            variant="outline"
            disabled={done === 0 || zipping}
            onClick={async () => {
              setZipping(true);
              try {
                await onZip();
              } finally {
                setZipping(false);
              }
            }}
          >
            {zipping ? <Loader2 className="animate-spin" /> : <Archive />}
            打包下载已确认的批改稿
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove} aria-label="移除这份报告" title="移除这份报告">
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  );
}
