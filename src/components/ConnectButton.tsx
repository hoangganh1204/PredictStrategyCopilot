"use client";
import { useCurrentAccount, useDisconnectWallet, ConnectButton as DappKitConnectButton } from "@mysten/dapp-kit";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Wallet connect button.
 * - Not connected: shows dapp-kit ConnectButton (triggers wallet picker modal)
 * - Connected: shows truncated address + disconnect button
 */
export function ConnectButton() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();

  if (!account) {
    return <DappKitConnectButton />;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-mono text-zinc-200">
        {truncateAddress(account.address)}
      </span>
      <button
        onClick={() => disconnect()}
        className="rounded-full bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600 transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
