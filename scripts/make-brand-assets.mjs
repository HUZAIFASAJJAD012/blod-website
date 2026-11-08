// Generates public/brand-assets/logo-512.png, apple-icon and public/favicon.ico from the SVG mark.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const svg = (size) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28"><rect x="1" y="1" width="26" height="26" rx="6" fill="#17191E"/><path d="M9 8.5h10M9 14h7M9 19.5h10" stroke="#F7F6F2" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="14" r="1.6" fill="#2254C5"/></svg>`);

await sharp(svg(512)).png().toFile("public/brand-assets/logo-512.png");
await sharp(svg(180)).png().toFile("src/app/apple-icon.png");
const png32 = await sharp(svg(32)).png().toBuffer();
// ICO container with a single embedded 32×32 PNG.
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png32.length, 14); header.writeUInt32LE(22, 18);
writeFileSync("public/favicon.ico", Buffer.concat([header, png32]));
console.log("brand assets written");
