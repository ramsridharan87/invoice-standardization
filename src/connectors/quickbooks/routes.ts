import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Config } from "../../config.js";
import { qboQuery } from "./client.js";
import type { ConnectionStore } from "./connections.js";
import { buildAuthorizeUrl, exchangeCode } from "./oauth.js";

const STATE_TTL_MS = 10 * 60 * 1000;

interface Deps {
  config: Config;
  connections: ConnectionStore;
  fetchImpl?: typeof fetch;
}

export async function quickbooksRoutes(app: FastifyInstance, deps: Deps): Promise<void> {
  const { config, connections, fetchImpl = fetch } = deps;
  const oauthClient = config.intuit;
  // CSRF state for in-flight connect attempts. In-memory is fine for a single dev process.
  const pendingStates = new Map<string, number>();

  app.get("/connect/quickbooks", async (_req, reply) => {
    const now = Date.now();
    for (const [s, exp] of pendingStates) if (exp < now) pendingStates.delete(s);
    const state = randomBytes(16).toString("hex");
    pendingStates.set(state, now + STATE_TTL_MS);
    return reply.redirect(buildAuthorizeUrl(oauthClient, state));
  });

  app.get<{
    Querystring: { code?: string; state?: string; realmId?: string; error?: string };
  }>("/connect/quickbooks/callback", async (req, reply) => {
    const { code, state, realmId, error } = req.query;
    if (error) return reply.code(400).send({ error: `Intuit returned error: ${error}` });

    const expiresAt = state ? pendingStates.get(state) : undefined;
    if (!state || !expiresAt || expiresAt < Date.now()) {
      return reply.code(400).send({ error: "Invalid or expired state; start again at /connect/quickbooks" });
    }
    pendingStates.delete(state);
    if (!code || !realmId) return reply.code(400).send({ error: "Missing code or realmId" });

    const tokens = await exchangeCode(oauthClient, code, fetchImpl);
    connections.save(realmId, tokens);
    req.log.info({ realmId }, "QuickBooks connection saved");
    return reply.redirect("/");
  });

  // Dev-only: raw QBO invoice JSON, for milestone 2 (see the raw shape before designing the schema).
  app.get<{ Params: { realmId: string } }>("/dev/quickbooks/:realmId/invoices", async (req) => {
    const { realmId } = req.params;
    const accessToken = await connections.getAccessToken(realmId, oauthClient, fetchImpl);
    return qboQuery(
      config.intuit.environment,
      realmId,
      accessToken,
      "SELECT * FROM Invoice MAXRESULTS 100",
      fetchImpl,
    );
  });
}
