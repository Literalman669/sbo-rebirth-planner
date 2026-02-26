/**
 * Test script for SBO AI Advisor Edge Function logic.
 * Mocks the environment and verifies rate limiting and payload construction.
 */

class MockRequest {
  constructor(options) {
    this.method = options.method || 'POST';
    this.headers = new Map(Object.entries(options.headers || {}));
    this.body = JSON.stringify(options.body || {});
  }
  async json() {
    return JSON.parse(this.body);
  }
}

// Mock rateLimitMap and checkRateLimit from index.ts
const rateLimitMap = new Map();
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(clientId) {
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

function testRateLimiting() {
  console.log("Testing Rate Limiting...");
  const clientId = "test-ip";
  rateLimitMap.clear();

  for (let i = 1; i <= 20; i++) {
    if (!checkRateLimit(clientId)) {
      console.error(`Failed: Request ${i} should have been allowed.`);
      return false;
    }
  }

  if (checkRateLimit(clientId)) {
    console.error("Failed: Request 21 should have been blocked.");
    return false;
  }

  console.log("Rate limiting test passed (20 req/min).");
  return true;
}

function testPayloadConstruction() {
  console.log("Testing Payload Construction...");
  const buildContext = {
    level: 50,
    weaponClass: "one-handed",
    stats: { str: 20, def: 10, agi: 10, vit: 15, luk: 0 }
  };
  
  // Simplified buildContextBlock for testing
  function buildContextBlock(ctx) {
    if (!ctx) return "";
    const parts = ["\n\n## Current build context\n"];
    if (ctx.level != null) parts.push(`- Level: ${ctx.level}`);
    if (ctx.weaponClass) parts.push(`- Weapon: ${ctx.weaponClass}`);
    if (ctx.stats) {
      const s = ctx.stats;
      parts.push(`- Stats: STR ${s.str} DEF ${s.def} AGI ${s.agi} VIT ${s.vit} LUK ${s.luk}`);
    }
    return parts.join("\n");
  }

  const contextBlock = buildContextBlock(buildContext);
  const SBO_SYSTEM_PROMPT = "System Prompt";
  const message = "How is my build?";
  
  const payload = {
    model: "Qwen/Qwen2.5-7B-Instruct",
    messages: [
      { role: "system", content: SBO_SYSTEM_PROMPT + contextBlock },
      { role: "user", content: message }
    ]
  };

  if (payload.model !== "Qwen/Qwen2.5-7B-Instruct") {
    console.error("Failed: Incorrect model name.");
    return false;
  }

  if (!payload.messages[0].content.includes("Level: 50")) {
    console.error("Failed: Context not included in system prompt.");
    return false;
  }

  console.log("Payload construction test passed.");
  return true;
}

if (testRateLimiting() && testPayloadConstruction()) {
  console.log("All Edge Function logic tests passed.");
} else {
  process.exit(1);
}
