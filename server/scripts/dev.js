import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { inspectLocalService, portConflictMessage } from "./local-services.js";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const apiPort = Number(process.env.PORT) || 8000;
const [api, client] = await Promise.all([
  inspectLocalService("api", apiPort),
  inspectLocalService("client", 5173),
]);
if (api.state === "occupied" || client.state === "occupied") {
  if (api.state === "occupied")
    console.error(portConflictMessage("api", apiPort));
  if (client.state === "occupied")
    console.error(portConflictMessage("client", 5173));
  process.exit(1);
}
const children = [];
if (api.state === "running")
  console.log(
    `LMS API is already running at http://localhost:${apiPort}; MongoDB is connected.`,
  );
else
  children.push(
    spawn(process.execPath, ["--watch", "index.js"], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      stdio: "inherit",
      windowsHide: true,
    }),
  );
if (client.state === "running")
  console.log("LMS frontend is already running at http://localhost:5173");
else
  children.push(
    spawn(
      process.execPath,
      [fileURLToPath(new URL("start-client.js", import.meta.url))],
      {
        cwd: fileURLToPath(new URL("../../client/", import.meta.url)),
        stdio: "inherit",
        windowsHide: true,
      },
    ),
  );
if (!children.length)
  console.log(
    "Both services are ready. Open http://localhost:5173. No duplicate processes were started.",
  );
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32")
      spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    else child.kill();
  }
  process.exitCode = code;
}
for (const child of children) child.on("exit", (code) => stop(code || 0));
for (const child of children)
  child.on("error", (error) => {
    console.error(
      `Development process could not start (${error.code || error.name}).`,
    );
    stop(1);
  });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
