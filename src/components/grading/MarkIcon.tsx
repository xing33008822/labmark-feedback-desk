import type { Mark } from "@/lib/grading";

/** Hand-drawn style grading marks: check, half check (check with a slash), cross. */
export function MarkIcon({ mark, className = "size-6" }: { mark: Mark; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {mark === "cross" ? (
        <>
          <path d="M6 6.5 18 17.5" />
          <path d="M17.5 6 6.5 18" />
        </>
      ) : (
        <path d="M4.5 12.5 9.5 18 19.5 5" />
      )}
      {mark === "half" && <path d="M12.5 9.5 17 14" />}
    </svg>
  );
}
