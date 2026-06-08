"use client";
import type { TxResult } from "@/lib/execute/types.js";

interface TxStatusOverlayProps {
  isPending: boolean;
  result: TxResult | null;
  onDismiss: () => void;
}

/**
 * Full-screen overlay showing transaction status.
 * Pending → spinner; success → checkmark + digest; failed/rejected → friendly message.
 */
export function TxStatusOverlay({ isPending, result, onDismiss }: TxStatusOverlayProps) {
  if (!isPending && !result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-zinc-900 border border-zinc-800 p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
        {isPending && (
          <>
            <div className="h-12 w-12 rounded-full border-4 border-zinc-700 border-t-blue-500 animate-spin" />
            <p className="text-zinc-200 font-medium">Đang xử lý...</p>
            <p className="text-zinc-500 text-sm">Vui lòng xác nhận trong ví của bạn</p>
          </>
        )}

        {!isPending && result?.status === "success" && (
          <>
            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-zinc-200 font-medium">Giao dịch thành công!</p>
            {result.digest && (
              <a
                href={`https://suiscan.xyz/testnet/tx/${result.digest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Xem trên explorer
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            <button onClick={onDismiss} className="btn-primary mt-2 rounded-full px-6 py-2 text-sm font-medium text-white transition-all">
              Đóng
            </button>
          </>
        )}

        {!isPending && result?.status === "rejected" && (
          <>
            <div className="h-12 w-12 rounded-full bg-zinc-700 flex items-center justify-center">
              <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-zinc-200 font-medium">Bạn đã hủy giao dịch</p>
            <button onClick={onDismiss} className="mt-2 rounded-full bg-zinc-800 px-5 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">
              Quay lại
            </button>
          </>
        )}

        {!isPending && result?.status === "failed" && (
          <>
            <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
              </svg>
            </div>
            <p className="text-zinc-200 font-medium">Giao dịch thất bại</p>
            <p className="text-zinc-500 text-sm">{result.error ?? "Vui lòng thử lại"}</p>
            <button onClick={onDismiss} className="mt-2 rounded-full bg-zinc-800 px-5 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">
              Thử lại
            </button>
          </>
        )}
      </div>
    </div>
  );
}
