const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const DB_CONFIG = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'seclock',
  password: process.env.DB_PASSWORD || '1',
  port: process.env.DB_PORT || 5432,
};

async function setupDatabase() {
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');
    
    // Read and execute SQL file
    const sqlPath = path.join(__dirname, 'config.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    
    console.log('Database schema created successfully');
    
    // Insert initial data
    await client.query(`
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
        (1, false),
        (2, true),
        (3, true);
    `);
    
    console.log('Initial data inserted');
  } catch (error) {
    console.error('Database setup failed:', error);
  } finally {
    await client.end();
  }
}

setupDatabase();