import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const excluded = new Set([
  "node_modules",
  ".git",
  ".tooling",
  ".npm-cache",
  ".cache",
  ".dart_tool",
  "build",
  "dist",
  "backup",
  "test-results",
  "playwright-report",
  ".gradle",
  ".idea",
  "coverage",
  "submission",
  "ephemeral",
]);
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) crc = crcTable[(crc ^ value) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const entries = [];
async function walk(directory) {
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    if (excluded.has(item.name) || item.isSymbolicLink()) continue;
    const full = path.join(directory, item.name);
    if (item.isDirectory()) {
      await walk(full);
      continue;
    }
    if (
      (item.name.startsWith(".env") && item.name !== ".env.example") ||
      item.name.includes("credentials") ||
      ["local.properties", ".flutter-plugins-dependencies"].includes(
        item.name,
      ) ||
      /\.(log|jks|keystore|apk|aab)$/.test(item.name)
    )
      continue;
    entries.push({
      name: path.relative(root, full).replaceAll("\\", "/"),
      data: await fs.readFile(full),
    });
  }
}
await walk(root);
const local = [],
  central = [];
let offset = 0;
for (const item of entries) {
  const name = Buffer.from(item.name);
  const crc = crc32(item.data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(((2026 - 1980) << 9) | (10 << 5) | 15, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(item.data.length, 18);
  header.writeUInt32LE(item.data.length, 22);
  header.writeUInt16LE(name.length, 26);
  local.push(header, name, item.data);
  const record = Buffer.alloc(46);
  record.writeUInt32LE(0x02014b50);
  record.writeUInt16LE(20, 4);
  record.writeUInt16LE(20, 6);
  record.writeUInt16LE(0x800, 8);
  record.writeUInt16LE(((2026 - 1980) << 9) | (10 << 5) | 15, 14);
  record.writeUInt32LE(crc, 16);
  record.writeUInt32LE(item.data.length, 20);
  record.writeUInt32LE(item.data.length, 24);
  record.writeUInt16LE(name.length, 28);
  record.writeUInt32LE(offset, 42);
  central.push(record, name);
  offset += header.length + name.length + item.data.length;
}
const index = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(index.length, 12);
end.writeUInt32LE(offset, 16);
await fs.mkdir(path.join(root, "submission"), { recursive: true });
await fs.writeFile(
  path.join(root, "submission/Knowhere-to-Grow-Source.zip"),
  Buffer.concat([...local, index, end]),
);
console.log(
  `Packaged ${entries.length} source/documentation files. Credentials, dependencies, and runtime caches excluded.`,
);
