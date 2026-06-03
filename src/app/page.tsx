"use client";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ConnectButton } from "@/components/ConnectButton.js";

export default function HomePage() {
  const account = useCurrentAccount();
  const router = useRouter();

  // Redirect to /play once wallet is connected
  useEffect(() => {
    if (account) router.replace("/play");
  }, [account, router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">
          Predict Strategy Copilot
        </h1>
        <p className="text-zinc-400 text-lg max-w-md">
          Chiến lược dự đoán giá BTC ngắn hạn trên Sui Testnet.
          Kết nối ví để bắt đầu.
        </p>
      </div>
      <ConnectButton />
    </main>
  );
}
