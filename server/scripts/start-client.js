import { fileURLToPath } from "node:url";
import { inspectLocalService, portConflictMessage } from "./local-services.js";

const port = 5173;
const service = await inspectLocalService("client", port);
if (service.state === "running") {
  console.log(`LMS frontend is already running at http://localhost:${port}`);
  console.log("Open that URL. Another frontend instance is not needed.");
} else if (service.state === "occupied") {
  console.error(portConflictMessage("client", port));
  process.exitCode = 1;
} else {
  const { createServer } =
    await import("../../client/node_modules/vite/dist/node/index.js");
  const root = fileURLToPath(new URL("../../client/", import.meta.url));
  let server;
  try {
    server = await createServer({
      root,
      configFile: fileURLToPath(
        new URL("../../client/vite.config.js", import.meta.url),
      ),
    });
    await server.listen();
    server.printUrls();
    console.log("API requests are forwarded to http://127.0.0.1:8000.");
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, async () => {
        await server.close();
        process.exit(0);
      });
  } catch (error) {
    if (server) await server.close();
    console.error(
      error.code === "EADDRINUSE" ||
        /Port 5173 is already in use/.test(error.message)
        ? portConflictMessage("client", port)
        : `Frontend startup failed: ${error.message}`,
    );
    process.exitCode = 1;
  }
}
