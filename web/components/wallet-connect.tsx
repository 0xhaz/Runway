"use client";

/**
 * Client-only loader for the CSPR.click wallet widget. The SDK's UI deps aren't
 * SSR-safe under React 19 (they read removed React internals at module load), so we
 * never import them on the server.
 */
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

export const WalletConnect = dynamic(
  () => import("./casper-wallet").then((m) => m.WalletConnect),
  {
    ssr: false,
    loading: () => (
      <Button variant="outline" disabled>
        Connect wallet
      </Button>
    ),
  },
);
