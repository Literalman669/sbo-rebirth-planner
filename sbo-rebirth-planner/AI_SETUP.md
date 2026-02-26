# AI Advisor Setup (Phase L)

The "Ask about your build" chat panel uses a Supabase Edge Function that proxies to the Hugging Face Inference API. The AI follows a system prompt encoding SBO:R formulas, equipment rules, and boss readiness logic — it is not fine-tuned or RAG; the prompt provides domain knowledge.

## Prerequisites

- Supabase project (see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md))
- Hugging Face account and [access token](https://huggingface.co/settings/tokens)

## 1. Deploy the Edge Function

From the project root:

```bash
cd sbo-rebirth-planner
supabase functions deploy sbo-ai-advisor --no-verify-jwt
```

Set the Hugging Face token as a secret:

```bash
supabase secrets set HUGGINGFACE_TOKEN=hf_xxxxxxxxxxxx
```

> **Note:** `--no-verify-jwt` allows the function to be called without Supabase auth. If you prefer JWT verification, omit it and ensure the frontend sends a valid `Authorization: Bearer <anon_key>` header.

## 2. Configure the Frontend

The planner needs your Supabase URL and anon key to call the Edge Function. Add a script **before** the planner loads:

**Option A — Inline in `index.html`** (for local/dev):

```html
<script>
  window.SBO_AI_CONFIG = {
    supabaseUrl: "https://ejotaqqcqcoljzbbyesd.supabase.co",
    anonKey: "your_supabase_anon_key_here"
  };
</script>
```

**Option B — External config** (recommended for production):

Create `config.js` (add to `.gitignore` if it contains keys):

```javascript
window.SBO_AI_CONFIG = {
  supabaseUrl: "https://ejotaqqcqcoljzbbyesd.supabase.co",
  anonKey: "your_supabase_anon_key_here"
};
```

Then in `index.html` head:

```html
<script src="./config.js"></script>
```

**Option C — Netlify env vars**

For Netlify, set `SBO_AI_ANON_KEY` as an environment variable and inject it at build time if you use a build step, or serve a dynamic config endpoint.

## 3. Verify

1. Open the Build Planner
2. Generate a plan
3. Expand the "Ask about your build" panel (collapsed by default)
4. Ask e.g. "Why was Steel Rapier recommended?" or "How does multi-hit work?"
5. The AI responds with context from your current build and plan

## Context

The planner sends rich build context to the AI:

- **Levels, stats, gear, weapon class, playstyle** — from the form
- **Metrics** — DPS, damage reduction, bonus HP, crit %, multi-hit % (from last plan or fresh `evaluateBuild` when plan is stale)
- **Plan summary** — level allocation when a plan was generated
- **Top recommendations** — gear picks from last plan
- **Next target boss** — computed from boss-data and readiness (e.g. "Illfang (Floor 1)")
- **Readiness advice** — one-line stat focus (e.g. "↑ DEF — damage reduction is the survivability gap here")

When the form is dirty or no plan exists, metrics are computed on the fly so the AI always has current numbers.

## Model

The default model is `HuggingFaceH4/zephyr-7b-beta`, which is solid for instruction-following. Alternatives:

- **SmolLM-1.7B-Instruct** — smaller, faster, good for short Q&A
- **mistralai/Mistral-7B-Instruct-v0.2** — widely used, reliable

To change the model, edit `supabase/functions/sbo-ai-advisor/index.ts` and set `HF_MODEL`.

## Rate Limits

- 20 requests per minute per IP (client-side)
- Hugging Face free tier has its own limits

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "AI service not configured" | Set `HUGGINGFACE_TOKEN` in Supabase secrets |
| "Rate limit exceeded" | Wait 60 seconds between bursts |
| "AI model is loading" | HF cold start; retry in ~30s |
| Setup message in chat | Add `window.SBO_AI_CONFIG` with `supabaseUrl` and `anonKey` |
