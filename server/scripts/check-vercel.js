import fs from "node:fs/promises";
import { MAX_ATTACHMENT_BYTES } from "../src/limits.js";

const root = new URL("../../", import.meta.url);
try {
  const config = JSON.parse(
    await fs.readFile(new URL("vercel.json", root), "utf8"),
  );
  if (
    config.outputDirectory !== "client/dist" ||
    config.rewrites[0]?.source !== "/api/:path*" ||
    config.rewrites[0]?.destination !== "/api" ||
    config.rewrites[1]?.destination !== "/index.html"
  )
    throw new Error(
      "Unexpected Vercel routing or output directory. Use the repository-root configuration.",
    );
  await fs.access(new URL("api/index.js", root));
  if (!config.installCommand.includes("npm --prefix client ci --include=dev"))
    throw new Error(
      "The production installation must include client build dependencies such as Vite.",
    );
  if (MAX_ATTACHMENT_BYTES !== 3 * 1024 * 1024)
    throw new Error(
      "Attachment limit must remain below the platform payload limit.",
    );
  for (const path of ["client/vercel.json", "server/vercel.json"]) {
    try {
      await fs.access(new URL(path, root));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    throw new Error(
      `Remove obsolete ${path}; deploy the single project from the repository root.`,
    );
  }
  console.log(
    "Vercel setup checked: repository root, client/dist, shared Express function, API-first routing, and 3 MB attachments.",
  );
  console.log(
    "Set Root Directory to . in Vercel. Add private database/auth variables there. No local server or Render service is needed.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
