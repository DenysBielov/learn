import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getDb, closeDb } from "@flashcards/database";
import { apiTokens } from "@flashcards/database/schema";
import { eq, and } from "drizzle-orm";
import { registerDeckTools } from "./tools/decks.js";
import { registerFlashcardTools } from "./tools/flashcards.js";
import { registerQuizTools } from "./tools/quiz.js";
import { registerTagTools } from "./tools/tags.js";
import { registerSearchTools } from "./tools/search.js";
import { registerCourseTools } from "./tools/courses.js";
import { registerFlagTools } from "./tools/flags.js";
import { registerImageTools } from "./tools/images.js";
import { registerLearningMaterialTools } from "./tools/learning-materials.js";
import { registerResources } from "./resources/learning-content-guide.js";
import { registerMaterialTools } from "./tools/materials.js";
import { registerQuizEntityTools } from "./tools/quizzes.js";
import { registerDependencyTools } from "./tools/dependencies.js";
import { registerMaterialLinkTools } from "./tools/material-links.js";
import { registerSessionTools } from "./tools/sessions.js";
import { registerEntityFeedbackTools } from "./tools/entity-feedback.js";

const PORT = parseInt(process.env.PORT || "3001", 10);

function resolveUserFromToken(bearerToken: string): number | null {
  const hash = createHash("sha256").update(bearerToken).digest("hex");
  const db = getDb();
  const row = db.select({ userId: apiTokens.userId }).from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hash), eq(apiTokens.type, "mcp"))).get();
  return row?.userId ?? null;
}

function createMcpServer(userId: number) {
  const server = new McpServer({
    name: "flashcards",
    version: "0.0.1",
  });

  const db = getDb();
  registerDeckTools(server, db, userId);
  registerFlashcardTools(server, db, userId);
  registerQuizTools(server, db, userId);
  registerTagTools(server, db, userId);
  registerSearchTools(server, db, userId);
  registerCourseTools(server, db, userId);
  registerFlagTools(server, db, userId);
  registerImageTools(server, userId);
  registerLearningMaterialTools(server, db, userId);
  registerResources(server);
  registerMaterialTools(server, db, userId);
  registerQuizEntityTools(server, db, userId);
  registerDependencyTools(server, db, userId);
  registerMaterialLinkTools(server, db, userId);
  registerSessionTools(server, db, userId);
  registerEntityFeedbackTools(server, db, userId);

  return server;
}

// Session store: maps sessionId → { transport, server }
const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>();

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname !== "/mcp") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const userId = resolveUserFromToken(token);
  if (!userId) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  console.log(`[MCP] ${req.method} session=${req.headers["mcp-session-id"] ?? "none"} content-type=${req.headers["content-type"]}`);

  // Check for existing session
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    return;
  }

  // New session (initialize request)
  const mcpServer = createMcpServer(userId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableDnsRebindingProtection: process.env.NODE_ENV === "production",
  });

  transport.onclose = () => {
    const sid = (transport as any).sessionId;
    if (sid) sessions.delete(sid);
    mcpServer.close().catch(() => {});
  };

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res);

  // Store session after initialize (transport now has a sessionId)
  const newSessionId = (transport as any).sessionId as string | undefined;
  if (newSessionId) {
    sessions.set(newSessionId, { transport, server: mcpServer });
  }
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`MCP server listening on http://0.0.0.0:${PORT}/mcp`);
});

process.on("SIGINT", () => {
  closeDb();
  httpServer.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDb();
  httpServer.close();
  process.exit(0);
});
