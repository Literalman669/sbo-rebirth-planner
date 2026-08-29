import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/sbo-rebirth-planner/' : '/',
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
