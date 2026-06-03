"use client";
// Global error boundary — catches unhandled errors anywhere in the app tree.
// Next.js App Router uses error.tsx as the error boundary component.
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to console in dev; could send to error tracking in prod
    console.error("[Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center">
        <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">Đã xảy ra lỗi</h2>
        <p className="mt-2 text-zinc-400 text-sm max-w-sm">
          Ứng dụng gặp sự cố không mong muốn. Vui lòng thử lại.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
      >
        Thử lại
      </button>
    </div>
  );
}
