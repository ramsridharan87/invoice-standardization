// Env is loaded by Node itself (`--env-file=.env`, see package.json scripts).

export type IntuitEnvironment = "sandbox" | "production";

export interface Config {
  port: number;
  databasePath: string;
  intuit: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    environment: IntuitEnvironment;
  };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var ${name} (see .env.example)`);
  return value;
}

export function loadConfig(): Config {
  const environment = process.env.INTUIT_ENVIRONMENT?.trim() || "sandbox";
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error(`INTUIT_ENVIRONMENT must be "sandbox" or "production", got "${environment}"`);
  }
  return {
    port: Number(process.env.PORT ?? 3000),
    databasePath: process.env.DATABASE_PATH?.trim() || "./data.sqlite",
    intuit: {
      clientId: required("INTUIT_CLIENT_ID"),
      clientSecret: required("INTUIT_CLIENT_SECRET"),
      redirectUri: required("INTUIT_REDIRECT_URI"),
      environment,
    },
  };
}
