const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const configPath = path.join(__dirname, '..', 'config.js');

if (!supabaseUrl || !anonKey) {
  console.warn('Warning: SUPABASE_URL and/or SUPABASE_ANON_KEY not set. Skipping config.js generation.');
  console.warn('The AI chat panel will be disabled. Core planner features work without it.');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, '// AI config not available — env vars not set during build.\n');
  }
  process.exit(0);
}

const configContent = `// AI Advisor config - generated during build.
window.SBO_AI_CONFIG = {
  supabaseUrl: "${supabaseUrl}",
  anonKey: "${anonKey}"
};
`;

fs.writeFileSync(configPath, configContent);
console.log('Successfully generated config.js from environment variables.');
