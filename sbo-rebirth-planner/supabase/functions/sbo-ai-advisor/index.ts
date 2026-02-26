// SBO:Rebirth Build Planner - AI Advisor Edge Function
// Proxies to Hugging Face Inference API with SBO:R knowledge and build context.

const HF_API_URL = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct/v1/chat/completions";
const HF_MODEL = "Qwen/Qwen2.5-7B-Instruct";
const MAX_TOKENS = 512;
const TEMPERATURE = 0.6;
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

const SBO_SYSTEM_PROMPT = `You are an expert advisor for Sword Blox Online: Rebirth (SBO:R), a Roblox RPG. You help players optimize their build using the SBO:Rebirth Build Planner.

## Core game mechanics (verified from SBO:R Wiki)

**Stats (3 points per level, cap 500 each):**
- STR: +0.4% damage per point (max +200% at 500). Adds +10 Stamina at 500. Boosts crit damage: STRmulti = STR/500 * 2 (0-2). Increases multi-hit chance.
- DEF: Base multiplier * 5 (5 DR per Defense). Each DEF point adds +0.01; at 500 DEF multiplier = * 10.
- AGI: Attack speed, movement speed, lower skill cooldowns. +10 Stamina at 500. Per-weapon max speed gain: 2H/1H 30%, Rapier 60%, Dagger 30%, Dual 50%, Melee 50%.
- VIT: DEX multiplier base 10, +0.01/point (* 15 at 500). +10 Stamina at 500. +0.01% debuff resistance/point (max +5%).
- LUK: +0.01% crit chance/point (base 15%, max 20% at 500). Increases drop chance.

**Gear stats:**
- Attack (weapons): 1 ATK = 1 base damage before STR scaling.
- Defense (armor/shield): DR = Defense * (5 + DEF * 0.01).
- Dexterity (armor/headwear): HP = DEX * (10 + VIT * 0.01). Not dodge - bonus HP only.

**Other:**
- Stamina: 100 + (Level * 5). STR/AGI/VIT max add +10 each.
- Multi-hit: 50% base. STR/LUK add up to +10% each, combined cap +15% -> 65% total. Requires 200+ Sword Skill (except 2H).
- Crit: 15% base, +5% from LUK. Crit damage = (base * critMulti) + (base * STRmulti). Crit multipliers: 2H * 1.5, 1H * 2, Rapier * 2.4, Dagger * 2.7, Dual * 2, Melee * 3.

**Source quality (item scoring):** shop 1.0, mob 1.1, boss 1.2, dungeon 1.24, crafted 1.28, quest 1.16, event 1.22, badge 1.24, gamepass 1.26.

**Slots:** weapon, armor, upper, lower, shield. Dual Wield uses 1H pool + Dual Blades passive at skill 200.

**Boss readiness checks:** DPS (hits to kill <= 800 ready), Survivability (effective HP vs boss ATK), Level, Weapon Skill, Status Effect resistance (VIT for Poison/Freeze/Burn).

## Your role

- Answer questions about stat allocation, gear choices, and boss readiness.
- When build context is provided, use it: reference the user's level, stats, weapon class, playstyle, gear totals, and plan summary.
- Explain recommendations in terms of the formulas above.
- Be concise (2-4 sentences usually). Use bullets for lists.
- If asked about a specific item or boss, use the context. If unknown, say so.
- Never invent item stats - only use what's in the context or general knowledge.`;

interface RequestBody {
  message: string;
  buildContext?: {
    level?: number;
    projectedLevel?: number;
    weaponClass?: string;
    playstyle?: string;
    allocationMode?: string;
    weaponSkill?: number;
    maxFloor?: number;
    stats?: { str: number; def: number; agi: number; vit: number; luk: number };
    gear?: { attack: number; defense: number; dexterity: number };
    metrics?: {
      dpsProjection?: number;
      damageReduction?: number;
      bonusHp?: number;
      critChancePct?: number;
      multiHitPct?: number;
    };
    topRecommendations?: Record<string, Array<{ name: string; score?: number }>>;
    planSummary?: string;
    nextBoss?: string;
    readinessAdvice?: string;
  };
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientId(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
}

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientId);
  if (!entry) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now > entry.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_REQUESTS) return false;
  entry.count++;
  return true;
}

function buildContextBlock(ctx?: RequestBody["buildContext"]): string {
  if (!ctx) return "";
  const parts: string[] = ["\n\n## Current build context\n"];
  if (ctx.level != null) parts.push(`- Level: ${ctx.level}${ctx.projectedLevel ? ` -> ${ctx.projectedLevel}` : ""}`);
  if (ctx.weaponClass) parts.push(`- Weapon: ${ctx.weaponClass}`);
  if (ctx.playstyle) parts.push(`- Playstyle: ${ctx.playstyle}`);
  if (ctx.allocationMode) parts.push(`- Allocation: ${ctx.allocationMode}`);
  if (ctx.weaponSkill != null) parts.push(`- Weapon Skill: ${ctx.weaponSkill}`);
  if (ctx.maxFloor != null) parts.push(`- Max Floor: ${ctx.maxFloor}`);
  if (ctx.stats) {
    const s = ctx.stats;
    parts.push(`- Stats: STR ${s.str} DEF ${s.def} AGI ${s.agi} VIT ${s.vit} LUK ${s.luk}`);
  }
  if (ctx.gear) {
    const g = ctx.gear;
    parts.push(`- Gear: ATK ${g.attack} DEF ${g.defense} DEX ${g.dexterity}`);
  }
  if (ctx.metrics) {
    const m = ctx.metrics;
    const mParts: string[] = [];
    if (m.dpsProjection != null) mParts.push(`DPS ${m.dpsProjection}`);
    if (m.damageReduction != null) mParts.push(`DR ${m.damageReduction}`);
    if (m.bonusHp != null) mParts.push(`HP ${m.bonusHp}`);
    if (m.critChancePct != null) mParts.push(`Crit ${m.critChancePct}%`);
    if (mParts.length) parts.push(`- Metrics: ${mParts.join(", ")}`);
  }
  if (ctx.planSummary) parts.push(`- Plan: ${ctx.planSummary}`);
  if (ctx.nextBoss) parts.push(`- Next target boss: ${ctx.nextBoss}`);
  if (ctx.readinessAdvice) parts.push(`- Readiness advice: ${ctx.readinessAdvice}`);
  if (ctx.topRecommendations && Object.keys(ctx.topRecommendations).length > 0) {
    const recs = Object.entries(ctx.topRecommendations)
      .map(([slot, items]) => `${slot}: ${items.slice(0, 2).map(i => i.name).join(", ")}`)
      .join("; ");
    parts.push(`- Top picks: ${recs}`);
  }
  return parts.join("\n");
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const clientId = getClientId(req);
  if (!checkRateLimit(clientId)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const hfToken = Deno.env.get("HUGGINGFACE_TOKEN");
  if (!hfToken) {
    console.error("HUGGINGFACE_TOKEN not set");
    return new Response(
      JSON.stringify({ error: "AI service not configured." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) {
    return new Response(
      JSON.stringify({ error: "Message required (max 2000 chars)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const contextBlock = buildContextBlock(body.buildContext);
  
  const payload = {
    model: HF_MODEL,
    messages: [
      { role: "system", content: SBO_SYSTEM_PROMPT + contextBlock },
      { role: "user", content: message }
    ],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
  };

  try {
    const hfRes = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!hfRes.ok) {
      const errText = await hfRes.text();
      console.error("HF API error:", hfRes.status, errText);
      let userMsg = "AI service temporarily unavailable.";
      if (hfRes.status === 503) {
        userMsg = "AI model is loading. Please try again in 30 seconds.";
      } else if (hfRes.status === 401) {
        userMsg = "AI service auth failed. Check HUGGINGFACE_TOKEN.";
      } else if (hfRes.status === 429) {
        userMsg = "AI rate limit reached. Try again in a minute.";
      }
      return new Response(
        JSON.stringify({ error: userMsg }),
        { status: hfRes.status === 503 ? 503 : 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const hfData = await hfRes.json();
    const reply = hfData.choices?.[0]?.message?.content?.trim() || "I couldn't generate a response. Try rephrasing.";

    return new Response(
      JSON.stringify({ reply }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "An error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
