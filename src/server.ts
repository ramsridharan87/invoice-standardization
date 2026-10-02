import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.js";
import { ConnectionStore } from "./connectors/quickbooks/connections.js";
import { quickbooksRoutes } from "./connectors/quickbooks/routes.js";
import type { Db } from "./db.js";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function buildServer(config: Config, db: Db, fetchImpl: typeof fetch = fetch): FastifyInstance {
  const app = Fastify({ logger: { level: "info" } });
  const connections = new ConnectionStore(db);

  app.register(quickbooksRoutes, { config, connections, fetchImpl });

  // Minimal dev landing page: connect button + list of connected QBO companies.
  app.get("/", async (_req, reply) => {
    const rows = connections
      .list()
      .map((c) => {
        const id = escapeHtml(c.realmId);
        const expires = new Date(c.refreshTokenExpiresAt).toISOString().slice(0, 10);
        return `<li>Realm <code>${id}</code> — <a href="/dev/quickbooks/${id}/invoices">raw invoices</a>
          <small>(refresh token valid until ${expires})</small></li>`;
      })
      .join("");
    return reply.type("text/html").send(`<!doctype html><title>Invoice Connector (dev)</title>
      <h1>Invoice Connector — dev</h1>
      <p>Environment: <strong>${escapeHtml(config.intuit.environment)}</strong></p>
      <p><a href="/connect/quickbooks">Connect to QuickBooks</a></p>
      <h2>Connections</h2>${rows ? `<ul>${rows}</ul>` : "<p>None yet.</p>"}`);
  });

  return app;
}
