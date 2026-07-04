/**
 * Persistent on-chain footer — links the deployed contracts to the Casper block
 * explorer (testnet.cspr.live), so the live proof is always one click from the app.
 */
const EXPLORER = "https://testnet.cspr.live/contract-package/";

const CONTRACTS: { label: string; hash: string }[] = [
  { label: "Runway Prime", hash: "003f011a793cf21a859aae15cfff7f298b91dcbac57f33b5f9b7177eca7eac65" },
  { label: "Treasury Yield", hash: "5004c89791aeacc3e8c43175058638b7a4c4fc5f7c1543c524a6bc2b84d433a1" },
  { label: "TreasuryDAO", hash: "af05d310be13a0797a0baae39d9b9bd663d013815b472f46b9f3e0fe2fc9a4d1" },
  { label: "RunwayUSD", hash: "c1e2015007e75f92b970fb4b877da153d5ecb365e7a5f401492290cc06f99cd8" },
];

export function OnchainFooter() {
  return (
    <footer className="mt-12 border-t pt-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Live on Casper Testnet</span>
        {CONTRACTS.map((c) => (
          <a
            key={c.hash}
            href={`${EXPLORER}${c.hash}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono hover:text-foreground"
          >
            {c.label}
            <span className="opacity-60">{c.hash.slice(0, 8)}…↗</span>
          </a>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Opens <span className="font-mono">testnet.cspr.live</span> — the Casper block explorer. Advance
        transactions link there from the Advance tab.
      </p>
    </footer>
  );
}
