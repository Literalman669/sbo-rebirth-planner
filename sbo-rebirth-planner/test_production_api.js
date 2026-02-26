/**
 * SBO AI Advisor - Production API Verification Script
 * 
 * This script tests the deployed Supabase Edge Function directly.
 * Usage: node test_production_api.js
 */

const SUPABASE_URL = "https://ejotaqqcqcoljzbbyesd.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqb3RhcXFjcWNvbGp6YmJ5ZXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODg3OTUsImV4cCI6MjA4NzY2NDc5NX0.zpR2s8hGKSH27-JbGgJ2R_SD4zwMy6l3uWnu1FuZ0xo";
const ENDPOINT = `${SUPABASE_URL}/functions/v1/sbo-ai-advisor`;

async function testAdvisor() {
  console.log("--- SBO AI Advisor Production Test ---");
  console.log(`Target: ${ENDPOINT}`);
  
  const payload = {
    message: "I am a level 50 Greatsword user with 200 STR. What should I focus on next?",
    buildContext: {
      level: 50,
      weaponClass: "two-handed",
      stats: { str: 200, def: 50, agi: 50, vit: 50, luk: 0 },
      gear: { attack: 150, defense: 80, dexterity: 400 }
    }
  };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      console.log("\n✅ SUCCESS: Received response from AI Advisor");
      console.log("\nAI Response:");
      console.log("--------------------------------------------------");
      console.log(data.reply);
      console.log("--------------------------------------------------");
    } else {
      console.error(`\n❌ ERROR: ${response.status} ${response.statusText}`);
      console.error("Details:", data.error || data);
      
      if (response.status === 401) {
        console.log("\nTip: Check if the anonKey is correct or if the function requires a service role key (though it should be configured for anon).");
      } else if (response.status === 503) {
        console.log("\nTip: The Hugging Face model is likely loading. Try again in 30-60 seconds.");
      } else if (response.status === 502) {
        console.log("\nTip: The Edge Function failed to communicate with Hugging Face. Check HUGGINGFACE_TOKEN in Supabase secrets.");
      }
    }
  } catch (error) {
    console.error("\n❌ NETWORK ERROR:", error.message);
  }
}

testAdvisor();
