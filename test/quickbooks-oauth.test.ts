import { describe, expect, it, vi } from "vitest";
import { openDb } from "../src/db.js";
import { ConnectionStore } from "../src/connectors/quickbooks/connections.js";
import {
  ACCOUNTING_SCOPE,
  TOKEN_URL,
  buildAuthorizeUrl,
  exchangeCode,
} from "../src/connectors/quickbooks/oauth.js";

const client = { clientId: "cid", clientSecret: "secret", redirectUri: "http://localhost:3000/cb" };

function tokenResponse(access: string, refresh: string) {
  return new Response(
    JSON.stringify({
      access_token: access,
      refresh_token: refresh,
      expires_in: 3600,
      x_refresh_token_expires_in: 8_726_400,
      token_type: "bearer",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("buildAuthorizeUrl", () => {
  it("includes client, scope, redirect and state", () => {
    const url = new URL(buildAuthorizeUrl(client, "abc"));
    expect(url.origin + url.pathname).toBe("https://appcenter.intuit.com/connect/oauth2");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(ACCOUNTING_SCOPE);
    expect(url.searchParams.get("redirect_uri")).toBe(client.redirectUri);
    expect(url.searchParams.get("state")).toBe("abc");
  });
});

describe("exchangeCode", () => {
  it("posts a basic-auth form request and computes expiries", async () => {
    const fetchMock = vi.fn(async () => tokenResponse("at", "rt"));
    const tokens = await exchangeCode(client, "the-code", fetchMock, 1_000);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TOKEN_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("cid:secret").toString("base64")}`,
    );
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("the-code");
    expect(body.get("redirect_uri")).toBe(client.redirectUri);

    expect(tokens).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      accessTokenExpiresAt: 1_000 + 3_600_000,
      refreshTokenExpiresAt: 1_000 + 8_726_400_000,
    });
  });

  it("throws with Intuit's error body on failure", async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":"invalid_grant"}', { status: 400 }));
    await expect(exchangeCode(client, "bad", fetchMock)).rejects.toThrow(/400.*invalid_grant/);
  });
});

describe("ConnectionStore.getAccessToken", () => {
  const tokens = (exp: number) => ({
    accessToken: "old-at",
    refreshToken: "old-rt",
    accessTokenExpiresAt: exp,
    refreshTokenExpiresAt: exp + 100 * 86_400_000,
  });

  it("returns the stored token while it is fresh", async () => {
    const store = new ConnectionStore(openDb(":memory:"));
    store.save("realm1", tokens(10 * 60_000), 0);
    const fetchMock = vi.fn();
    expect(await store.getAccessToken("realm1", client, fetchMock, 0)).toBe("old-at");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes near expiry and persists the rotated refresh token", async () => {
    const store = new ConnectionStore(openDb(":memory:"));
    store.save("realm1", tokens(2 * 60_000), 0);
    const fetchMock = vi.fn(async () => tokenResponse("new-at", "new-rt"));

    expect(await store.getAccessToken("realm1", client, fetchMock, 0)).toBe("new-at");
    const body = new URLSearchParams((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("old-rt");
    expect(store.get("realm1")?.refreshToken).toBe("new-rt");
  });

  it("errors when the refresh token itself has expired", async () => {
    const store = new ConnectionStore(openDb(":memory:"));
    store.save("realm1", { ...tokens(0), refreshTokenExpiresAt: 0 }, 0);
    await expect(store.getAccessToken("realm1", client, vi.fn(), 1)).rejects.toThrow(/reconnect/);
  });
});
