"use client";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppHeader } from "@/components/AppHeader.js";
import { ConnectButton } from "@/components/ConnectButton.js";

const STEPS = [
  {
    icon: "👛",
    title: "Kết nối ví",
    desc: "Liên kết ví Sui testnet của bạn — chỉ mất vài giây.",
  },
  {
    icon: "🎯",
    title: "Chọn chiến lược",
    desc: "Nhập số tiền, xem 3 gợi ý bằng ngôn ngữ dễ hiểu.",
  },
  {
    icon: "💰",
    title: "Vào lệnh & nhận thưởng",
    desc: "Ký một lần. Thắng thì nhận thưởng về tài khoản.",
  },
];

const FEATURES = [
  "Giá BTC & biến động thị trường thật, cập nhật liên tục",
  "Không thuật ngữ khó — đặt giá lên, đứng yên, hay phòng cú sập",
  "Giao dịch thật trên Sui testnet, bạn tự ký bằng ví",
];

export default function HomePage() {
  const account = useCurrentAccount();
  const router = useRouter();

  // Redirect to /play once wallet is connected
  useEffect(() => {
    if (account) router.replace("/play");
  }, [account, router]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-12 px-4 py-12">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 text-center animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-4 py-1.5 text-xs font-medium text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Sui Testnet · DeepBook Predict
          </span>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Dự đoán giá BTC,{" "}
            <span className="text-gradient">đơn giản như đặt cược</span>
          </h1>
          <p className="max-w-md text-lg text-zinc-400">
            Trợ lý chiến lược biến biến động thị trường phức tạp thành vài lựa
            chọn dễ hiểu. Kết nối ví để bắt đầu.
          </p>
          <div className="mt-2">
            <ConnectButton />
          </div>
        </section>

        {/* How it works */}
        <section className="grid w-full gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="card-surface flex flex-col gap-2 rounded-2xl border border-zinc-800 p-5 animate-rise"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{step.icon}</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-400">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-1 font-semibold text-zinc-100">{step.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{step.desc}</p>
            </div>
          ))}
        </section>

        {/* Features */}
        <section className="flex w-full flex-col gap-3 rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-6">
          {FEATURES.map((f) => (
            <div key={f} className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-zinc-300">{f}</span>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
