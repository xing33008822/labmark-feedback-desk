import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { StudentHeader } from "@/components/grading/StudentHeader";
import { AnswerPanel } from "@/components/grading/AnswerPanel";
import { GradingPanel } from "@/components/grading/GradingPanel";
import { COMMENT_PHRASES, STUDENTS } from "@/data/students";
import type { StudentRecord } from "@/lib/grading";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "实验报告批改台" },
      { name: "description", content: "逐个批改学生实验报告：查看作答与截图，打分、勾叉、写评语，写入 Word 并导出 Excel。" },
      { property: "og:title", content: "实验报告批改台" },
      { property: "og:description", content: "查看作答与截图，打分、勾叉、写评语，一键写入 Word、导出 Excel。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GradingDesk,
});

function GradingDesk() {
  const [students, setStudents] = useState<StudentRecord[]>(STUDENTS);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<"word" | "excel" | null>(null);
  const student = students[index];

  const update = (next: StudentRecord) =>
    setStudents((list) => list.map((s) => (s.id === next.id ? next : s)));

  const handleWord = async () => {
    setBusy("word");
    try {
      const { writeWord } = await import("@/lib/exporters");
      await writeWord(student);
      update({ ...student, written: true });
      toast.success(`已写入 Word：${student.name}`);
    } catch (e) {
      console.error(e);
      toast.error("写入 Word 失败，请重试");
    } finally {
      setBusy(null);
    }
  };

  const handleExcel = async () => {
    setBusy("excel");
    try {
      const { exportExcel } = await import("@/lib/exporters");
      await exportExcel(students, student.experimentNo);
      toast.success(`已导出 ${students.length} 位学生的成绩`);
    } catch (e) {
      console.error(e);
      toast.error("导出 Excel 失败，请重试");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen">
      <StudentHeader
        student={student}
        index={index}
        total={students.length}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => setIndex((i) => Math.min(students.length - 1, i + 1))}
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
  );
}
