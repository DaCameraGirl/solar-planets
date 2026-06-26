#!/usr/bin/env node
/**
 * Download bundled planet textures from NASA, NOAA SOS, USGS, and spacecraft-derived
 * public-domain sources (Cassini, Voyager, Galileo, MRO, MESSENGER, Magellan, SDO).
 *
 * Run: node scripts/download-textures.mjs
 * Force re-download: node scripts/download-textures.mjs --force
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'assets', 'textures');
const UA = 'solar-planets/1.0 (github.com/DaCameraGirl/solar-planets; educational)';
const FORCE = process.argv.includes('--force');

const SOS = 'https://sos.noaa.gov/ftp_mirror/astronomy';
const NE3 = 'https://shadedrelief.com/natural3/ne3_data/8192';

/** @type {{ name: string, url: string, minBytes: number, source: string }[]} */
const TEXTURES = [
  {
    name: '8k_sun.jpg',
    url: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_4096_HMIIC.jpg',
    minBytes: 400000,
    source: 'NASA SDO/HMI continuum (snapshot at download)'
  },
  {
    name: '8k_mercury.jpg',
    url: 'https://stevealbers.net/albers/sos/mercury/mercury/mercury_rgb_cyl_www.jpg',
    minBytes: 2000000,
    source: 'NASA Mariner 10 + MESSENGER (Steve Albers / NOAA SOS)'
  },
  {
    name: '8k_venus_surface.jpg',
    url: `${SOS}/venus/original/4096.jpg`,
    minBytes: 400000,
    source: 'NASA Magellan radar (NOAA SOS / USGS)'
  },
  {
    name: '8k_earth_daymap.jpg',
    url: `${NE3}/textures/2_no_clouds_8k.jpg`,
    minBytes: 2000000,
    source: 'NASA Blue Marble Next Generation (Natural Earth III / NASA GSFC)'
  },
  {
    name: '8k_earth_nightmap.jpg',
    url: `${NE3}/textures/5_night_8k.jpg`,
    minBytes: 1000000,
    source: 'NASA Black Marble / VIIRS night lights (Natural Earth III)'
  },
  {
    name: '8k_earth_clouds.jpg',
    url: `${NE3}/clouds/fair_clouds_8k.jpg`,
    minBytes: 1000000,
    source: 'NASA Blue Marble cloud composite (Natural Earth III)'
  },
  {
    name: '8k_mars.jpg',
    url: `${SOS}/mars/original/4096.jpg`,
    minBytes: 400000,
    source: 'USGS Viking colorized global mosaic (NOAA SOS / MRO lineage)'
  },
  {
    name: '8k_jupiter.jpg',
    url: 'https://bjj.mmedia.is/data/jupiter_css/jupiter_css.jpg',
    minBytes: 800000,
    source: 'NASA Cassini ISS (Björn Jónsson)'
  },
  {
    name: '8k_saturn.jpg',
    url: 'https://bjj.mmedia.is/data/saturn/saturn.jpg',
    minBytes: 400000,
    source: 'NASA Cassini + Voyager (Björn Jónsson)'
  },
  {
    name: '8k_saturn_ring_alpha.png',
    url: 'https://www.solarsystemscope.com/textures/download/8k_saturn_ring_alpha.png',
    minBytes: 20000,
    source: 'Cassini ring model alpha (fallback until bundled NASA ring map)'
  },
  {
    name: '4k_uranus.png',
    url: 'https://planetary.s3.amazonaws.com/web/assets/pictures/20141210_img1_uranus_vgr2_cylmap.png',
    minBytes: 50000,
    source: 'NASA Voyager 2 (Björn Jónsson / Planetary Society)'
  },
  {
    name: '4k_neptune.jpg',
    url: `${SOS}/neptune/2048.jpg`,
    minBytes: 200000,
    source: 'NASA Voyager 2 (NOAA SOS)'
  },
  {
    name: '8k_moon.jpg',
    url: `${SOS}/moon/original/8192.jpg`,
    minBytes: 2000000,
    source: 'NASA LRO / Clementine USGS (NOAA SOS)'
  },
  {
    name: '8k_stars_milky_way.jpg',
    url: `${SOS}/milky_way/all_sky/2048.jpg`,
    minBytes: 200000,
    source: 'Milky Way all-sky survey (NOAA SOS)'
  }
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function download(entry) {
  const dest = path.join(OUT, entry.name);
  if (!FORCE && fs.existsSync(dest)) {
    const existing = fs.statSync(dest).size;
    if (existing >= entry.minBytes) {
      console.log('SKIP', entry.name, `(${(existing / 1024 / 1024).toFixed(2)} MB, ${entry.source})`);
      return;
    }
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(entry.url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (res.status === 429) {
      const wait = attempt * 8000;
      console.log('RATE', entry.name, 'wait', wait / 1000 + 's');
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + entry.url);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < entry.minBytes) {
      throw new Error('too small (' + buf.length + ' bytes, need ' + entry.minBytes + ')');
    }
    fs.writeFileSync(dest, buf);
    console.log('OK', entry.name, (buf.length / 1024 / 1024).toFixed(2) + ' MB', '←', entry.source);
    return;
  }
  throw new Error('rate limited after retries');
}

fs.mkdirSync(OUT, { recursive: true });
console.log(FORCE ? 'Force re-downloading NASA photoreal textures…' : 'Downloading NASA photoreal textures (skip existing)…');
for (const entry of TEXTURES) {
  try {
    await download(entry);
    await sleep(1200);
  } catch (e) {
    console.error('FAIL', entry.name, e.message);
    process.exitCode = 1;
  }
}