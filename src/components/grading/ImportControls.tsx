import { useRef, useState, type ReactNode } from "react";
import { FileUp, FolderUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { filesFromDrop } from "@/hooks/use-reports";

interface Props {
  onFiles: (files: File[]) => Promise<void>;
  size?: "sm" | "default" | "lg";
  variant?: "ink" | "outline" | "pen";
}

export function ImportButtons({ onFiles, size = "sm", variant = "outline" }: Props) {
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const take = async (list: FileList | null, input: HTMLInputElement | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      await onFiles(Array.from(list));
    } finally {
      setBusy(false);
      if (input) input.value = "";
    }
  };

  return (
    <>
      <Button size={size} variant={variant} onClick={() => filesRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <FileUp />}
        选择多份 Word
      </Button>
      <Button size={size} variant="outline" onClick={() => folderRef.current?.click()} disabled={busy}>
        <FolderUp />
        选择文件夹
      </Button>
      <input
        ref={filesRef}
        type="file"
        multiple
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => take(e.target.files, e.currentTarget)}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        {...{ webkitdirectory: "", directory: "" }}
        onChange={(e) => take(e.target.files, e.currentTarget)}
      />
    </>
  );
}

export function DropZone({ onFiles, children }: { onFiles: (files: File[]) => Promise<void>; children: ReactNode }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setOver(false);
        await onFiles(await filesFromDrop(e.dataTransfer));
      }}
      className={over ? "rounded-lg ring-2 ring-pen ring-offset-4 ring-offset-background" : undefined}
    >
      {children}
    </div>
  );
}
