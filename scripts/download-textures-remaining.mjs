#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'textures');
const UA = 'solar-planets/1.0 (github.com/DaCameraGirl/solar-planets; educational)';
const WAIT_MS = 90000;

const REMAINING = [
  ['8k_venus_surface.jpg', 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Solarsystemscope_texture_8k_venus_surface.jpg'],
  ['8k_mars.jpg', 'https://upload.wikimedia.org/wikipedia/commons/7/70/Solarsystemscope_texture_8k_mars.jpg'],
  ['8k_jupiter.jpg', 'https://upload.wikimedia.org/wikipedia/commons/5/5e/Solarsystemscope_texture_8k_jupiter.jpg'],
  ['8k_saturn.jpg', 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Solarsystemscope_texture_8k_saturn.jpg'],
  ['8k_saturn_ring_alpha.png', 'https://upload.wikimedia.org/wikipedia/commons/2/29/Solarsystemscope_texture_8k_saturn_ring_alpha.png'],
  ['8k_moon.jpg', 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Solarsystemscope_texture_8k_moon.jpg'],
  ['4k_uranus.jpg', 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Solarsystemscope_texture_2k_uranus.jpg'],
  ['8k_stars_milky_way.jpg', 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Solarsystemscope_texture_2k_stars_milky_way.jpg']
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [name, url] of REMAINING) {
  const dest = path.join(OUT, name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 50000) {
    console.log('SKIP', name);
    continue;
  }
  console.log('GET', name, '...');
  let ok = false;
  for (let i = 1; i <= 8; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429) {
      console.log('  rate limited, wait', WAIT_MS / 1000, 's');
      await sleep(WAIT_MS);
      continue;
    }
    if (!res.ok) {
      console.error('  HTTP', res.status);
      break;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log('  OK', (buf.length / 1024 / 1024).toFixed(2), 'MB');
    ok = true;
    break;
  }
  if (!ok) console.error('FAIL', name);
  await sleep(WAIT_MS);
}