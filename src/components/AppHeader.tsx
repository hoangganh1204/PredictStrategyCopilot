"use client";
// Shared sticky header: brand, page tabs, game-account balance, wallet connect.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Logo } from "./Logo.js";
import { BalanceDisplay } from "./BalanceDisplay.js";
import { ConnectButton } from "./ConnectButton.js";

const TABS = [
  { href: "/play", label: "Chơi" },
  { href: "/positions", label: "Vị thế" },
] as const;

export function AppHeader() {
  const account = useCurrentAccount();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/70 bg-zinc-950/70 backdrop-blur-lg">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-5">
          <Link href={account ? "/play" : "/"} className="shrink-0">
            <Logo />
          </Link>

          {account && (
            <nav className="hidden items-center gap-1 sm:flex">
              {TABS.map((tab) => {
                const active = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-zinc-800 text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {account && (
            <span className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5">
              <span className="text-xs text-zinc-500">Số dư</span>
              <BalanceDisplay />
            </span>
          )}
          <ConnectButton />
        </div>
      </div>

      {/* Mobile tabs */}
      {account && (
        <nav className="flex items-center gap-1 border-t border-zinc-800/70 px-4 py-2 sm:hidden">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 rounded-lg py-1.5 text-center text-sm font-medium transition-colors ${
                  active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
