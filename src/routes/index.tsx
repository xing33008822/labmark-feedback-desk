import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StudentHeader } from "@/components/grading/StudentHeader";
import { AnswerPanel } from "@/components/grading/AnswerPanel";
import { GradingPanel } from "@/components/grading/GradingPanel";
import { EmptyState } from "@/components/grading/EmptyState";
import { Toolbar } from "@/components/grading/Toolbar";
import { DropZone } from "@/components/grading/ImportControls";
import { COMMENT_PHRASES, SAMPLE_REPORTS } from "@/data/students";
import { useReports } from "@/hooks/use-reports";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "实验报告批改台" },
      {
        name: "description",
        content: "逐份导入学生的 Word 实验报告，复核作答与截图，打分、勾叉、写评语，写出批改稿并导出班级成绩 Excel。",
      },
      { property: "og:title", content: "实验报告批改台" },
      { property: "og:description", content: "导入 Word 实验报告，复核打分，写出带勾叉、评语和成绩的批改稿，导出成绩 Excel。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GradingDesk,
});

function GradingDesk() {
  const { reports, ready, importFiles, update, remove } = useReports();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"word" | "excel" | null>(null);

  const index = Math.max(0, reports.findIndex((r) => r.record.id === currentId));
  const current = reports[index];

  useEffect(() => {
    if (!currentId && reports[0]) setCurrentId(reports[0].record.id);
  }, [reports, currentId]);

  const handleFiles = async (files: File[]) => {
    const res = await importFiles(files);
    if (res.added) {
      toast.success(`已导入 ${res.added} 份报告`);
      if (res.firstId) setCurrentId(res.firstId);
    }
    if (res.failed.length) toast.error(`${res.failed.length} 份无法读取：${res.failed.slice(0, 3).join("、")}`);
    if (!res.added && !res.failed.length) toast.error("没有找到 .docx 文件");
  };

  const loadSamples = async () => {
    const files = await Promise.all(
      SAMPLE_REPORTS.map(async (name) => {
        const blob = await (await fetch(`/samples/${encodeURIComponent(name)}`)).blob();
        return new File([blob], name);
      }),
    );
    await handleFiles(files);
  };

  const handleWord = async () => {
    if (!current) return;
    setBusy("word");
    try {
      const { downloadGradedCopy } = await import("@/lib/exporters");
      const s = current.record;
      const res = await downloadGradedCopy(current.buffer, s);
      update({ ...s, written: true });
      const missing = [
        res.placedMarks.length < s.items.length && `${s.items.length - res.placedMarks.length} 个勾叉`,
        !res.comment && "评语",
        !res.grade && "成绩",
      ].filter(Boolean);
      if (missing.length) toast.warning(`批改稿已写出，但没放进：${missing.join("、")}`);
      else toast.success(`已写出 ${s.name} 的批改稿`);
    } catch (e) {
      console.error(e);
      toast.error("写出批改稿失败，请重试");
    } finally {
      setBusy(null);
    }
  };

  const handleExcel = async () => {
    setBusy("excel");
    try {
      const { exportExcel } = await import("@/lib/exporters");
      await exportExcel(reports.map((r) => r.record));
      toast.success(`已导出 ${reports.length} 份报告的成绩`);
    } catch (e) {
      console.error(e);
      toast.error("导出 Excel 失败，请重试");
    } finally {
      setBusy(null);
    }
  };

  const handleZip = async () => {
    const list = reports.filter((r) => r.record.written).map((r) => ({ buffer: r.buffer, student: r.record }));
    try {
      const { downloadGradedZip } = await import("@/lib/exporters");
      await downloadGradedZip(list);
      toast.success(`已打包 ${list.length} 份批改稿`);
    } catch (e) {
      console.error(e);
      toast.error("打包失败，请重试");
    }
  };

  const handleRemove = async () => {
    if (!current) return;
    if (!window.confirm(`从批改台移除「${current.record.fileName}」？（不会删除你电脑上的文件）`)) return;
    const next = reports[index + 1] ?? reports[index - 1];
    await remove(current.record.id);
    setCurrentId(next?.record.id ?? null);
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> 正在读取已导入的报告…
      </div>
    );
  }

  if (!current) {
    return (
      <main className="min-h-screen">
        <EmptyState onFiles={handleFiles} onSample={loadSamples} />
      </main>
    );
  }

  const student = current.record;
  return (
    <DropZone onFiles={handleFiles}>
      <div className="min-h-screen">
        <StudentHeader
          student={student}
          index={index}
          total={reports.length}
          onPrev={() => setCurrentId(reports[Math.max(0, index - 1)]!.record.id)}
          onNext={() => setCurrentId(reports[Math.min(reports.length - 1, index + 1)]!.record.id)}
        />
        <Toolbar
          students={reports.map((r) => r.record)}
          currentId={student.id}
          onPick={setCurrentId}
          onFiles={handleFiles}
          onZip={handleZip}
          onRemove={handleRemove}
        />
        <main className="mx-auto grid max-w-[1600px] grid-cols-1 items-start gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <AnswerPanel key={student.id} student={student} />
          <GradingPanel
            student={student}
            phrases={COMMENT_PHRASES}
            onChange={update}
            onWriteWord={handleWord}
            onExportExcel={handleExcel}
            busy={busy}
          />
        </main>
      </div>
    </DropZone>
  );
}
