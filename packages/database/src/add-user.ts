import { getDb, closeDb } from "./index.js";
import { users } from "./schema.js";
import bcrypt from "bcrypt";
import readline from "node:readline/promises";
import { stdin, stdout, env } from "node:process";
import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";

const BCRYPT_ROUNDS = 10;

function generateMcpToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex"); // 256 bits
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

async function main() {
  const args = process.argv.slice(2);

  // Handle --generate-mcp-token flag (for existing users)
  if (args.includes("--generate-mcp-token")) {
    let email = "";
    const emailIdx = args.indexOf("--email");
    if (emailIdx !== -1 && args[emailIdx + 1]) {
      email = args[emailIdx + 1];
    }
    if (!email) {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      email = await rl.question("Email: ");
      rl.close();
    }
    if (!email) {
      console.error("Email is required");
      process.exit(1);
    }

    const db = getDb();
    try {
      const user = db.select({ id: users.id }).from(users)
        .where(eq(users.email, email)).get();
      if (!user) {
        console.error(`User "${email}" not found`);
        process.exit(1);
      }

      const { token, hash } = generateMcpToken();
      db.update(users).set({ mcpTokenHash: hash })
        .where(eq(users.id, user.id)).run();

      console.log(`\nMCP token for ${email} (save this — it will not be shown again):`);
      console.log(token);
      console.log(`\nConfigure your MCP client with this Bearer token.`);
    } finally {
      closeDb();
    }
    return;
  }

  // Normal user creation flow
  let email = "";
  let password = "";

  const emailIdx = args.indexOf("--email");
  if (emailIdx !== -1 && args[emailIdx + 1]) {
    email = args[emailIdx + 1];
  }

  if (!email) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    email = await rl.question("Email: ");
    rl.close();
  }

  if (!email) {
    console.error("Email is required");
    process.exit(1);
  }

  password = env.USER_PASSWORD || "";
  if (!password) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    password = await rl.question("Password: ");
    rl.close();
  }

  if (!password) {
    console.error("Password is required");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const { token, hash: mcpTokenHash } = generateMcpToken();

  const db = getDb();
  try {
    db.insert(users).values({ email, passwordHash, mcpTokenHash }).run();
    console.log(`User created: ${email}`);
    console.log(`\nMCP token (save this — it will not be shown again):`);
    console.log(token);
    console.log(`\nConfigure your MCP client with this Bearer token.`);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      console.error(`User with email "${email}" already exists`);
      process.exit(1);
    }
    throw err;
  } finally {
    closeDb();
  }
}

main();
