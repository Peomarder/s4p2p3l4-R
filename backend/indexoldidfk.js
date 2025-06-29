const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 5000;

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'seclock',
  port: process.env.DB_PORT || 5432,
});

app.use(cors());
app.use(express.json());

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const JWT_SECRET = process.env.JWT_SECRET || 'energy_security_token';

// Database initialization
const initializeDB = async () => {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Locks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS locks (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_open BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // User Privileges table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_privileges (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        lock_id VARCHAR(255) REFERENCES locks(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, lock_id)
      )
    `);
    
    // Log Entries table (System Log)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS log_entries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        lock_id VARCHAR(255) REFERENCES locks(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        details JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Database init error:', err);
  }
};

initializeDB();

// JWT Authentication Middleware

// Token generation function
const generateToken = (user) => {
  return jwt.sign(
    {
      id_user: user.id_user,
      login: user.login,
      email: user.email,
      id_privilege: user.id_privilege
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
};

// Token verification middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};




// ========================
// AUTHENTICATION ENDPOINTS
// ========================

// User Registration

app.post('/api/auth/register', async (req, res) => {
  const { username, password, email, name } = req.body;
  
  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Username, password, and email required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Get default privilege
    const privResult = await pool.query(
      'SELECT id_privilege FROM user_privileges WHERE name = $1',
      ['default']
    );
    
    if (privResult.rows.length === 0) {
      return res.status(500).json({ error: 'Default privilege not configured' });
    }
    
    const privilegeId = privResult.rows[0].id_privilege;
    
    // Insert user with correct schema
    const result = await pool.query(
      `INSERT INTO users (login, password, email, name, id_privilege) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id_user, login`,
      [username, hashedPassword, email, name || '', privilegeId]
    );
    
    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id_user, username: user.login },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.status(201).json({ token });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Token Verification
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// =================
// USER ENDPOINTS
// =================
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: `User ${id} deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =================
// LOCK ENDPOINTS
// =================
app.get('/api/locks', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description, is_open FROM locks');
    const locks = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isOpen: row.is_open
    }));
    res.json(locks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/locks/:lockId', authenticateToken, async (req, res) => {
  const lockId = req.params.lockId;
  
  try {
    const result = await pool.query(
      'SELECT id, name, description, is_open FROM locks WHERE id = $1', 
      [lockId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lock not found' });
    }
    
    const lock = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      description: result.rows[0].description,
      isOpen: result.rows[0].is_open
    };
    
    res.json(lock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/locks', authenticateToken, async (req, res) => {
  const { id, name, description } = req.body;
  
  if (!id || !name) {
    return res.status(400).json({ error: 'Lock ID and name required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO locks (id, name, description) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, description, is_open`,
      [id, name, description]
    );
    
    const newLock = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      description: result.rows[0].description,
      isOpen: result.rows[0].is_open
    };
    
    // Log the creation
    await pool.query(
      'INSERT INTO log_entries (user_id, lock_id, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, id, 'create', { name, description }]
    );
    
    res.status(201).json(newLock);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Lock ID exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/locks/:lockId', authenticateToken, async (req, res) => {
  const lockId = req.params.lockId;
  const isOpen = req.body.isOpen !== undefined ? req.body.isOpen : req.body.is_open;
  
  if (typeof isOpen !== 'boolean') {
    return res.status(400).json({ error: 'isOpen must be boolean' });
  }

  try {
    const result = await pool.query(
      `UPDATE locks SET is_open = $1 
       WHERE id = $2 
       RETURNING id, name, description, is_open AS "isOpen"`,
      [isOpen, lockId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lock not found' });
    }
    
    const updatedLock = result.rows[0];
    
    // Log the status change
    await pool.query(
      'INSERT INTO log_entries (user_id, lock_id, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, lockId, 'update', { status: isOpen ? 'open' : 'closed' }]
    );
    
    res.json(updatedLock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/locks/:lockId', authenticateToken, async (req, res) => {
  const lockId = req.params.lockId;
  try {
    const result = await pool.query('DELETE FROM locks WHERE id = $1 RETURNING id, name', [lockId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lock not found' });
    }
    
    // Log the deletion
    await pool.query(
      'INSERT INTO log_entries (user_id, lock_id, action, details) VALUES ($1, $2, $3, $4)',
      [req.user.id, lockId, 'delete', { name: result.rows[0].name }]
    );
    
    res.json({ message: `Lock ${lockId} deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// PRIVILEGE ENDPOINTS
// ========================
app.post('/api/privileges', authenticateToken, async (req, res) => {
  const { userId, lockId } = req.body;
  
  if (!userId || !lockId) {
    return res.status(400).json({ error: 'User ID and Lock ID required' });
  }

  try {
    await pool.query(
      'INSERT INTO user_privileges (user_id, lock_id) VALUES ($1, $2)',
      [userId, lockId]
    );
    
    res.status(201).json({ message: 'Privilege assigned' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Privilege already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/privileges/:userId', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const result = await pool.query(
      `SELECT l.id, l.name 
       FROM locks l
       JOIN user_privileges up ON l.id = up.lock_id
       WHERE up.user_id = $1`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// LOG ENTRY ENDPOINTS
// =====================
app.get('/api/logs', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        le.id, 
        u.username, 
        l.id AS lock_id, 
        le.action, 
        le.details, 
        le.timestamp
       FROM log_entries le
       LEFT JOIN users u ON le.user_id = u.id
       LEFT JOIN locks l ON le.lock_id = l.id
       ORDER BY le.timestamp DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logs/:lockId', authenticateToken, async (req, res) => {
  const lockId = req.params.lockId;
  
  try {
    const result = await pool.query(
      `SELECT 
        le.id, 
        u.username, 
        le.action, 
        le.details, 
        le.timestamp
       FROM log_entries le
       LEFT JOIN users u ON le.user_id = u.id
       WHERE le.lock_id = $1
       ORDER BY le.timestamp DESC`,
      [lockId]
    );
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// ACTION ENDPOINTS
// =====================
app.post('/api/actions', authenticateToken, async (req, res) => {
  const { lockId, actionType, details } = req.body;
  
  if (!lockId || !actionType) {
    return res.status(400).json({ error: 'Lock ID and action type required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO log_entries (user_id, lock_id, action, details)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, lockId, actionType, details]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});