# Deploying the Runway dashboard to Vercel

The app is `/web` (Next.js 16) inside a pnpm monorepo. This deploys in **simulated
signing** mode: **Assess** (indexer → agent → policy) and the **multi-agent DAO
deliberation** run fully live; **Accept** shows the simulated advance lifecycle (no
private key on the server). The real on-chain proof is already recorded and linked
from the app (Proof tab) and README.

## 1. Vercel project settings

| Setting | Value |
|---------|-------|
| Framework | Next.js (auto-detected) |
| **Root Directory** | `web` |
| Include files outside Root Directory | **On** (needed for the `@runway/*` workspace packages) |
| Install / Build | handled by [`web/vercel.json`](web/vercel.json) (`pnpm install` + `next build`) |

> The workspace packages (`@runway/shared|indexer|agent|policy`) ship raw TypeScript
> and are transpiled by `next.config.ts`; that's why "include files outside the root
> directory" must be on.

## 2. Environment variables (Project → Settings → Environment Variables)

**Set these** (plain — they're public contract hashes / URLs):

```
CASPER_NODE_RPC_URL=https://node.testnet.casper.network/rpc
CASPER_NETWORK=casper-test
CSPR_CLOUD_REST_URL=https://api.testnet.cspr.cloud
CSPR_CLOUD_STREAMING_URL=wss://streaming.testnet.cspr.cloud
ASSET_PACKAGE_HASH=hash-c1e2015007e75f92b970fb4b877da153d5ecb365e7a5f401492290cc06f99cd8
TREASURY_TOKEN_PACKAGE_HASH=hash-684ec1e09c375e9633807b579f8bd23d63223a1319b67a796bb27437ddb1379e
RUNWAY_ADVANCE_CONTRACT_HASH=hash-003f011a793cf21a859aae15cfff7f298b91dcbac57f33b5f9b7177eca7eac65
TREASURY_POOL_CONTRACT_HASH=hash-5004c89791aeacc3e8c43175058638b7a4c4fc5f7c1543c524a6bc2b84d433a1
TREASURY_DAO_CONTRACT_HASH=af05d310be13a0797a0baae39d9b9bd663d013815b472f46b9f3e0fe2fc9a4d1
TREASURY_TDAO_BALANCE=1000000000000000
UNDERWRITING_MODEL=claude-opus-4-8
DAO_LIVE=false
```

**Set these as Secrets:**

```
ANTHROPIC_API_KEY=...        # hosted underwriter (else deterministic fallback runs)
CSPR_CLOUD_API_KEY=...       # live revenue indexer
```

**Do NOT set** (these are the file-path secrets that only work locally; leaving them
unset is what keeps Accept in simulated mode):

```
POLICY_SIGNER_SECRET_KEY_PATH   ✗   (serverless has no such file)
DAO_AGENT_KEYS_DIR              ✗   (agent key files aren't in the repo)
MERCHANT_ACCOUNT_HASH           optional — only needed to read a real merchant's
                                    live revenue; otherwise the demo synthesizes it
```

No `NEXT_PUBLIC_*` variables are required — there are no client-side secrets, and the
wallet connects via the browser extension directly.

## 3. Deploy

Push to GitHub, import the repo in Vercel, apply the settings above, add the env vars,
and deploy. The landing page is `/`, the dashboard is `/dashboard`.

## Going further (optional — real signing on Vercel)

To have the deployed server sign a real `open_advance`, the signer key must move from a
file path to an env value: refactor `loadSigner` to read `POLICY_SIGNER_SECRET_KEY`
(PEM contents) instead of a path, then set that secret in Vercel. This puts the
policy-signer private key on Vercel (acceptable for Testnet). Ask and I'll wire it.
