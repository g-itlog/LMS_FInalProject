import fs from "node:fs/promises";

// This needs only the public backend URL. Never pass database credentials.
const value = process.argv[2];
try {
  if (!value || process.argv.length !== 3)
    throw new Error(
      "Usage: npm run deploy:configure -- https://YOUR-ACTUAL-BACKEND.onrender.com",
    );
  const backend = new URL(value);
  if (
    backend.protocol !== "https:" ||
    backend.username ||
    backend.password ||
    backend.search ||
    backend.hash ||
    !["", "/", "/api", "/api/"].includes(backend.pathname) ||
    /^(?:localhost|127\.|\[::1\])|YOUR|example\./i.test(backend.hostname)
  )
    throw new Error(
      "Use your actual public HTTPS backend URL, without credentials, query parameters, or a custom path.",
    );
  const template = JSON.parse(
    await fs.readFile(
      new URL("../../client/vercel.json.example", import.meta.url),
      "utf8",
    ),
  );
  template.rewrites[0].destination = `${backend.origin}/api/:path*`;
  await fs.writeFile(
    new URL("../../client/vercel.json", import.meta.url),
    JSON.stringify(template, null, 2) + "\n",
  );
  console.log(
    `Configured client/vercel.json to forward /api to ${backend.origin}.`,
  );
  console.log(
    "Commit and push this file. On Vercel, set Root Directory to client, Framework to Vite, and Output Directory to dist.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
