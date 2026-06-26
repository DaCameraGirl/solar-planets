#!/usr/bin/env node
/**
 * Download bundled planet textures (Wikimedia Commons / Solar System Scope, CC BY 4.0).
 * Run: node scripts/download-textures.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'assets', 'textures');
const UA = 'solar-planets/1.0 (github.com/DaCameraGirl/solar-planets; educational)';

const TEXTURES = [
  ['8k_sun.jpg', 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Solarsystemscope_texture_8k_sun.jpg'],
  ['8k_mercury.jpg', 'https://upload.wikimedia.org/wikipedia/commons/2/27/Solarsystemscope_texture_8k_mercury.jpg'],
  ['8k_venus_surface.jpg', 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Solarsystemscope_texture_8k_venus_surface.jpg'],
  ['8k_earth_daymap.jpg', 'https://upload.wikimedia.org/wikipedia/commons/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg'],
  ['8k_earth_nightmap.jpg', 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Solarsystemscope_texture_8k_earth_nightmap.jpg'],
  ['8k_earth_clouds.jpg', 'https://upload.wikimedia.org/wikipedia/commons/7/7a/Solarsystemscope_texture_8k_earth_clouds.jpg'],
  ['8k_mars.jpg', 'https://upload.wikimedia.org/wikipedia/commons/7/70/Solarsystemscope_texture_8k_mars.jpg'],
  ['8k_jupiter.jpg', 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Solarsystemscope_texture_8k_jupiter.jpg'],
  ['8k_saturn.jpg', 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Solarsystemscope_texture_8k_saturn.jpg'],
  ['8k_saturn_ring_alpha.png', 'https://upload.wikimedia.org/wikipedia/commons/2/29/Solarsystemscope_texture_8k_saturn_ring_alpha.png'],
  ['8k_moon.jpg', 'https://upload.wikimedia.org/wikipedia/commons/7/72/Solarsystemscope_texture_8k_moon.jpg'],
  ['4k_uranus.jpg', null],
  ['4k_neptune.jpg', null],
  ['8k_stars_milky_way.jpg', null]
];

const WIKI_NAMES = {
  '4k_uranus.jpg': 'Solarsystemscope_texture_2k_uranus.jpg',
  '4k_neptune.jpg': 'Solarsystemscope_texture_2k_neptune.jpg',
  '8k_stars_milky_way.jpg': 'Solarsystemscope_texture_2k_stars_milky_way.jpg'
};

async function resolveUrl(localName) {
  const title = 'File:' + (WIKI_NAMES[localName] || ('Solarsystemscope_texture_' + localName));
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&titles=' +
    encodeURIComponent(title) + '&prop=imageinfo&iiprop=url&format=json';
  const res = await fetch(api, { headers: { 'User-Agent': UA } });
  const data = await res.json();
  const pages = data.query?.pages || {};
  const page = Object.values(pages)[0];
  return page?.imageinfo?.[0]?.url || null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function download(name, url) {
  const dest = path.join(OUT, name);
  if (fs.existsSync(dest)) {
    const existing = fs.statSync(dest).size;
    if (existing > 50000) {
      console.log('SKIP', name, '(already', (existing / 1024 / 1024).toFixed(2) + ' MB)');
      return;
    }
  }
  let finalUrl = url;
  if (!finalUrl) {
    finalUrl = await resolveUrl(name);
  }
  if (!finalUrl) throw new Error('No URL for ' + name);

  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(finalUrl, { headers: { 'User-Agent': UA } });
    if (res.status === 429) {
      const wait = attempt * 8000;
      console.log('RATE', name, 'wait', wait / 1000 + 's');
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 50000) throw new Error('too small (' + buf.length + ' bytes)');
    fs.writeFileSync(dest, buf);
    console.log('OK', name, (buf.length / 1024 / 1024).toFixed(2) + ' MB');
    return;
  }
  throw new Error('rate limited after retries');
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, url] of TEXTURES) {
  try {
    await download(name, url);
    await sleep(3000);
  } catch (e) {
    console.error('FAIL', name, e.message);
    process.exitCode = 1;
  }
}