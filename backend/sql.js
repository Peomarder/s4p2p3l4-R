const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  password: process.env.DB_PASSWORD || '1',
  port: process.env.DB_PORT || 5432,
  database: 'postgres' // Connect to default DB first
};

async function setupDatabase() {
  const adminClient = new Client(DB_CONFIG);
  
  try {
    await adminClient.connect();
    console.log('Connected to PostgreSQL admin database');
    
    // 1. Terminate active connections to target DB
    const dbName = process.env.DB_NAME || 'seclock';
    await adminClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
      AND pid <> pg_backend_pid()`,
      [dbName]
    );

    // 2. Drop and recreate database
    await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Database ${dbName} recreated`);
    
    // 3. Close admin connection
    await adminClient.end();
    
    // 4. Connect to new database
    const dbClient = new Client({ ...DB_CONFIG, database: dbName });
    await dbClient.connect();
    console.log(`Connected to ${dbName} database`);
    
    // 5. Execute SQL schema
    const sqlPath = path.join(__dirname, 'config.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await dbClient.query(sql);
    console.log('Database schema executed');
    
    // 6. Insert initial data
    await dbClient.query(`
      INSERT INTO user_privileges (name, description) VALUES
        ('Admin', 'Full system access'),
        ('Operator', 'Limited access for daily operations'),
        ('Guest', 'No access to anything'),
        ('Auditor', 'Read-only access for auditing purposes');
      
      INSERT INTO actions (name, description) VALUES
        ('Login', 'User authentication'),
        ('Login Failed', 'Failed authentication attempt'),
        ('Privilege Change', 'User privilege modification'),
        ('User Deletion', 'User account removal'),
        ('User Creation', 'User account created'),
        ('Lock Creation', 'Security lock created'),
        ('Lock Status Change', 'Security lock modification');
      
      INSERT INTO locks (id_privilege, is_open) VALUES
        ((SELECT id_privilege FROM user_privileges WHERE name = 'Admin'), false),
        ((SELECT id_privilege FROM user_privileges WHERE name = 'Operator'), true),
        ((SELECT id_privilege FROM user_privileges WHERE name = 'Guest'), true);
      
      INSERT INTO users (id_privilege, name, email, login, password) VALUES
        (
          (SELECT id_privilege FROM user_privileges WHERE name = 'Admin'),
          'Admin User',
          'admin@example.com',
          'admin',
          '$2b$10$gSAhZrxMllrbgj/kkK9UceBPpChGWJA7SYIb1Mqo.n5aNLq1/oRrC' -- bcrypt('admin123')
        ),
        (
          (SELECT id_privilege FROM user_privileges WHERE name = 'Operator'),
          'Operator User',
          'operator@example.com',
          'operator',
          '$2b$10$gSAhZrxMllrbgj/kkK9UceBPpChGWJA7SYIb1Mqo.n5aNLq1/oRrC' -- bcrypt('admin123')
        )
		
    `);
    
    console.log('Initial data inserted');
  } catch (error) {
    console.error('Database setup failed:', error);
  } finally {
    await adminClient.end().catch(() => {});
    process.exit(0);
  }
}

setupDatabase();