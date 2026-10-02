import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { buildServer } from "./server.js";

const config = loadConfig();
const db = openDb(config.databasePath);
const app = buildServer(config, db);

// Bind to localhost only: the dev routes expose raw supplier data with no auth.
await app.listen({ host: "127.0.0.1", port: config.port });
