"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Deliberation } from "@/lib/api";

function AgentRow({
  agent,
  position,
  reason,
}: {
  agent: string;
  position: "approve" | "veto";
  reason: string;
}) {
  const veto = position === "veto";
  return (
    <div className="flex gap-3">
      <span
        className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${
          veto ? "bg-destructive" : "bg-emerald-500"
        }`}
      />
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium capitalize">{agent} agent</span>
          <Badge variant={veto ? "destructive" : "outline"} className="text-[10px]">
            {position}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{reason}</p>
      </div>
    </div>
  );
}

export function DeliberationPanel({ deliberation: d }: { deliberation: Deliberation }) {
  const approved = d.decision === "APPROVED";
  return (
    <Card className={approved ? "border-emerald-500/40" : "border-destructive/50"}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">TreasuryDAO deliberation</CardTitle>
        <Badge variant={approved ? "default" : "destructive"}>
          {approved ? `APPROVED ${d.approvals}/${d.threshold}` : "BLOCKED"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          The multi-agent DAO governs the Treasury pool&apos;s capital. Funds release only if
          approvals ≥ threshold AND no veto — enforced on-chain.
        </p>
        <Separator />
        <div className="space-y-3">
          {d.verdicts.map((v) => (
            <AgentRow key={v.agent} agent={v.agent} position={v.position} reason={v.reason} />
          ))}
        </div>
        <Separator />
        <p className={`text-sm font-medium ${approved ? "text-emerald-600" : "text-destructive"}`}>
          {d.reason}
        </p>
      </CardContent>
    </Card>
  );
}
