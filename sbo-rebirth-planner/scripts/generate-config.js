const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required.');
  process.exit(1);
}

const configContent = `// AI Advisor config - generated during build.
window.SBO_AI_CONFIG = {
  supabaseUrl: "${supabaseUrl}",
  anonKey: "${anonKey}"
};
`;

const configPath = path.join(__dirname, '..', 'config.js');
fs.writeFileSync(configPath, configContent);
console.log('Successfully generated config.js from environment variables.');
