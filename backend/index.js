// src/backend/index.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

require('dotenv').config({ path: './config.env' });

console.log('[ENV] DB_HOST:', process.env.DB_HOST);
console.log('[ENV] DB_NAME:', process.env.DB_NAME);
console.log('[STARTUP] Starting server...');
console.log(`[ENV] DB_HOST: ${process.env.DB_HOST || 'localhost'}`);
console.log(`[ENV] DB_NAME: ${process.env.DB_NAME || 'seclock'}`);

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('[DEBUG] Point 1 - Before pool initialization');
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
  connectionTimeoutMillis: 2000,  // Fail fast if can't connect
  query_timeout: 5000,            // 5s query timeout
  statement_timeout: 5000,         // 5s statement timeout
});
(async () => {
  try {
    console.log('[DB] Testing database connection...');
    const res = await pool.query('SELECT NOW()');
    console.log(`[DB] Connection successful. Current time: ${res.rows[0].now}`);
  } catch (err) {
    console.error('[DB] FATAL: Database connection failed!', err);
    process.exit(1); // Exit immediately if DB connection fails
  }
})();
console.log('[DEBUG] Point 2 - After pool initialization');
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader(
  'Content-Security-Policy',
  "default-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
  "connect-src * 'self' data:; " +
  "img-src * data: 'self'; " +
  "frame-src *; " +
  "script-src * 'self' 'unsafe-inline' 'unsafe-eval';"
);
  next();
});

app.get('/api/test', (req, res) => {
  console.log('Root endpoint hit');
  res.send('Server is running');
});

console.log('[DEBUG] Point 3 - After middleware setup');
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});



const JWT_SECRET = process.env.JWT_SECRET || 'energy_security_token';
const TOKEN_EXPIRY = '1h';

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
/*
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};*/



function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // Handle token expiration specifically
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ error: 'Token expired' });
      }
      return res.sendStatus(403);
    }
    
    req.user = user;
    next();
  });
}



// ========================
// AUTHENTICATION ENDPOINTS
// ========================

// User Registration
// Token refresh endpoint
app.post('/api/auth/refresh', async (req, res) => {
  const { token } = req.body;
  
  if (!token) return res.sendStatus(401);
  
  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const accessToken = generateAccessToken({ id_user: decoded.id_user });
    res.json({ token: accessToken });
  } catch (error) {
    console.error('Token refresh failed:', error);
    res.sendStatus(403);
  }
});
// User Registration
app.post('/api/auth/register', async (req, res) => {
  console.log('[REGISTER] New registration request');
  console.log('[REGISTER] Request body:', req.body);
  
  const { username, password, email, name } = req.body;
  
  // Validate input
  if (!username || !password || !email) {
    const missing = [];
    if (!username) missing.push('username');
    if (!password) missing.push('password');
    if (!email) missing.push('email');
    
    console.warn(`[REGISTER] Missing fields: ${missing.join(', ')}`);
    return res.status(400).json({ 
      error: 'Username, password, and email required',
      missingFields: missing
    });
  }

  try {
    console.log('[REGISTER] Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('[REGISTER] Password hashed successfully');
    
    console.log('[REGISTER] Fetching default privilege...');
    const privResult = await pool.query(
      'SELECT id_privilege FROM user_privileges WHERE name = $1',
      ['default']
    );
    
    if (privResult.rows.length === 0) {
      console.error('[REGISTER] Default privilege missing. Attempting to create...');
      
      // Create default privilege if missing
      const createPrivResult = await pool.query(
        `INSERT INTO user_privileges (name, description)
         VALUES ('default', 'Default privilege for new users')
         RETURNING id_privilege`
      );
      
      if (createPrivResult.rows.length === 0) {
        console.error('[REGISTER] FATAL: Failed to create default privilege');
        return res.status(500).json({ error: 'System configuration error' });
      }
      
      console.log('[REGISTER] Created default privilege');
      privilegeId = createPrivResult.rows[0].id_privilege;
    } else {
      privilegeId = privResult.rows[0].id_privilege;
    }
    
    console.log(`[REGISTER] Using privilege ID: ${privilegeId}`);
    
    // Insert user
    console.log('[REGISTER] Creating user in database...');
    const result = await pool.query(
      `INSERT INTO users (login, password, email, name, id_privilege) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id_user, login, email`,
      [username, hashedPassword, email, name || '', privilegeId]
    );
    
    const user = result.rows[0];
    console.log(`[REGISTER] User created: ID=${user.id_user}, Login=${user.login}`);
    
    // Create token
    console.log('[REGISTER] Generating JWT token...');
    const token = jwt.sign(
      { id: user.id_user, username: user.login, email: user.email },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    
    console.log('[REGISTER] Updating user token in database...');
    await pool.query(
      `UPDATE users SET 
        token = $1, 
        token_expiry = CURRENT_TIMESTAMP + INTERVAL '1 hour'
       WHERE id_user = $2`,
      [token, user.id_user]
    );
    
    console.log('[REGISTER] Registration successful!');
    res.status(201).json({ 
      token,
      user: {
        id: user.id_user,
        username: user.login,
        email: user.email
      }
    });
    
  } catch (err) {
    console.error('[REGISTER] Database Error:', err);
    
    if (err.code === '23505') { // Unique violation
      const field = err.constraint.includes('email') ? 'email' : 
                   err.constraint.includes('login') ? 'username' : 'field';
      console.warn(`[REGISTER] Conflict: ${field} already exists`);
      res.status(409).json({ 
        error: `${field} already exists`,
        conflictField: field
      });
    } else {
      console.error('[REGISTER] Unexpected Error:', err.stack || err);
      res.status(500).json({ 
        error: 'Registration failed',
        details: err.message
      });
    }
  }
});


app.get('/api/db-check', async (req, res) => {
  try {
    console.log('Testing DB connection...');
    const result = await pool.query('SELECT NOW() AS current_time');
    console.log('DB connection successful:', result.rows[0]);
    res.json({ status: 'connected', time: result.rows[0].current_time });
  } catch (err) {
    console.error('DATABASE CONNECTION ERROR:', err);
    res.status(500).json({ error: 'Database connection failed' });
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
      'SELECT * FROM users WHERE login = $1',
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
    
    const token = generateToken(user);
    
    // Update token in database
    await pool.query(
      `UPDATE users SET 
        token = $1, 
        token_expiry = CURRENT_TIMESTAMP + INTERVAL '1 hour'
       WHERE id_user = $2`,
      [token, user.id_user]
    );
    
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    // Check if token exists in database and hasn't expired
    const result = await pool.query(
      `SELECT 1 FROM users 
       WHERE id_user = $1 
         AND token = $2 
         AND token_expiry > NOW()`,
      [req.user.id_user, req.headers.authorization.split(' ')[1]]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ valid: false });
    }
    
    res.json({ valid: true, user: req.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    // Verify token without checking expiration
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    
    // Check if token exists in database
    const userResult = await pool.query(
      `SELECT * FROM users 
       WHERE id_user = $1 
         AND token = $2`,
      [decoded.id_user, token]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const user = userResult.rows[0];
    
    // Generate new token
    const newToken = generateToken(user);
    
    // Update token in database
    await pool.query(
      `UPDATE users SET 
        token = $1, 
        token_expiry = CURRENT_TIMESTAMP + INTERVAL '1 hour'
       WHERE id_user = $2`,
      [newToken, user.id_user]
    );
    
    res.json({ token: newToken });
  } catch (err) {
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// =================
// USER ENDPOINTS
// =================
// Updated /api/users endpoint
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id_user,
        u.login,
        u.name,
        u.email,
        u.created_at,
        p.name AS privilege_name
      FROM users u
      JOIN user_privileges p ON u.id_privilege = p.id_privilege
    `);
    
    // Format the response to match client expectations
    const users = result.rows.map(user => ({
      id_user: user.id_user,
      login: user.login,
      name: user.name,
      email: user.email,
      privilege_name: user.privilege_name,
      created_at: user.created_at
    }));
    
    res.json(users);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id; 
    const result = await pool.query(`
      SELECT u.id_user, u.login, u.name, u.email, p.name AS privilege_name
      FROM users u
      JOIN user_privileges p ON u.id_privilege = p.id_privilege
      WHERE u.id_user = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/users/:userId', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.userId);
  
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const result = await pool.query('DELETE FROM users WHERE id_user = $1 RETURNING id_user', [userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: `User ${userId} deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =====================
// TOKEN VALIDATION FUNCTION (for SQL)
// =====================
app.post('/api/auth/validate', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ valid: false });
  }

  try {
    // Verify token
    jwt.verify(token, JWT_SECRET);
    
    // Check if token exists in database
    const result = await pool.query(
      `SELECT 1 FROM users 
       WHERE token = $1 
         AND token_expiry > NOW()`,
      [token]
    );
    
    res.json({ valid: result.rows.length > 0 });
  } catch (err) {
    res.json({ valid: false });
  }
});

// =================
// LOCK ENDPOINTS
// =================
app.get('/api/locks', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id_lock, id_privilege, is_open, last_modified FROM locks');
    const locks = result.rows.map(row => ({
      id: row.id_lock,
      name: row.id_privilege,
      is_open: row.is_open
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
      'SELECT id_lock, id_privilege, is_open, last_modified FROM locks WHERE id_lock = $1', 
      [lockId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lock not found' });
    }
    
    const lock = {
      id_lock: result.rows[0].id_lock,
      name: result.rows[0].name,
      is_open: result.rows[0].is_open
    };
    
    res.json(lock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// LOCK UPDATE ENDPOINT (simplified logging)
app.put('/api/locks/:lockId', authenticateToken, async (req, res) => {
  const lockId = req.params.lockId;
  const is_open = req.body.is_open !== undefined ? req.body.is_open : req.body.is_open;
  
  if (typeof is_open !== 'boolean') {
    return res.status(400).json({ error: 'is_open must be boolean' });
  }

  try {
    // Update lock status
    const result = await pool.query(
      `UPDATE locks SET 
        is_open = $1,
        last_modified = CURRENT_TIMESTAMP
       WHERE id_lock = $2 
       RETURNING id_lock, id_privilege, last_modified, is_open`,
      [is_open, lockId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lock not found' });
    }
    
    const updatedLock = result.rows[0];
    
    // Log the status change (simplified without details)
    await pool.query(
      `INSERT INTO log_entries (id_user, id_lock, id_action)
       VALUES ($1, $2, $3)`,
      [req.user.id_user, lockId, 2] // 2 = 'update' action
    );
    
    res.json({
      id_lock: updatedLock.id_lock,
      privilegeId: updatedLock.id_privilege,
      is_open: updatedLock.is_open,
      lastModified: updatedLock.last_modified
    });
  } catch (err) {
    console.error('Lock update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// LOCK CREATION ENDPOINT (simplified logging)
app.post('/api/locks', authenticateToken, async (req, res) => {
  const { id_lock } = req.body;
  
  if (!id_lock) {
    return res.status(400).json({ error: 'Lock ID required' });
  }

  try {
    // Get default privilege ID
    const privResult = await pool.query(
      `SELECT id_privilege FROM user_privileges WHERE name = 'default'`
    );
    
    if (privResult.rows.length === 0) {
      return res.status(400).json({ error: 'Default privilege not found' });
    }
    
    const privilegeId = privResult.rows[0].id_privilege;
    
    // Create lock
    const result = await pool.query(
      `INSERT INTO locks (id_lock, id_privilege) 
       VALUES ($1, $2) 
       RETURNING id_lock, id_privilege, is_open, last_modified`,
      [id_lock, privilegeId]
    );
    
    const newLock = result.rows[0];
    
    // Log creation (simplified without details)
    await pool.query(
      `INSERT INTO log_entries (id_user, id_lock, id_action)
       VALUES ($1, $2, $3)`,
      [req.user.id_user, id_lock, 1] // 1 = 'create' action
    );
    
    res.status(201).json({
      id_lock: newLock.id_lock,
      privilegeId: newLock.id_privilege,
      is_open: newLock.is_open,
      lastModified: newLock.last_modified
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Lock ID exists' });
    }
    console.error('Lock creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/locks/:lockId', authenticateToken, async (req, res) => {
  const lockId = req.params.lockId;
  try {
    const result = await pool.query('DELETE FROM locks WHERE id_lock = $1 RETURNING id_lock, name', [lockId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lock not found' });
    }
    
    // Log the deletion
    await pool.query(
      'INSERT INTO log_entries (id_user, id_lock, id_action) VALUES ($1, $2, $3)',
      [req.user.id_user, lockId, 'delete', { name: result.rows[0].name }]
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
      'INSERT INTO user_privileges (id_user, id_lock) VALUES ($1, $2)',
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
      `SELECT l.id, l.id_privilege 
       FROM locks l
       JOIN user_privileges up ON l.id = up.id_lock
       WHERE up.id_user = $1`,
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
        le.id_log, 
        u.login, 
        l.id_lock AS id_lock, 
        le.id_action,
        le.timestamp
       FROM log_entries le
       LEFT JOIN users u ON le.id_user = u.id_user
       LEFT JOIN locks l ON le.id_lock = l.id_lock
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
        le.id_log, 
        u.login, 
        le.id_action, 
        le.details, 
        le.timestamp
       FROM log_entries le
       LEFT JOIN users u ON le.id_user = u.id_user
       WHERE le.id_lock = $1
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
      `INSERT INTO log_entries (id_user, id_lock, id_action)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id_user, lockId, actionType]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    dbHost: process.env.DB_HOST,
    dbName: process.env.DB_NAME,
    dbUser: process.env.DB_USER,
    nodeEnv: process.env.NODE_ENV
  });
});

app.post('/api/log-action', async (req, res) => {
  try {
    const { action_id, id_lock } = req.body;
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Set user ID in session context for trigger functions
    await pool.query(`SET app.id_user = ${decoded.id_user}`);
    
    // Log the action
    await pool.query(
      `SELECT log_action($1, $2)`,
      [id_action, id_lock]
    );
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Logging error:', error);
    res.status(500).json({ error: 'Failed to log action' });
  }
});

// Add this endpoint for system logs
app.get('/api/system-logs', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id_system_log,
        id_action,
        affected_ip,
        timestamp
      FROM system_log
      ORDER BY timestamp DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

process.on('exit', (code) => {
  console.log(`[SHUTDOWN] Process exiting with code: ${code}`);
});
app.get('/api/db-info', async (req, res) => {
  try {
    const dbInfo = await pool.query(`
      SELECT current_database(), current_user, inet_server_addr(), inet_server_port()
    `);
    res.json(dbInfo.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const startServer = async () => {
  try {
    // Test DB connection
    console.log('Testing database connection...');
    const dbTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful:', dbTest.rows[0].now);
    
    // Initialize database tables
    
    // Start listening for requests - ONLY ONE app.listen CALL
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`🔗 Access: http://localhost:${port}`);
      console.log(`🔗 Test endpoint: http://localhost:${port}/api/test`);
    });
    
    // Add keep-alive ping
    setInterval(() => {
      pool.query('SELECT 1')
        .then(() => console.log('💓 Database keep-alive ping successful'))
        .catch(err => console.error('⚠️ Keep-alive ping failed:', err));
    }, 30000); // Ping every 30 seconds
    
  } catch (error) {
    console.error('🔥 FATAL: Failed to start server', error);
    process.exit(1);
  }
};

// Start the server
startServer();