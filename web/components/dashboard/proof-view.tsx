"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { shortHash } from "@/lib/format";

const TX = "https://testnet.cspr.live/transaction/";

type Tag = "approve" | "gate" | "close" | null;
type Layer = "dao" | "runway";

const LIFECYCLE: { step: string; who: string; hash: string; tag: Tag; layer: Layer }[] = [
  { step: "create_proposal", who: "execution agent", hash: "5fb00f0b3448b3e054986e693230806293c09cd7a82652eb7a0e3e3a4f21d852", tag: null, layer: "dao" },
  { step: "approve", who: "treasury agent", hash: "048892e9842cfb693fd4719c865e6b0506e4a22b000aae0a93b614c276608745", tag: "approve", layer: "dao" },
  { step: "approve", who: "risk agent", hash: "73c36152e14a7838d8f66535831f8d4527d5eaa0133b88eca8978756aa69388b", tag: "approve", layer: "dao" },
  { step: "execute", who: "release 50 TDAO → pool", hash: "a809afb1b7ffded1ff72a9861549157ec1f315b1dd9f6aa0f454955e6f9d877b", tag: "gate", layer: "dao" },
  { step: "open_advance", who: "disburse to merchant", hash: "9105bbac46044478bf8a161430e2f70fc2a202e856a6028eec8d87e6d283e0e5", tag: null, layer: "runway" },
  { step: "repay", who: "sweep #1", hash: "67b736ef14ea2c2c8e683844b2d02d2340fbb347bf4f5a8e5fb296af5f3f5809", tag: null, layer: "runway" },
  { step: "repay", who: "sweep #2 · auto-close", hash: "b1deced00adcfbd2e1442d20ab3fdba80bc6a25daf184a48d66f413349b56495", tag: "close", layer: "runway" },
];

const LAYER_LABEL: Record<Layer, string> = { dao: "TreasuryDAO", runway: "RunwayAdvance" };

function TagBadge({ tag }: { tag: Tag }) {
  if (!tag) return null;
  if (tag === "approve")
    return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">approve</Badge>;
  if (tag === "gate") return <Badge variant="default">the gate</Badge>;
  return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">repaid</Badge>;
}

export function ProofView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Badge variant="outline">Proven end-to-end</Badge>
        <span className="text-sm text-muted-foreground">
          One agent-governed advance, cleared live on Casper Testnet.
        </span>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Settlement ledger</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Advance · Treasury Yield pool · TDAO. Every step is a real transaction — click to
              open the explorer.
            </p>
          </div>
          <Badge className="shrink-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            Repaid · owed → 0
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {LIFECYCLE.map((t, i) => (
            <a
              key={t.hash}
              href={`${TX}${t.hash}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-4 border-t px-5 py-3 text-sm transition hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-mono font-medium">{t.step}</span>
                <span className="text-muted-foreground">· {t.who}</span>
                <TagBadge tag={t.tag} />
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`hidden font-mono text-[10px] sm:inline-flex ${
                    t.layer === "dao" ? "border-primary/40 text-primary" : ""
                  }`}
                >
                  {LAYER_LABEL[t.layer]}
                </Badge>
                <span className="font-mono text-xs text-primary">{shortHash(t.hash, 10, 0)}↗</span>
              </div>
            </a>
          ))}
          <Separator />
          <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-4 font-mono text-xs text-muted-foreground">
            <span>
              flow: <span className="text-foreground">DAO treasury → pool → merchant</span>
            </span>
            <span>50 TDAO out</span>
            <span>
              60 TDAO swept back <span className="text-foreground">(principal + 20% spread)</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Two contracts, one advance: steps 1–4 are governance calls to the{" "}
        <span className="text-primary">TreasuryDAO</span> (its <code>execute</code> funds the pool);
        steps 5–7 are financing calls to{" "}
        <span className="font-medium text-foreground">RunwayAdvance</span>, Runway&apos;s own pool
        contract. The hand-off at <code>execute</code> is the integration point. Deployed contracts
        are linked in the footer below.
      </p>
    </div>
  );
}
