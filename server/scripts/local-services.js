// Probe only the explicit local port. Never stop a process to claim its port.
export async function inspectLocalService(kind, port) {
  const url = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(kind === "api" ? `${url}/api/health` : url, {
      signal: AbortSignal.timeout(2500),
    });
    if (kind === "api") {
      const data = await response.json().catch(() => null);
      if (
        response.ok &&
        data?.status === "ok" &&
        data?.database === "connected"
      ) {
        return { state: "running", url, database: data.databaseName };
      }
    } else {
      const html = await response.text();
      if (
        response.ok &&
        html.includes("/@vite/client") &&
        html.includes("/src/main.jsx") &&
        /<title>\s*(?:Knowhere to Grow|Classroom)\b/i.test(html)
      ) {
        return { state: "running", url };
      }
    }
    return { state: "occupied", url };
  } catch (error) {
    if (error.cause?.code === "ECONNREFUSED")
      return { state: "available", url };
    return { state: "occupied", url };
  }
}

export function portConflictMessage(kind, port) {
  return `Port ${port} is in use, but a healthy LMS ${kind === "api" ? "API" : "frontend"} could not be confirmed. Stop the previous process in its terminal with Ctrl+C, then retry. No process was stopped automatically.`;
}
