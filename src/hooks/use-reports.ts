import { useCallback, useEffect, useRef, useState } from "react";
import { blankItems, type StudentRecord } from "@/lib/grading";
import type { StoredReport } from "@/lib/report-store";

export interface LoadedReport {
  buffer: ArrayBuffer;
  record: StudentRecord;
  addedAt: number;
}

const sortKey = (r: LoadedReport) =>
  `${String(r.record.experimentNo ?? 999).padStart(3, "0")}|${r.record.experimentName}|${r.record.studentNo}|${r.record.fileName}`;

async function toLoaded(stored: StoredReport): Promise<LoadedReport> {
  const { parseReport } = await import("@/lib/docx-report");
  const p = await parseReport(stored.buffer, stored.fileName);
  const fresh = blankItems(p.anchors);
  const items = stored.grading
    ? fresh.map((f) => {
        const saved = stored.grading!.items.find((i) => i.id === f.id);
        return saved ? { ...f, score: saved.score, mark: saved.mark } : f;
      })
    : fresh;
  return {
    buffer: stored.buffer,
    addedAt: stored.addedAt,
    record: {
      id: stored.id,
      fileName: stored.fileName,
      name: p.name || "（未识别姓名）",
      studentNo: p.studentNo || "—",
      identitySource: p.identitySource,
      experimentNo: p.experimentNo,
      experimentName: p.experimentName,
      excerpts: p.sections.map((s) => ({ question: s.heading, answer: s.text, code: s.code })),
      screenshots: p.images.map((img) => ({
        src: URL.createObjectURL(new Blob([img.bytes as BlobPart], { type: img.mime })),
        caption: img.caption,
      })),
      items,
      comment: stored.grading?.comment ?? p.existingComment,
      written: stored.grading?.written ?? false,
      warnings: p.warnings,
    },
  };
}

const isDocx = (f: File) => /\.docx$/i.test(f.name) && !f.name.startsWith("~$");

export function useReports() {
  const [reports, setReports] = useState<LoadedReport[]>([]);
  const [ready, setReady] = useState(false);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    (async () => {
      try {
        const { loadReports } = await import("@/lib/report-store");
        const stored = await loadReports();
        const loaded = (await Promise.allSettled(stored.map(toLoaded)))
          .flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
        setReports(loaded.sort((a, b) => sortKey(a).localeCompare(sortKey(b))));
      } catch (e) {
        console.error(e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  /** Returns how many files were read and which ones failed. */
  const importFiles = useCallback(async (files: File[]) => {
    const { saveReport } = await import("@/lib/report-store");
    const docs = files.filter(isDocx);
    const failed: string[] = [];
    const added: LoadedReport[] = [];
    for (const f of docs) {
      const stored: StoredReport = { id: f.name, fileName: f.name, buffer: await f.arrayBuffer(), addedAt: Date.now() };
      try {
        const loaded = await toLoaded(stored);
        await saveReport(stored);
        added.push(loaded);
      } catch (e) {
        console.error(f.name, e);
        failed.push(f.name);
      }
    }
    setReports((list) => {
      const ids = new Set(added.map((a) => a.record.id));
      return [...list.filter((r) => !ids.has(r.record.id)), ...added].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    });
    return { added: added.length, skipped: files.length - docs.length, failed, firstId: added[0]?.record.id };
  }, []);

  const update = useCallback((next: StudentRecord) => {
    setReports((list) => {
      const out = list.map((r) => (r.record.id === next.id ? { ...r, record: next } : r));
      const hit = out.find((r) => r.record.id === next.id);
      if (hit) {
        clearTimeout(saveTimers.current.get(next.id));
        saveTimers.current.set(
          next.id,
          setTimeout(async () => {
            const { saveReport } = await import("@/lib/report-store");
            await saveReport({
              id: next.id,
              fileName: next.fileName,
              buffer: hit.buffer,
              addedAt: hit.addedAt,
              grading: { items: next.items, comment: next.comment, written: next.written },
            });
          }, 300),
        );
      }
      return out;
    });
  }, []);

  const remove = useCallback(async (id: string) => {
    const { deleteReport } = await import("@/lib/report-store");
    await deleteReport(id);
    setReports((list) => list.filter((r) => r.record.id !== id));
  }, []);

  const clear = useCallback(async () => {
    const { clearReports } = await import("@/lib/report-store");
    await clearReports();
    setReports([]);
  }, []);

  return { reports, ready, importFiles, update, remove, clear };
}

/** Collect files from a drop, descending into dropped folders. */
export async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items)
    .map((i) => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return Array.from(dt.files);
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      out.push(await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        for (const e of batch) await walk(e);
      } while (batch.length);
    }
  };
  for (const e of entries) await walk(e);
  return out;
}
