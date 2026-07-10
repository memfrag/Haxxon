import { defineConfig } from 'vite';

// base defaults to '/' for local dev; the deploy workflow sets BASE_PATH to
// /<repo-name>/ so assets resolve correctly under a GitHub Pages project subpath.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
});
