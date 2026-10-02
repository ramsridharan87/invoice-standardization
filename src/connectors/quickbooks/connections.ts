import type { Db } from "../../db.js";
import { refreshTokens, type OAuthClient, type TokenSet } from "./oauth.js";

// Refresh a little before Intuit's 1h access-token expiry so in-flight calls don't race it.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export interface Connection extends TokenSet {
  realmId: string;
  createdAt: number;
  updatedAt: number;
}

interface Row {
  realm_id: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: number;
  refresh_token_expires_at: number;
  created_at: number;
  updated_at: number;
}

function fromRow(row: Row): Connection {
  return {
    realmId: row.realm_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    accessTokenExpiresAt: row.access_token_expires_at,
    refreshTokenExpiresAt: row.refresh_token_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ConnectionStore {
  constructor(private readonly db: Db) {}

  save(realmId: string, tokens: TokenSet, now: number = Date.now()): void {
    this.db
      .prepare(
        `INSERT INTO qbo_connections
           (realm_id, access_token, refresh_token, access_token_expires_at,
            refresh_token_expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (realm_id) DO UPDATE SET
           access_token = excluded.access_token,
           refresh_token = excluded.refresh_token,
           access_token_expires_at = excluded.access_token_expires_at,
           refresh_token_expires_at = excluded.refresh_token_expires_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        realmId,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.accessTokenExpiresAt,
        tokens.refreshTokenExpiresAt,
        now,
        now,
      );
  }

  get(realmId: string): Connection | undefined {
    const row = this.db
      .prepare("SELECT * FROM qbo_connections WHERE realm_id = ?")
      .get(realmId) as Row | undefined;
    return row && fromRow(row);
  }

  list(): Connection[] {
    const rows = this.db
      .prepare("SELECT * FROM qbo_connections ORDER BY created_at")
      .all() as unknown as Row[];
    return rows.map(fromRow);
  }

  /** Returns a usable access token, refreshing (and persisting the rotated tokens) if needed. */
  async getAccessToken(
    realmId: string,
    client: OAuthClient,
    fetchImpl: typeof fetch = fetch,
    now: number = Date.now(),
  ): Promise<string> {
    const conn = this.get(realmId);
    if (!conn) throw new Error(`No QuickBooks connection for realm ${realmId}`);
    if (conn.accessTokenExpiresAt - REFRESH_MARGIN_MS > now) return conn.accessToken;
    if (conn.refreshTokenExpiresAt <= now) {
      throw new Error(`Refresh token for realm ${realmId} has expired; supplier must reconnect`);
    }
    const tokens = await refreshTokens(client, conn.refreshToken, fetchImpl, now);
    this.save(realmId, tokens, now);
    return tokens.accessToken;
  }
}
