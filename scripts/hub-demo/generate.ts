// Writes scripts/hub-demo/seed.sql and cleanup.sql.
// Usage: npx tsx scripts/hub-demo/generate.ts [--me your-hub-email@example.com]
//   --me  a real hub member (you, after logging in once): also receives a few unread private conversations
import { writeFileSync } from "node:fs";
import { cleanupSql, seedSql } from "./build";

const i = process.argv.indexOf("--me");
const me = i >= 0 ? process.argv[i + 1] : undefined;
if (i >= 0 && (!me || me.startsWith("--") || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(me))) {
  console.error("--me needs a valid email");
  process.exit(1);
}
const dir = new URL(".", import.meta.url);
writeFileSync(new URL("seed.sql", dir), seedSql(me));
writeFileSync(new URL("cleanup.sql", dir), cleanupSql());
console.log(`seed.sql${me ? ` (with conversations for ${me})` : ""} and cleanup.sql written to scripts/hub-demo/`);
