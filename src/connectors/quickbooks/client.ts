import type { IntuitEnvironment } from "../../config.js";

const API_BASE: Record<IntuitEnvironment, string> = {
  sandbox: "https://sandbox-quickbooks.api.intuit.com",
  production: "https://quickbooks.api.intuit.com",
};

// Intuit retired minor versions below 75; pin explicitly so response shapes don't drift.
export const MINOR_VERSION = "75";

/** Runs a QBO query (their SQL-like dialect) and returns the raw JSON response. */
export async function qboQuery(
  environment: IntuitEnvironment,
  realmId: string,
  accessToken: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const url = new URL(`/v3/company/${encodeURIComponent(realmId)}/query`, API_BASE[environment]);
  url.searchParams.set("query", query);
  url.searchParams.set("minorversion", MINOR_VERSION);
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const intuitTid = res.headers.get("intuit_tid") ?? "n/a";
    throw new Error(`QBO query failed: ${res.status} (intuit_tid ${intuitTid}) ${await res.text()}`);
  }
  return res.json();
}
