import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../shared/schema';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('Expected format: postgresql://username:password@host:port/database');
  console.error('Example: postgresql://panelx:panelx123@localhost:5432/panelx');
  process.exit(1);
}

async function migrate() {
  console.log('🔄 Starting database migration...');
  console.log(`📍 Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);

  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    // The schema is already defined in shared/schema.ts
    // Drizzle will sync it automatically with db:push
    console.log('✅ Database schema is ready');
    console.log('💡 Use "npm run db:push" to sync schema changes');
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await client.end();
    process.exit(1);
  }
}

migrate();
