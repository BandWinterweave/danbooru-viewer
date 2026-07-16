import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}

function icon(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const scale = size / 16;
  const radius = 3 * scale;
  const inside = (x, y) => {
    const dx = Math.max(radius - x, 0, x - (size - 1 - radius));
    const dy = Math.max(radius - y, 0, y - (size - 1 - radius));
    return dx * dx + dy * dy <= radius * radius;
  };
  const glyph = (x, y) => {
    const gx = x / scale;
    const gy = y / scale;
    const stem = gx >= 4 && gx <= 6 && gy >= 3 && gy <= 13;
    const top = gx >= 5 && gx <= 9.5 && gy >= 3 && gy <= 5;
    const bottom = gx >= 5 && gx <= 9.5 && gy >= 11 && gy <= 13;
    const bowl = gx >= (gy < 5 || gy > 11 ? 8.5 : 10) && gx <= (gy < 5 || gy > 11 ? 10.5 : 12) && gy >= 4 && gy <= 12;
    return stem || top || bottom || bowl;
  };
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x += 1) {
      const offset = row + 1 + x * 4;
      const color = glyph(x, y) ? [237, 242, 239, 255] : [23, 32, 30, inside(x, y) ? 255 : 0];
      pixels.set(color, offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'binary'), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true });
for (const size of [16, 32, 48, 128]) writeFileSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url), icon(size));
