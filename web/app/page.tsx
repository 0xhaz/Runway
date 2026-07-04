import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

const EXPLORER = "https://testnet.cspr.live/transaction/";

const LIFECYCLE = [
  { step: "create_proposal", who: "execution agent", hash: "5fb00f0b3448b3e054986e693230806293c09cd7a82652eb7a0e3e3a4f21d852" },
  { step: "approve", who: "treasury agent", hash: "048892e9842cfb693fd4719c865e6b0506e4a22b000aae0a93b614c276608745" },
  { step: "approve", who: "risk agent", hash: "73c36152e14a7838d8f66535831f8d4527d5eaa0133b88eca8978756aa69388b" },
  { step: "execute", who: "release TDAO → pool", hash: "a809afb1b7ffded1ff72a9861549157ec1f315b1dd9f6aa0f454955e6f9d877b" },
  { step: "open_advance", who: "disburse to merchant", hash: "9105bbac46044478bf8a161430e2f70fc2a202e856a6028eec8d87e6d283e0e5" },
  { step: "repay", who: "sweep #1", hash: "67b736ef14ea2c2c8e683844b2d02d2340fbb347bf4f5a8e5fb296af5f3f5809" },
  { step: "repay → Repaid", who: "sweep #2 · auto-close", hash: "b1deced00adcfbd2e1442d20ab3fdba80bc6a25daf184a48d66f413349b56495" },
];

const FLOW = [
  { n: "01", title: "Assess", body: "An agent reconstructs the merchant's x402 revenue from chain data — volume, trend, volatility, payer concentration." },
  { n: "02", title: "Underwrite", body: "The agent emits a structured, auditable advance offer. A deterministic guardrail clamps it to hard limits before anything is signed." },
  { n: "03", title: "Govern", body: "For the DAO pool, a multi-agent council (risk + treasury) deliberates and can veto on-chain. Capital releases only on quorum, no veto." },
  { n: "04", title: "Disburse & self-repay", body: "The contract disburses, then sweeps a fixed % of every future payment to repay — until owed hits zero and the advance auto-closes." },
];

const POOLS = [
  { name: "Runway Prime", asset: "RunwayUSD", band: "Conservative", apy: "~10%", governed: false, tagline: "Runway's own self-funded pool." },
  { name: "Treasury Yield", asset: "TDAO", band: "High-yield", apy: "~23%", governed: true, tagline: "Funded & governed by the multi-agent DAO." },
];

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto w-full max-w-5xl px-6 ${className}`}>{children}</section>;
}

export default function Landing() {
  return (
    <main className="flex flex-col">
      {/* Hero */}
      <Section className="pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
        <div className="mx-auto flex max-w-3xl flex-col items-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live on Casper Testnet
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Finance the agent economy&apos;s suppliers.
          </h1>
          <p className="mt-6 text-balance text-lg text-muted-foreground sm:text-xl">
            Runway is agentic revenue-based financing for x402 API businesses on Casper.
            An AI agent underwrites your on-chain revenue; a multi-agent DAO governs the
            capital; smart contracts disburse and auto-repay. <span className="text-foreground">The revenue is the collateral.</span>
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
              Launch the app →
            </Link>
            <a
              href={`${EXPLORER}${LIFECYCLE[4].hash}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              See it on-chain
            </a>
          </div>
          <p className="mt-5 font-mono text-xs text-muted-foreground">
            the agent reasons · the protocol decides · the contract enforces
          </p>
        </div>
      </Section>

      {/* Problem / thesis */}
      <div className="border-y bg-muted/30">
        <Section className="py-14">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">The x402 economy earns real revenue. It just isn&apos;t financeable — yet.</h2>
            </div>
            <div className="space-y-4 text-muted-foreground">
              <p>
                x402 APIs earn a stream of tiny, per-request, on-chain payments from autonomous
                agents — real, continuous, and cryptographically verifiable. But a developer
                running a profitable x402 API can&apos;t borrow against next month&apos;s requests to buy
                more GPU today.
              </p>
              <p className="text-foreground">
                Runway makes that revenue financeable, agent-native — and because both revenue
                and repayment happen on-chain in the same asset, the whole loop is trust-minimized.
              </p>
            </div>
          </div>
        </Section>
      </div>

      {/* How it works */}
      <Section className="py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((f) => (
            <div key={f.n} className="rounded-xl border bg-card p-5">
              <div className="font-mono text-sm text-muted-foreground">{f.n}</div>
              <div className="mt-2 text-lg font-medium">{f.title}</div>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Two agent layers */}
      <div className="border-y bg-muted/30">
        <Section className="py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-4">Two stacked agent layers</Badge>
            <h2 className="text-2xl font-semibold tracking-tight">
              An AI proposes. An AI council governs. The chain settles.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Runway&apos;s underwriter recommends an advance. For the Treasury pool, a multi-agent
              DAO — a <span className="text-foreground">risk agent</span> and a{" "}
              <span className="text-foreground">treasury agent</span> — deliberates and can hard-veto
              on-chain. Funds release only when approvals ≥ threshold and no agent vetoes. The same
              merchant Prime would fund, the DAO can refuse.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 font-mono text-xs">
            {["underwriter proposes", "risk + treasury deliberate", "quorum & no veto", "execute → fund", "contract enforces"].map((s, i, a) => (
              <span key={s} className="flex items-center gap-3">
                <span className="rounded-md border bg-background px-3 py-1.5">{s}</span>
                {i < a.length - 1 && <span className="text-muted-foreground">→</span>}
              </span>
            ))}
          </div>
        </Section>
      </div>

      {/* Two pools */}
      <Section className="py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight">Two pools, two risk appetites</h2>
        <p className="mt-3 text-center text-muted-foreground">
          The same agent offer, clamped to each pool&apos;s policy — different terms, different APY.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {POOLS.map((p) => (
            <div key={p.name} className={`rounded-xl border p-6 ${p.governed ? "border-primary/40" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="text-lg font-medium">{p.name}</div>
                <div className="flex gap-1.5">
                  {p.governed && <Badge>DAO-governed</Badge>}
                  <Badge variant="outline">{p.band}</Badge>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-mono text-4xl font-semibold tabular-nums">{p.apy}</span>
                <span className="text-xs text-muted-foreground">target APY · {p.asset}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* On-chain proof */}
      <div className="border-y bg-muted/30">
        <Section className="py-16">
          <div className="text-center">
            <Badge variant="outline" className="mb-4">Proven end-to-end</Badge>
            <h2 className="text-2xl font-semibold tracking-tight">One agent-governed advance, fully on-chain</h2>
            <p className="mt-3 text-muted-foreground">
              50 TDAO moved treasury → pool → merchant, then swept back as principal + spread until
              <code className="mx-1 rounded bg-background px-1 text-xs">owed</code> hit zero.
            </p>
          </div>
          <ol className="mx-auto mt-8 max-w-2xl space-y-1">
            {LIFECYCLE.map((t, i) => (
              <li key={t.hash}>
                <a
                  href={`${EXPLORER}${t.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 rounded-md border bg-card px-4 py-2.5 text-sm transition hover:border-primary/50"
                >
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-medium">{t.step}</span>
                    <span className="text-muted-foreground">· {t.who}</span>
                  </span>
                  <span className="font-mono text-xs text-primary">{t.hash.slice(0, 10)}…</span>
                </a>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      {/* CTA */}
      <Section className="py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Runway finances the suppliers of the agent economy.</h2>
        <p className="mt-3 text-muted-foreground">And the revenue underwrites itself.</p>
        <div className="mt-8">
          <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
            Launch the app →
          </Link>
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>Built on</span>
          <span className="font-medium text-foreground">Odra</span>
          <span className="font-medium text-foreground">CSPR.cloud</span>
          <span className="font-medium text-foreground">casper-js-sdk</span>
          <span className="font-medium text-foreground">x402</span>
          <span className="font-medium text-foreground">Next.js 16</span>
        </div>
      </Section>
    </main>
  );
}
