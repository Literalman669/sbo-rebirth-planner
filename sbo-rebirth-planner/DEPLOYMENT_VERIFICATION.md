# SBO AI Advisor - Production Verification Guide

## 1. Netlify Configuration (Frontend)
The `netlify.toml` has been updated to generate `config.js` during the build process. 
**Action Required:** In your Netlify UI (Site Settings > Build & deploy > Environment), set the following variables:
- `SUPABASE_URL`: `https://ejotaqqcqcoljzbbyesd.supabase.co`
- `SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqb3RhcXFjcWNvbGp6YmJ5ZXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwODg3OTUsImV4cCI6MjA4NzY2NDc5NX0.zpR2s8hGKSH27-JbGgJ2R_SD4zwMy6l3uWnu1FuZ0xo`

## 2. Supabase Configuration (Backend)
The Edge Function requires `HUGGINGFACE_TOKEN` to be set in Supabase secrets.
**Action Required:** Run the following command in your terminal (ensure you are logged into Supabase CLI):
```bash
supabase secrets set HUGGINGFACE_TOKEN=your_actual_token_here
```
To verify the `anonKey` matches the deployed project, ensure the `SUPABASE_ANON_KEY` above matches the one provided in your Supabase Project Settings > API.

## 3. Live Test Verification
You can verify the Edge Function is working by running the provided `test_edge_function.js` script or by using the chat panel in the deployed app.

### Manual Verification Steps:
1. Open the deployed Netlify URL.
2. Scroll to the "Ask about your build" panel.
3. Type a message (e.g., "What should I focus on for a level 50 Greatsword build?").
4. If you see a response, the end-to-end flow is working:
   - Frontend -> Supabase Edge Function (Auth & Rate Limit) -> Hugging Face API (Qwen2.5) -> Response.

## 4. Troubleshooting
- **401 Unauthorized:** Check if `HUGGINGFACE_TOKEN` is set correctly in Supabase secrets.
- **503 Service Unavailable:** The Hugging Face model might be loading. Wait 30 seconds and try again.
- **429 Too Many Requests:** You've hit the rate limit (20 req/min). Wait a minute.
