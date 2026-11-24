import { writeFile } from 'node:fs/promises';

const host = process.env.API_HOST;
if (!host) {
  throw new Error('Render did not provide API_HOST for the frontend build.');
}

await writeFile(
  new URL('./render-config.js', import.meta.url),
  `window.TODO_API_BASE = ${JSON.stringify(`https://${host}/api`)};\n`,
);
