import { describe, expect, it, vi } from "vitest";
import type { Config } from "../src/config.js";
import { openDb } from "../src/db.js";
import { buildServer } from "../src/server.js";

const config: Config = {
  port: 0,
  databasePath: ":memory:",
  intuit: {
    clientId: "cid",
    clientSecret: "secret",
    redirectUri: "http://localhost:3000/connect/quickbooks/callback",
    environment: "sandbox",
  },
};

// Fake Intuit: token endpoint + query endpoint.
const fakeIntuit = vi.fn(async (input: string | URL | Request) => {
  const url = new URL(input.toString());
  if (url.hostname === "oauth.platform.intuit.com") {
    return Response.json({
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
      x_refresh_token_expires_in: 8_726_400,
      token_type: "bearer",
    });
  }
  if (url.hostname === "sandbox-quickbooks.api.intuit.com") {
    return Response.json({ QueryResponse: { Invoice: [{ Id: "1", DocNumber: "1001" }] } });
  }
  return new Response("unexpected", { status: 500 });
});

describe("QuickBooks connect flow", () => {
  it("redirects to Intuit, accepts the callback, and serves raw invoices", async () => {
    const app = buildServer({ ...config }, openDb(":memory:"), fakeIntuit as typeof fetch);
    app.log.level = "silent";

    const start = await app.inject("/connect/quickbooks");
    expect(start.statusCode).toBe(302);
    const state = new URL(start.headers.location as string).searchParams.get("state");
    expect(state).toMatch(/^[0-9a-f]{32}$/);

    const cb = await app.inject(`/connect/quickbooks/callback?code=c&state=${state}&realmId=9130`);
    expect(cb.statusCode).toBe(302);

    // State is single-use.
    const replay = await app.inject(`/connect/quickbooks/callback?code=c&state=${state}&realmId=9130`);
    expect(replay.statusCode).toBe(400);

    const home = await app.inject("/");
    expect(home.body).toContain("9130");

    const invoices = await app.inject("/dev/quickbooks/9130/invoices");
    expect(invoices.statusCode).toBe(200);
    expect(invoices.json()).toEqual({ QueryResponse: { Invoice: [{ Id: "1", DocNumber: "1001" }] } });

    const queryCall = fakeIntuit.mock.calls.find(([u]) => u.toString().includes("/query"));
    expect(queryCall?.[0].toString()).toContain("/v3/company/9130/query");
    await app.close();
  });

  it("rejects a callback with unknown state", async () => {
    const app = buildServer({ ...config }, openDb(":memory:"), fakeIntuit as typeof fetch);
    app.log.level = "silent";
    const res = await app.inject("/connect/quickbooks/callback?code=c&state=nope&realmId=1");
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
