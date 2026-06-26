# Texture attribution

Planet surface maps are **NASA / NOAA / USGS public-domain imagery** and **spacecraft-derived global mosaics**, bundled for same-origin WebGL use in Solar Planets.

## Earth

- **Day** — NASA Blue Marble Next Generation (Natural Earth III / Reto Stöckli, NASA GSFC)
- **Night** — NASA Black Marble / VIIRS city lights (Natural Earth III)
- **Clouds** — NASA Blue Marble 2002 cloud composite (Natural Earth III)

## Sun

- NASA SDO/HMI continuum (`latest_4096_HMIIC.jpg`, snapshot at `npm run textures:download`)

## Rocky worlds

- **Mercury** — Mariner 10 + MESSENGER composite (Steve Albers / NOAA Science On a Sphere)
- **Venus** — Magellan radar (NOAA SOS / USGS)
- **Mars** — USGS Viking colorized global mosaic (NOAA SOS)
- **Moon** — LRO / Clementine USGS global map (NOAA SOS, 8K)

## Gas giants

- **Jupiter** — Cassini ISS global map (Björn Jónsson, from NASA/JPL-Caltech data)
- **Saturn** — Cassini + Voyager global map (Björn Jónsson)
- **Saturn rings** — Alpha ring texture (fallback; Cassini ring model derivative)
- **Uranus** — Voyager 2 cylindrical map (Björn Jónsson / The Planetary Society / NASA JPL-Caltech)
- **Neptune** — Voyager 2 (NOAA SOS)

## Sky

- **Stars** — NASA WISE all-sky mosaic 4K (NOAA SOS), plus procedural twinkle points and shooting stars in the viewer

## Refresh bundled maps

```bash
npm run textures:download
# or force replace:
node scripts/download-textures.mjs --force
```

2K files in this folder remain as offline fallbacks where higher-resolution NASA bundles are unavailable.