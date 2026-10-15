import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const children = [
  spawn(process.execPath, ["--watch", "index.js"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("../../client/node_modules/vite/bin/vite.js", import.meta.url),
      ),
    ],
    {
      cwd: fileURLToPath(new URL("../../client/", import.meta.url)),
      stdio: "inherit",
    },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const child of children) child.on("exit", (code) => stop(code || 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
