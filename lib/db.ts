import postgres from "postgres";

let _sql: postgres.Sql | null = null;

export function getDb(): postgres.Sql {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta la variable DATABASE_URL. Agrégala al archivo .env.local (o Vercel / Cloudflare envs). " +
        "Ejemplo: DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require"
    );
  }
  _sql = postgres(url, {
    ssl: url.includes("sslmode=require") || /neon\.tech|supabase\.co|vercel-storage\.com/.test(url)
      ? "require"
      : undefined,
    max: process.env.NODE_ENV === "production" ? 12 : 4,
    idle_timeout: 8,
    connect_timeout: 15,
    prepare: false,
  });
  return _sql;
}

export type Sql = postgres.Sql;
