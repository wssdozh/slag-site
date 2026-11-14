// @ts-check
import { defineConfig } from 'astro/config';

// Static output only: the site is HTML and a sprinkle of inline script, nothing else. It is
// served by nginx on the same origin as the relay, so `/api/*` calls are same-origin and CORS
// never enters the picture.
export default defineConfig({
  site: 'https://slag.app',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'auto',
  },
});
