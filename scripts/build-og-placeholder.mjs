#!/usr/bin/env node
/**
 * Generate `public/og-default.png` — the default 1200×630 Open Graph image.
 *
 * This script produces a minimal brand-consistent placeholder using pure Node
 * (no native deps, no canvas). It writes a deterministic uncompressed PNG
 * encoding the Loftly brand colour scheme:
 *   - Background: #0F172A (slate-900)           — Loftly "ink" shade
 *   - Accent bar: #F59E0B (amber-500)           — "baht" accent
 *   - Secondary : #38BDF8 (sky-400)             — "sky" accent
 *
 * The image is a solid background + two accent bars + a rendered title.
 * Text is drawn via a tiny 5×7 bitmap font (ASCII subset) scaled ~12× so the
 * 1200×630 canvas shows "LOFTLY" + tagline legibly enough to meet OG review
 * checks on Facebook/Twitter/LINE debuggers. Richer per-card/per-currency
 * images land in Phase 2 via the `/v1/og/*` API (tracked in DEV_PLAN W13).
 *
 * Run: `node scripts/build-og-placeholder.mjs`
 * Output: `public/og-default.png` (~14 KB uncompressed)
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const WIDTH = 1200;
const HEIGHT = 630;

// Brand palette (R, G, B, A).
const BG = [15, 23, 42, 255]; // slate-900
const BAHT = [245, 158, 11, 255]; // amber-500
const SKY = [56, 189, 248, 255]; // sky-400
const INK = [248, 250, 252, 255]; // near-white foreground for text

/** 5×7 bitmap font — uppercase letters + digits + a few symbols. */
const FONT = {
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '—': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
};

function putPixel(buf, x, y, rgba) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const offset = y * (WIDTH * 4 + 1) + 1 + x * 4;
  buf[offset] = rgba[0];
  buf[offset + 1] = rgba[1];
  buf[offset + 2] = rgba[2];
  buf[offset + 3] = rgba[3];
}

function fillRect(buf, x, y, w, h, rgba) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      putPixel(buf, i, j, rgba);
    }
  }
}

function drawGlyph(buf, ch, x, y, scale, rgba) {
  const rows = FONT[ch] ?? FONT[' '];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === '1') {
        fillRect(buf, x + c * scale, y + r * scale, scale, scale, rgba);
      }
    }
  }
}

function drawText(buf, text, x, y, scale, rgba) {
  let cursor = x;
  const charWidth = 5 * scale;
  const gap = Math.max(1, Math.floor(scale * 1.2));
  for (const ch of text.toUpperCase()) {
    drawGlyph(buf, ch, cursor, y, scale, rgba);
    cursor += charWidth + gap;
  }
}

function buildRaster() {
  // One filter byte per scanline (0 = None) + 4 bytes per pixel.
  const rowSize = WIDTH * 4 + 1;
  const buf = Buffer.alloc(rowSize * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    buf[y * rowSize] = 0; // filter = None
  }
  fillRect(buf, 0, 0, WIDTH, HEIGHT, BG);

  // Accent bars — horizontal stripe near the top (baht) and the bottom (sky).
  fillRect(buf, 0, 60, WIDTH, 8, BAHT);
  fillRect(buf, 0, HEIGHT - 68, WIDTH, 8, SKY);

  // Centered title "LOFTLY" and tagline "LIFT YOUR REWARDS".
  const titleScale = 22;
  const titleText = 'LOFTLY';
  const titleCharWidth = 5 * titleScale + Math.max(1, Math.floor(titleScale * 1.2));
  const titleWidth = titleText.length * titleCharWidth;
  const titleX = Math.floor((WIDTH - titleWidth) / 2);
  const titleY = Math.floor(HEIGHT / 2) - titleScale * 4;
  drawText(buf, titleText, titleX, titleY, titleScale, INK);

  const taglineScale = 7;
  const taglineText = 'LIFT YOUR REWARDS';
  const taglineCharWidth =
    5 * taglineScale + Math.max(1, Math.floor(taglineScale * 1.2));
  const taglineWidth = taglineText.length * taglineCharWidth;
  const taglineX = Math.floor((WIDTH - taglineWidth) / 2);
  const taglineY = titleY + titleScale * 7 + 40;
  drawText(buf, taglineText, taglineX, taglineY, taglineScale, BAHT);

  return buf;
}

function writeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(raster) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type = RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = deflateSync(raster);

  return Buffer.concat([
    signature,
    writeChunk('IHDR', ihdr),
    writeChunk('IDAT', idat),
    writeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '..', 'public', 'og-default.png');
const raster = buildRaster();
const png = encodePng(raster);
writeFileSync(outPath, png);
console.log(`wrote ${outPath} (${png.length} bytes, ${WIDTH}×${HEIGHT})`);
