// /var/www/lock-api/index.js
const express = require('express');
const cors = require('cors');
// Add to the top of index.js
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const { Pool } = require('pg');
const app = express();
const port = 5000;

// PostgreSQL connection
const pool = new Pool({
  user: 'postgres',
  password: '1',
  host: 'localhost',
  database: 'seclock',
  port: 5432,
});

app.use(cors());
app.use(express.json());



// Add this after creating the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Database initialization
const initializeDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS locks (
        id VARCHAR(255) PRIMARY KEY,
        is_open BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Database init error:', err);
  }
};

initializeDB();

// USER ENDPOINTS
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, password]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
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


// Update all lock endpoints to manually map to camelCase
// Get all locks
app.get('/api/locks', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, is_open FROM locks');
    const locks = result.rows.map(row => ({
      id: row.id,
      isOpen: row.is_open
    }));
    res.json(locks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single lock
app.get('/api/locks/:lockId', async (req, res) => {
  const lockId = parseInt(req.params.lockId);
  
  try {
    const result = await pool.query(
      'SELECT id, is_open FROM locks WHERE id = $1', 
      [lockId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lock not found' });
    }
    
    const lock = {
      id: result.rows[0].id,
      isOpen: result.rows[0].is_open
    };
    
    res.json(lock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create lock
app.post('/api/locks', async (req, res) => {
  const { id } = req.body;
  
  if (!id) {
    return res.status(400).json({ error: 'Lock ID required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO locks (id) VALUES ($1) RETURNING id, is_open',
      [id]
    );
    
    const newLock = {
      id: result.rows[0].id,
      isOpen: result.rows[0].is_open
    };
    
    res.status(201).json(newLock);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Lock ID exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update lock

// Update lock endpoint
app.put('/api/locks/:lockId', async (req, res) => {
  const lockId = parseInt(req.params.lockId);
  // Accept both isOpen and is_open in request body
  const isOpen = req.body.isOpen !== undefined ? req.body.isOpen : req.body.is_open;
  
  if (typeof isOpen !== 'boolean') {
    return res.status(400).json({ error: 'isOpen must be boolean' });
  }

  try {
    const result = await pool.query(
      'UPDATE locks SET is_open = $1 WHERE id = $2 RETURNING id, is_open AS "isOpen"',
      [isOpen, lockId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lock not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.delete('/api/locks/:lockId', async (req, res) => {
  const lockId = parseInt(req.params.lockId);
  try {
    const result = await pool.query('DELETE FROM locks WHERE id = $1 RETURNING id', [lockId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lock not found' });
    }
    
    res.json({ message: `Lock ${lockId} deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});