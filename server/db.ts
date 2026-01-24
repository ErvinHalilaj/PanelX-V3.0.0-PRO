import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set!");
  console.error("Expected format: postgresql://username:password@host:port/database");
  console.error("Example: postgresql://panelx:panelx123@localhost:5432/panelx");
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Test database connection on startup
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Add connection error handler
pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection test failed:', err.message);
    console.error('Connection string:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
  } else {
    console.log('✅ Database connected successfully at', res.rows[0].now);
  }
});

export const db = drizzle(pool, { schema });
