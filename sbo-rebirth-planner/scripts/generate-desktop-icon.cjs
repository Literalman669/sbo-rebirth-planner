const { deflateSync } = require("node:zlib");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const assetDir = path.join(rootDir, "desktop", "assets");
const svgPath = path.join(assetDir, "icon.svg");
const icoPath = path.join(assetDir, "icon.ico");

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function blendPixel(buffer, size, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) return;
  const offset = (y * size + x) * 4;
  const srcA = clamp(alpha) * (color[3] / 255);
  const dstA = buffer[offset + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  for (let i = 0; i < 3; i += 1) {
    const dst = buffer[offset + i] / 255;
    const src = color[i] / 255;
    buffer[offset + i] = Math.round(((src * srcA + dst * dstA * (1 - srcA)) / outA) * 255);
  }
  buffer[offset + 3] = Math.round(outA * 255);
}

function roundedRectAlpha(x, y, size, radius) {
  const inset = 2;
  const min = inset;
  const max = size - inset - 1;
  const cx = x < min + radius ? min + radius : x > max - radius ? max - radius : x;
  const cy = y < min + radius ? min + radius : y > max - radius ? max - radius : y;
  const distance = Math.hypot(x - cx, y - cy);
  return clamp(radius + 0.75 - distance);
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function drawLine(buffer, size, start, end, width, color) {
  const radius = width / 2;
  const minX = Math.floor(Math.min(start.x, end.x) - radius - 2);
  const maxX = Math.ceil(Math.max(start.x, end.x) + radius + 2);
  const minY = Math.floor(Math.min(start.y, end.y) - radius - 2);
  const maxY = Math.ceil(Math.max(start.y, end.y) + radius + 2);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = distanceToSegment(x + 0.5, y + 0.5, start.x, start.y, end.x, end.y);
      const alpha = clamp(radius + 0.85 - distance);
      blendPixel(buffer, size, x, y, color, alpha);
    }
  }
}

function createIconPng(size) {
  const buffer = Buffer.alloc(size * size * 4);
  const radius = size * 0.18;
  const top = [31, 83, 96, 255];
  const bottom = [38, 158, 166, 255];
  const border = [168, 230, 216, 255];
  const bladeShadow = [23, 54, 67, 120];
  const blade = [234, 248, 246, 255];
  const bladeEdge = [168, 230, 216, 255];
  const gold = [231, 178, 88, 255];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const alpha = roundedRectAlpha(x + 0.5, y + 0.5, size, radius);
      if (alpha <= 0) continue;
      const t = y / (size - 1);
      const color = [lerp(top[0], bottom[0], t), lerp(top[1], bottom[1], t), lerp(top[2], bottom[2], t), 255];
      blendPixel(buffer, size, x, y, color, alpha);
      const edgeDistance = Math.min(x, y, size - 1 - x, size - 1 - y);
      if (edgeDistance < size * 0.035) {
        blendPixel(buffer, size, x, y, border, alpha * clamp((size * 0.035 - edgeDistance) / (size * 0.035)) * 0.55);
      }
    }
  }

  const p = (x, y) => ({ x: x * size, y: y * size });
  drawLine(buffer, size, p(0.31, 0.78), p(0.47, 0.62), size * 0.095, bladeShadow);
  drawLine(buffer, size, p(0.46, 0.60), p(0.74, 0.29), size * 0.105, bladeShadow);
  drawLine(buffer, size, p(0.31, 0.76), p(0.47, 0.60), size * 0.07, gold);
  drawLine(buffer, size, p(0.38, 0.65), p(0.28, 0.55), size * 0.055, gold);
  drawLine(buffer, size, p(0.43, 0.60), p(0.73, 0.30), size * 0.072, blade);
  drawLine(buffer, size, p(0.46, 0.62), p(0.77, 0.31), size * 0.018, bladeEdge);
  drawLine(buffer, size, p(0.27, 0.81), p(0.34, 0.74), size * 0.052, [88, 49, 38, 255]);

  return encodePng(size, size, buffer);
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.from("\x89PNG\r\n\x1a\n", "binary");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    rgba.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([header, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(scanlines)), pngChunk("IEND", Buffer.alloc(0))]);
}

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="SBO Rebirth Planner icon">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1f5360"/>
      <stop offset="1" stop-color="#269ea6"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#173643" flood-opacity=".38"/>
    </filter>
  </defs>
  <rect x="8" y="8" width="240" height="240" rx="44" fill="url(#bg)"/>
  <rect x="12" y="12" width="232" height="232" rx="40" fill="none" stroke="#a8e6d8" stroke-opacity=".45" stroke-width="7"/>
  <g filter="url(#shadow)" stroke-linecap="round" stroke-linejoin="round">
    <path d="M78 196 116 158" stroke="#e7b258" stroke-width="19"/>
    <path d="M96 166 72 142" stroke="#e7b258" stroke-width="15"/>
    <path d="M111 154 188 75" stroke="#eaf8f6" stroke-width="22"/>
    <path d="M118 161 196 82" stroke="#a8e6d8" stroke-width="5"/>
    <path d="M68 207 86 189" stroke="#583126" stroke-width="14"/>
  </g>
</svg>
`;

mkdirSync(assetDir, { recursive: true });
writeFileSync(svgPath, svg);
const images = [256, 128, 64, 48, 32, 16].map((size) => ({ size, png: createIconPng(size) }));
writeFileSync(icoPath, encodeIco(images));
console.log(`Wrote ${path.relative(rootDir, svgPath)} and ${path.relative(rootDir, icoPath)}`);
