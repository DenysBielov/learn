import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getDb, closeDb } from "@flashcards/database";
import { users } from "@flashcards/database/schema";
import { eq } from "drizzle-orm";
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

const PORT = parseInt(process.env.PORT || "3001", 10);

function resolveUserFromToken(bearerToken: string): number | null {
  const hash = createHash("sha256").update(bearerToken).digest("hex");
  const db = getDb();
  const user = db.select({ id: users.id }).from(users)
    .where(eq(users.mcpTokenHash, hash)).get();
  return user?.id ?? null;
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

  return server;
}

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

  const mcpServer = createMcpServer(userId);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableDnsRebindingProtection: true,
    allowedOrigins: ["https://learn.bielov.dev"],
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res);

  res.on("close", () => {
    transport.close().catch(() => {});
    mcpServer.close().catch(() => {});
  });
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
