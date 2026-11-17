import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropZone, ImportButtons } from "./ImportControls";

export function EmptyState({ onFiles, onSample }: { onFiles: (f: File[]) => Promise<void>; onSample: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <DropZone onFiles={onFiles}>
        <div className="paper-sheet flex flex-col items-center gap-6 border-2 border-dashed px-8 py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-pen-soft text-pen">
            <FileText className="size-7" />
          </div>
          <div className="space-y-2">
            <h1 className="font-serif text-2xl font-bold text-ink">导入学生的实验报告</h1>
            <p className="text-sm text-muted-foreground">
              一次选择多份 Word，或直接选择整个文件夹，也可以把文件拖到这里。
              <br />
              学号和姓名从封面表格读取，读不到时按文件名「学号_姓名_操作系统_实验名.docx」识别。
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <ImportButtons onFiles={onFiles} size="lg" variant="pen" />
          </div>
          <div className="w-full border-t pt-5 text-xs text-muted-foreground">
            报告只在这台电脑的浏览器里处理和保存。批改稿另存为新文件，学生交来的原件不改动。
          </div>
        </div>
      </DropZone>
      <div className="mt-6 text-center">
        <Button
          variant="link"
          onClick={async () => {
            setLoading(true);
            try {
              await onSample();
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
        >
          {loading && <Loader2 className="animate-spin" />}
          没有手头的报告？先用 3 份样例报告试一下
        </Button>
      </div>
    </div>
  );
}
