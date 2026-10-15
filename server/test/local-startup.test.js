import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  inspectLocalService,
  portConflictMessage,
} from "../scripts/local-services.js";

async function fixture(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: server.address().port,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}

test("startup recognizes a running API only after a successful database health check", async () => {
  const server = await fixture((req, res) => {
    assert.equal(req.url, "/api/health");
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status: "ok",
        database: "connected",
        databaseName: "classroom_test",
      }),
    );
  });
  try {
    const result = await inspectLocalService("api", server.port);
    assert.equal(result.state, "running");
    assert.equal(result.database, "classroom_test");
  } finally {
    await server.close();
  }
});

test("startup recognizes the Knowhere to Grow Vite frontend", async () => {
  const server = await fixture((req, res) =>
    res.end(
      '<title>Knowhere to Grow | Learning workspace</title><script src="/@vite/client"></script><script src="/src/main.jsx"></script>',
    ),
  );
  try {
    assert.equal(
      (await inspectLocalService("client", server.port)).state,
      "running",
    );
  } finally {
    await server.close();
  }
});

test("startup reports occupied ports without mistaking another app for LMS", async () => {
  const server = await fixture((req, res) => res.end("Another application"));
  try {
    assert.equal(
      (await inspectLocalService("api", server.port)).state,
      "occupied",
    );
    assert.equal(
      (await inspectLocalService("client", server.port)).state,
      "occupied",
    );
    assert.match(portConflictMessage("client", server.port), /Ctrl\+C/);
  } finally {
    await server.close();
  }
});

test("startup identifies a free port as available", async () => {
  const server = await fixture((req, res) => res.end());
  await server.close();
  assert.equal(
    (await inspectLocalService("api", server.port)).state,
    "available",
  );
});
