// Intuit OAuth 2.0 (authorization code grant).
// https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

export const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
export const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export const ACCOUNTING_SCOPE = "com.intuit.quickbooks.accounting";

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  accessTokenExpiresAt: number;
  /** epoch ms */
  refreshTokenExpiresAt: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
}

export function buildAuthorizeUrl(client: OAuthClient, state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", client.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ACCOUNTING_SCOPE);
  url.searchParams.set("redirect_uri", client.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export function exchangeCode(
  client: OAuthClient,
  code: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<TokenSet> {
  return requestTokens(
    client,
    { grant_type: "authorization_code", code, redirect_uri: client.redirectUri },
    fetchImpl,
    now,
  );
}

/** Intuit rotates refresh tokens — always persist the refresh token returned here. */
export function refreshTokens(
  client: OAuthClient,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<TokenSet> {
  return requestTokens(
    client,
    { grant_type: "refresh_token", refresh_token: refreshToken },
    fetchImpl,
    now,
  );
}

async function requestTokens(
  client: OAuthClient,
  params: Record<string, string>,
  fetchImpl: typeof fetch,
  now: number,
): Promise<TokenSet> {
  const basic = Buffer.from(`${client.clientId}:${client.clientSecret}`).toString("base64");
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    // Body is an OAuth error object (e.g. {"error":"invalid_grant"}); safe to surface.
    throw new Error(`Intuit token request failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as TokenResponse;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    accessTokenExpiresAt: now + body.expires_in * 1000,
    refreshTokenExpiresAt: now + body.x_refresh_token_expires_in * 1000,
  };
}
