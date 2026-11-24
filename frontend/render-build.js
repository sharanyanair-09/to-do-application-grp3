import { writeFile } from 'node:fs/promises';

const apiBaseUrl = process.env.API_URL;
if (!apiBaseUrl) {
  throw new Error('Render did not provide API_URL for the frontend build.');
}

const apiUrl = `${apiBaseUrl.replace(/\/+$/, '')}/api`;
await writeFile(
  new URL('./render-config.js', import.meta.url),
  `window.TODO_API_BASE = ${JSON.stringify(apiUrl.replace(/\/$/, ''))};\n`,
);
