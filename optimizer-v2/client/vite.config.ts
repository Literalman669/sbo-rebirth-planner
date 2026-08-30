import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export function resolveViteBasePath(environment: NodeJS.ProcessEnv = process.env) {
  return environment.SBO_VITE_BASE_PATH ?? (environment.GITHUB_ACTIONS ? '/sbo-rebirth-planner/' : '/');
}

export default defineConfig({
  plugins: [react()],
  base: resolveViteBasePath(),
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](?:react|react-dom|react-router)/,
              priority: 30,
            },
            {
              name: 'spacetime-vendor',
              test: /node_modules[\\/]spacetimedb/,
              priority: 20,
            },
            {
              name: 'data-vendor',
              test: /node_modules[\\/](?:zod|idb)/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
