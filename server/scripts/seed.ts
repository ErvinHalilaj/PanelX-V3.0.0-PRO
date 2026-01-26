import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import * as schema from '../../shared/schema';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function seed() {
  console.log('🌱 Starting database seeding...');
  
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const existingAdmin = await db.select()
      .from(schema.users)
      .where(schema.users.username.eq('admin'))
      .limit(1);

    if (existingAdmin.length === 0) {
      await db.insert(schema.users).values({
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        credits: 999999,
        enabled: true,
        notes: 'Default administrator account',
        twoFactorEnabled: false,
      });
      
      console.log('✅ Default admin user created');
      console.log('   Username: admin');
      console.log('   Password: admin123');
      console.log('   ⚠️  Please change the password after first login!');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Create default categories
    const existingCategories = await db.select().from(schema.categories).limit(1);
    
    if (existingCategories.length === 0) {
      await db.insert(schema.categories).values([
        { categoryName: 'News', categoryType: 'live' },
        { categoryName: 'Sports', categoryType: 'live' },
        { categoryName: 'Entertainment', categoryType: 'live' },
        { categoryName: 'Movies', categoryType: 'movie' },
        { categoryName: 'Action', categoryType: 'movie' },
        { categoryName: 'Comedy', categoryType: 'movie' },
        { categoryName: 'Drama', categoryType: 'series' },
        { categoryName: 'Sci-Fi', categoryType: 'series' },
      ]);
      
      console.log('✅ Default categories created');
    } else {
      console.log('ℹ️  Categories already exist');
    }

    console.log('');
    console.log('✅ Database seeding completed successfully!');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Start the server: npm run pm2:start');
    console.log('   2. Access the panel: http://your-server-ip');
    console.log('   3. Login with admin/admin123');
    console.log('   4. Change the default password');
    console.log('');
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    await client.end();
    process.exit(1);
  }
}

seed();
