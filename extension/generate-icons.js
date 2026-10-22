// Draws the extension logo (progress ring + check mark on an amber tile) into icons/*.png.
// No dependencies: renders with signed-distance shapes, 4x4 supersampling, and a minimal PNG encoder.
// Run:  node extension/generate-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZES = [16, 32, 48, 128];
const INK = [29, 35, 48];
const TOP = [255, 217, 59];
const BOTTOM = [240, 150, 11];

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function roundedRectInside(x, y, r) {
  const qx = Math.abs(x - 0.5) - (0.5 - r), qy = Math.abs(y - 0.5) - (0.5 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r <= 0;
}

// Returns [r,g,b,a] (a in 0..1) for a point in unit coordinates, for the given icon size.
function shade(x, y, size) {
  if (!roundedRectInside(x, y, 0.22)) return [0, 0, 0, 0];
  let color = mix(TOP, BOTTOM, (x + y) / 2);
  const small = size <= 32;

  // progress ring (75%), omitted on tiny icons where it would just be noise
  if (!small) {
    const R = 0.31, w = 0.07;
    const d = Math.abs(Math.hypot(x - 0.5, y - 0.5) - R);
    if (d <= w / 2) {
      let ang = Math.atan2(y - 0.5, x - 0.5) + Math.PI / 2; // 0 at top, clockwise
      if (ang < 0) ang += 2 * Math.PI;
      color = ang <= 1.5 * Math.PI ? INK : mix(color, INK, 0.22);
    }
  }

  // check mark
  const pts = small ? [[0.27, 0.52], [0.43, 0.68], [0.74, 0.32]] : [[0.37, 0.505], [0.465, 0.6], [0.635, 0.405]];
  const sw = small ? 0.17 : 0.075;
  const d = Math.min(
    distToSegment(x, y, ...pts[0], ...pts[1]),
    distToSegment(x, y, ...pts[1], ...pts[2])
  );
  if (d <= sw / 2) color = INK;

  return [...color, 1];
}

function render(size) {
  const SS = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = shade((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, size);
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
        }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      if (a > 0) { raw[o] = Math.round(r / a); raw[o + 1] = Math.round(g / a); raw[o + 2] = Math.round(b / a); }
      raw[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return encodePng(size, raw);
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, "icons");
fs.mkdirSync(dir, { recursive: true });
for (const s of SIZES) fs.writeFileSync(path.join(dir, `icon${s}.png`), render(s));
console.log("Wrote icons:", SIZES.join(", "));
