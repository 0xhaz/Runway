"use client";

/**
 * Casper Wallet connect — direct to the browser extension's injected provider
 * (window.CasperWalletProvider). No SDK dependency, no CDN download, no React
 * internals: robust under React 19 where the CSPR.click React UI crashes.
 *
 * Loaded client-only (see wallet-connect.tsx) since it reads `window`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { shortHash } from "@/lib/format";

interface CasperWalletProviderInstance {
  requestConnection: () => Promise<boolean>;
  getActivePublicKey: () => Promise<string>;
  isConnected: () => Promise<boolean>;
  disconnectFromSite: () => Promise<boolean>;
}

declare global {
  interface Window {
    CasperWalletProvider?: (opts?: { timeout?: number }) => CasperWalletProviderInstance;
    CasperWalletEventTypes?: Record<string, string>;
  }
}

const INSTALL_URL = "https://www.casperwallet.io/download";

export function WalletConnect() {
  const [account, setAccount] = useState<string | null>(null);
  const [installed, setInstalled] = useState<boolean | null>(null); // null = checking
  const providerRef = useRef<CasperWalletProviderInstance | null>(null);

  useEffect(() => {
    const factory = window.CasperWalletProvider;
    if (!factory) {
      setInstalled(false);
      return;
    }
    setInstalled(true);
    const provider = factory();
    providerRef.current = provider;

    // Restore an existing session.
    (async () => {
      try {
        if (await provider.isConnected()) {
          const k = await provider.getActivePublicKey();
          if (k) setAccount(k);
        }
      } catch {
        /* not connected */
      }
    })();

    const evt = window.CasperWalletEventTypes;
    const parseKey = (e: Event) => {
      try {
        const s = JSON.parse((e as CustomEvent).detail);
        return s?.activeKey ?? null;
      } catch {
        return null;
      }
    };
    const onKey = (e: Event) => setAccount(parseKey(e));
    const onGone = () => setAccount(null);

    const listeners: Array<[string, EventListener]> = [];
    if (evt) {
      const add = (type?: string, fn?: EventListener) => {
        if (type && fn) {
          window.addEventListener(type, fn);
          listeners.push([type, fn]);
        }
      };
      add(evt.Connected, onKey);
      add(evt.ActiveKeyChanged, onKey);
      add(evt.Unlocked, onKey);
      add(evt.Disconnected, onGone);
      add(evt.Locked, onGone);
    }
    return () => listeners.forEach(([t, fn]) => window.removeEventListener(t, fn));
  }, []);

  const connect = useCallback(async () => {
    const p = providerRef.current;
    if (!p) {
      window.open(INSTALL_URL, "_blank", "noopener");
      return;
    }
    try {
      if (await p.requestConnection()) setAccount(await p.getActivePublicKey());
    } catch {
      /* user rejected / locked */
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await providerRef.current?.disconnectFromSite();
    } catch {
      /* noop */
    }
    setAccount(null);
  }, []);

  if (installed === false) {
    return (
      <Button variant="outline" onClick={() => window.open(INSTALL_URL, "_blank", "noopener")}>
        Install Casper Wallet
      </Button>
    );
  }
  if (account) {
    return (
      <Button variant="outline" className="font-mono" onClick={disconnect}>
        {shortHash(account, 6, 4)} · disconnect
      </Button>
    );
  }
  return (
    <Button variant="outline" onClick={connect}>
      Connect wallet
    </Button>
  );
}
