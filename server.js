import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createHash, randomUUID } from 'crypto';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables - prioritize .env.local for local development
// .env.local: Local development (not in git)
// .env: Production/Hostinger (committed to git)
const envLocalPath = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envLocalPath)) {
  console.log('Loading .env.local from:', envLocalPath);
  dotenv.config({ path: envLocalPath });
} else {
  console.log('Loading .env from:', envPath);
  console.log('.env file exists:', fs.existsSync(envPath));
  dotenv.config({ path: envPath });
}

// DEBUG: Log environment variables to help diagnose Hostinger issues
console.log('=== ENVIRONMENT DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DB_HOST:', process.env.DB_HOST || 'UNDEFINED');
console.log('DB_USER:', process.env.DB_USER || 'UNDEFINED');
console.log('DB_NAME:', process.env.DB_NAME || 'UNDEFINED');
console.log('DB_PORT:', process.env.DB_PORT || 'UNDEFINED');
console.log('PORT:', process.env.PORT || 'UNDEFINED');
console.log('========================');

const app = express();
app.use(cors());
// Allow up to 20 MB JSON bodies so base64-encoded images stored in the DB are not rejected.
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Prefer IPv4 and non-keepalive sockets for flaky provider gateways.
const HTTP_AGENT_IPV4 = new http.Agent({ keepAlive: false, family: 4 });
const HTTPS_AGENT_IPV4 = new https.Agent({ keepAlive: false, family: 4 });
const WHATSAPP_TEXT_TIMEOUT_MS = Math.max(5000, Number(process.env.WHATSAPP_TEXT_TIMEOUT_MS || 45000));
const WHATSAPP_TEXT_MAX_ATTEMPTS = Math.max(1, Number(process.env.WHATSAPP_TEXT_MAX_ATTEMPTS || 3));

const shouldRetryGatewayError = (err) => {
  if (err?.name === 'AbortError') return true;
  const code = err?.code || '';
  if (['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED', 'ENOTFOUND'].includes(code)) return true;
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('aborted');
};

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithGatewayRetry = async (fetchImpl, url, options = {}, retryConfig = {}) => {
  const maxAttempts = Math.max(1, Number(retryConfig.maxAttempts ?? WHATSAPP_TEXT_MAX_ATTEMPTS));
  const timeoutMs = Math.max(5000, Number(retryConfig.timeoutMs ?? WHATSAPP_TEXT_TIMEOUT_MS));
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, {
        ...options,
        signal: controller.signal,
        agent: ({ protocol }) => (protocol === 'http:' ? HTTP_AGENT_IPV4 : HTTPS_AGENT_IPV4),
      });
    } catch (err) {
      lastErr = err;
      if (!shouldRetryGatewayError(err) || attempt === maxAttempts) {
        throw err;
      }
      console.warn(`Gateway request retry ${attempt}/${maxAttempts} after ${err.code || err.message}`);
      await waitMs(600 * attempt);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
  throw lastErr;
};

const resolveUploadsDir = () => {
  const configured = (process.env.UPLOADS_DIR || '').trim();
  if (configured) {
    if (configured.startsWith('~/') && process.env.HOME) {
      return path.join(process.env.HOME, configured.slice(2));
    }
    return path.isAbsolute(configured) ? configured : path.join(__dirname, configured);
  }

  // On production hosts (Hostinger), prefer a directory under HOME so files survive code updates.
  if (process.env.NODE_ENV === 'production' && process.env.HOME) {
    return path.join(process.env.HOME, 'sandesh-invitation-uploads');
  }

  return path.join(__dirname, 'uploads');
};

// Serve uploaded files statically
const uploadsDir = resolveUploadsDir();
const legacyUploadsDir = path.join(__dirname, 'uploads');
const isSameUploadsDir = path.resolve(uploadsDir) === path.resolve(legacyUploadsDir);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!isSameUploadsDir && !fs.existsSync(legacyUploadsDir)) {
  fs.mkdirSync(legacyUploadsDir, { recursive: true });
}

console.log('Uploads directory:', uploadsDir);
if (!isSameUploadsDir) {
  console.log('Legacy uploads fallback:', legacyUploadsDir);
}

app.use('/uploads', express.static(uploadsDir));
if (!isSameUploadsDir) {
  app.use('/uploads', express.static(legacyUploadsDir));
}

// Serve uploads via API proxy to avoid host-level upload restrictions
app.get('/api/uploads/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename || '');
  const candidateDirs = isSameUploadsDir ? [uploadsDir] : [uploadsDir, legacyUploadsDir];
  const resolvedDir = candidateDirs.find((baseDir) => fs.existsSync(path.join(baseDir, safeName)));
  if (!safeName || !resolvedDir) {
    return res.status(404).json({ error: 'file_not_found' });
  }
  const filePath = path.join(resolvedDir, safeName);
  return res.sendFile(filePath);
});

// Serve frontend build files - Node.js serves both frontend and API
// For manual deployment in public_html, Node.js handles everything
const frontendDistDir = path.join(__dirname, 'fronthend', 'dist');
if (fs.existsSync(frontendDistDir)) {
  console.log('✅ Serving frontend from:', frontendDistDir);
  app.use(express.static(frontendDistDir));
} else {
  console.warn('⚠️ Frontend build not found at:', frontendDistDir);
  console.warn('Run "npm run build" in fronthend/ directory to generate frontend build');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/pdf';
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed!'));
    }
  }
});

// Validate required environment variables
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
  console.error('⚠️ CRITICAL: Missing database environment variables!');
  console.error('Please configure: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
  console.error('App will start but database operations will fail until configured.');
  console.error('---');
}

// DEBUG: Log DB environment variables BEFORE pool creation
console.log('DB ENV DEBUG:', {
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_NAME: process.env.DB_NAME,
  DB_PORT: process.env.DB_PORT,
  HAS_PASSWORD: !!process.env.DB_PASSWORD,
});

// Create connection pool only if credentials are provided
// Force IPv4 when host is "localhost" to avoid ::1 access-denied on Hostinger
const rawDbHost = process.env.DB_HOST || 'localhost';
const resolvedDbHost = rawDbHost === 'localhost' ? '127.0.0.1' : rawDbHost;

let pool = null;
if (process.env.DB_USER && process.env.DB_NAME) {
  pool = mysql.createPool({
    host: resolvedDbHost,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  console.log('DB host resolved to:', resolvedDbHost);
} else {
  console.warn('⚠️ Database pool NOT created - missing credentials');
  console.warn('API will run but all database operations will fail');
}

// Test database connection on startup (non-blocking)
if (pool) {
  pool.getConnection()
    .then(connection => {
      console.log('✅ Database connected successfully!');
      connection.release();
    })
    .catch(err => {
      console.warn('⚠️ Database connection failed (app will continue):');
      console.warn('Error:', err.code || 'UNKNOWN', '-', err.message);
      console.warn('Please check Environment Variables:');
      console.warn(`  DB_HOST: ${process.env.DB_HOST || 'NOT_SET'}`);
      console.warn(`  DB_PORT: ${process.env.DB_PORT || 'NOT_SET'}`);
      console.warn(`  DB_USER: ${process.env.DB_USER || 'NOT_SET'}`);
      console.warn(`  DB_NAME: ${process.env.DB_NAME || 'NOT_SET'}`);
      console.warn('Database operations will fail until connection is fixed.');
    });
}

// Map frontend entity names to table names in MySQL
// Add mappings here as you add new tables. IDs are the same in both tables per user note.
const ENTITY_TABLES = {
  ProgramType: 'programtype',
  Pragram: 'pragram',
  LetterTemplate: 'lettertemplate',
  LetterSettings: 'lettersettings',
  AppSettings: 'appsettings',
  Operator: 'operator',
  User: 'operator',
  PoliticianType: 'politician_type',
  Politician: 'politician',
  Mandal: 'mandal',
};

// Normalize entity name to match ENTITY_TABLES
const getTable = (entity) => {
  return ENTITY_TABLES[entity] || ENTITY_TABLES[entity.charAt(0).toUpperCase() + entity.slice(1)];
};

const tableColumnsCache = new Map();

const getTableColumns = async (table) => {
  if (!pool) return [];
  if (tableColumnsCache.has(table)) {
    return tableColumnsCache.get(table);
  }
  const [columns] = await pool.query('SHOW COLUMNS FROM ??', [table]);
  const columnNames = columns.map((col) => col.Field);
  tableColumnsCache.set(table, columnNames);
  return columnNames;
};

const filterPayloadToColumns = (payload, allowedColumns) => {
  if (!payload || typeof payload !== 'object') return {};
  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (allowedColumns.includes(key) && value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

// Add global middleware to check database connection
app.use('/api', (req, res, next) => {
  if (!pool) {
    return res.status(503).json({
      error: 'db_not_ready',
      message: 'डेटाबेस कनेक्ट नहीं है'
    });
  }
  next();
});

// Auth endpoints
app.get('/api/debug/entity-tables', (req, res) => {
  res.json(ENTITY_TABLES);
});

// Debug endpoint to check environment variables loading
app.get('/api/debug/env', (req, res) => {
  console.log('=== ENV DEBUG REQUEST ===');
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***MASKED***' : 'UNDEFINED');
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log('DB_PORT:', process.env.DB_PORT);
  console.log('PORT:', process.env.PORT);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('========================');
  
  return res.json({
    success: true,
    environment: {
      DB_HOST: process.env.DB_HOST || 'UNDEFINED',
      DB_USER: process.env.DB_USER || 'UNDEFINED',
      DB_PASSWORD: process.env.DB_PASSWORD ? '***MASKED***' : 'UNDEFINED',
      DB_NAME: process.env.DB_NAME || 'UNDEFINED',
      DB_PORT: process.env.DB_PORT || 'UNDEFINED',
      PORT: process.env.PORT || 'UNDEFINED',
      NODE_ENV: process.env.NODE_ENV || 'development'
    },
    message: 'Check server console and response above to verify .env is loaded correctly'
  });
});

// Alternative debug endpoint (without slash) for Hostinger support
app.get('/api/debug-env', (req, res) => {
  res.json({
    success: true,
    environment: {
      DB_HOST: process.env.DB_HOST || 'UNDEFINED',
      DB_USER: process.env.DB_USER || 'UNDEFINED',
      DB_PASSWORD: process.env.DB_PASSWORD ? 'SET' : 'UNDEFINED',
      DB_NAME: process.env.DB_NAME || 'UNDEFINED',
      DB_PORT: process.env.DB_PORT || 'UNDEFINED',
      PORT: process.env.PORT || 'UNDEFINED',
      NODE_ENV: process.env.NODE_ENV || 'UNDEFINED',
    },
    poolExists: !!pool,
    resolvedHost: pool ? '(pool created)' : '(no pool)',
  });
});

app.get('/api/auth/isAuthenticated', async (req, res) => {
  // Check for token in Authorization header or query parameter
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  if (!token) {
    return res.status(401).json({ authenticated: false, error: 'No token provided' });
  }

  // For development, you can optionally allow a dev token
  if (token === 'dev-token' && process.env.NODE_ENV === 'development') {
    return res.json({ authenticated: true });
  }

  // In production, validate token against database or JWT signature
  // For now, just check if token exists in localStorage (client-side)
  return res.json({ authenticated: true });
});

app.get('/api/auth/me', async (req, res) => {
  try {
    // Check for token in Authorization header or query parameter
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // In development mode, allow dev token for testing
    if (token === 'dev-token' && process.env.NODE_ENV === 'development') {
      return res.json({ 
        id: 'dev', 
        name: 'Developer', 
        role: 'admin', 
        permissions: {
          can_add_program: true,
          can_edit_program: true,
          can_view_reminder: true,
          can_mark_attended: true,
          can_generate_letter: true,
        },
        pages: [] // Empty means access to all pages
      });
    }

    // Get operator_token from localStorage (passed via query or header)
    // In a real JWT implementation, decode and verify the token
    // For now, we'll trust the token and fetch user from localStorage data
    // This is simplified - in production use proper JWT verification
    
    // Since we can't access localStorage from server, client must send operator data
    // Or we decode a JWT token. For now, return 401 to force re-login
    return res.status(401).json({ error: 'Invalid or expired token' });
    
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

app.get('/api/health', async (req, res) => {
  if (!pool) {
    return res.status(200).json({ 
      status: 'degraded', 
      db: 'no_pool',
      error: 'Database pool not initialized - missing credentials',
      env: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3000,
      hint: 'Check DB environment variables in .env file'
    });
  }
  
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    return res.json({ 
      status: 'ok', 
      db: 'connected',
      dbTest: rows[0].ok === 1,
      env: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3000
    });
  } catch (err) {
    return res.status(200).json({ 
      status: 'degraded', 
      db: 'disconnected',
      error: err.message,
      env: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3000,
      hint: 'Check DB environment variables'
    });
  }
});

// List entities
app.get('/api/entities/:entity', async (req, res) => {
  const table = getTable(req.params.entity);
  if (!table) return res.status(400).json({ error: 'unsupported_entity' });
  
  // Check if pool is available
  if (!pool) {
    console.error('❌ Database pool is NULL - connection not initialized');
    return res.status(500).json({ error: 'Database not connected', details: 'Database pool is null - check environment variables and MySQL connection' });
  }
  
  try {
    const [rows] = await pool.query('SELECT * FROM ??', [table]);
    if (table === 'lettertemplate' && rows.length > 0) {
      console.log('[GET lettertemplate] First row keys:', Object.keys(rows[0]));
      console.log('[GET lettertemplate] First row id value:', rows[0].id, 'type:', typeof rows[0].id);
    }
    return res.json(rows);
  } catch (err) {
    console.error(`❌ Query error for table ${table}:`, err.code, err.message);
    return res.status(500).json({ 
      error: err.message,
      code: err.code,
      details: 'Check MySQL connection and table permissions'
    });
  }
});

// Also support GET /list
app.get('/api/entities/:entity/list', async (req, res) => {
  const table = getTable(req.params.entity);
  if (!table) return res.status(400).json({ error: 'unsupported_entity' });
  try {
    const [rows] = await pool.query('SELECT * FROM ??', [table]);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Also support POST /list (some SDKs use this)
app.post('/api/entities/:entity/list', async (req, res) => {
  const table = getTable(req.params.entity);
  if (!table) return res.status(400).json({ error: 'unsupported_entity' });
  try {
    const [rows] = await pool.query('SELECT * FROM ??', [table]);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get single entity
app.get('/api/entities/:entity/:id', async (req, res) => {
  const table = getTable(req.params.entity);
  if (!table) return res.status(400).json({ error: 'unsupported_entity' });
  try {
    const [rows] = await pool.query(
      'SELECT * FROM ?? WHERE id = ? OR Sn = ? LIMIT 1',
      [table, req.params.id, req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'not_found' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching entity:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Create entity
app.post('/api/entities/:entity', async (req, res) => {
  const table = getTable(req.params.entity);
  if (!table) return res.status(400).json({ error: 'unsupported_entity' });
  const payload = req.body || {};
  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'empty_payload' });
  }
  try {
    console.log(`\n=== CREATE ${table} ===`);
    console.log('Raw payload:', payload);

    // CRITICAL: Remove blank id values FIRST before any other processing
    if (payload.id === '' || payload.id === null || payload.id === undefined) {
      console.log(`[CRITICAL] Removing blank/null id from ${table} create payload`);
      delete payload.id;
    }

    console.log('Payload after id cleanup:', payload);

    const allowedColumns = await getTableColumns(table);
    if (!allowedColumns.length) {
      return res.status(500).json({ error: 'table_columns_not_loaded', message: `Could not load columns for table ${table}` });
    }

    if (req.params.entity === 'User' && payload.permissions) {
      if (Array.isArray(payload.permissions)) {
        payload.permissions = JSON.stringify(payload.permissions);
      } else if (typeof payload.permissions === 'object') {
        payload.permissions = JSON.stringify(payload.permissions);
      }
    }

    const unknownKeys = Object.keys(payload).filter((key) => !allowedColumns.includes(key));
    if (unknownKeys.length) {
      console.warn(`Dropping unknown keys for ${table}:`, unknownKeys);
    }

    let insertPayload = filterPayloadToColumns(payload, allowedColumns);
    if (!Object.keys(insertPayload).length) {
      return res.status(400).json({ error: 'empty_or_invalid_payload', message: 'No valid columns found for insert' });
    }

    if (req.params.entity === 'User') {
      const { name, email, password, role, permissions } = payload;
      if (!email || !password) {
        return res.status(400).json({ error: 'name_email_password_required' });
      }

      const hashed = createHash('sha256').update(String(password)).digest('hex');
      insertPayload = {
        id: (typeof randomUUID === 'function' ? randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
        name: name || email,
        email,
        password_hash: hashed,
        role: role || 'user',
        permissions,
        is_active: 1,
      };
    } else {
      // Non-User entities: ensure id is not blank
      if (insertPayload.id === '' || insertPayload.id === null || insertPayload.id === undefined) {
        delete insertPayload.id;
      }
    }

    console.log(`[INSERT ${table}] Final payload:`, insertPayload);
    
    // CRITICAL: Prevent blank/null id from being inserted
    if (insertPayload.id === '' || insertPayload.id === null) {
      console.warn(`[INSERT ${table}] BLOCKING blank ID in payload. Removing it.`);
      delete insertPayload.id;
    }
    
    // Verify payload is valid
    if (!Object.keys(insertPayload).length) {
      return res.status(400).json({ error: 'empty_payload_after_validation', message: 'No valid columns in insert payload' });
    }
    
    console.log(`[INSERT ${table}] FINAL sanitized payload:`, insertPayload);
    
    // Execute INSERT
    const [result] = await pool.query('INSERT INTO ?? SET ?', [table, insertPayload]);
    
    console.log(`[INSERT ${table}] MySQL result:`, { insertId: result.insertId, affectedRows: result.affectedRows });
    
    // Get the ID - prefer numeric insertId, but fallback to provided payload.id for text/string keys
    let newId = result.insertId;
    
    if (!newId || newId === 0 || newId === '') {
      if (insertPayload.id !== undefined && insertPayload.id !== null && insertPayload.id !== '') {
        console.log(`[INSERT ${table}] Using provided payload.id as newId:`, insertPayload.id);
        newId = insertPayload.id;
      } else {
        console.log(`[INSERT ${table}] result.insertId is empty, trying LAST_INSERT_ID()`);
        const [lastIdResult] = await pool.query('SELECT LAST_INSERT_ID() as lastId');
        newId = lastIdResult[0]?.lastId;
        console.log(`[INSERT ${table}] LAST_INSERT_ID() returned:`, newId);
      }
    }
    
    if (!newId || newId === 0) {
      console.error(`[INSERT ${table}] CRITICAL: Could not determine ID after insert`);
      return res.status(500).json({ 
        error: 'could_not_determine_insert_id', 
        message: 'MySQL did not return an ID after INSERT',
        sqlResult: result 
      });
    }
    
    console.log(`[INSERT ${table}] Using ID: ${newId}`);
    
    // Fetch the inserted record
    const [rows] = await pool.query('SELECT * FROM ?? WHERE id = ?', [table, newId]);
    
    if (!rows || !rows[0]) {
      console.warn(`[INSERT ${table}] Could not retrieve inserted record. Returning minimal response.`);
      return res.status(201).json({ id: newId, ...insertPayload });
    }
    
    console.log(`[INSERT ${table}] Successfully retrieved inserted record`);
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create error:', err);
    return res.status(500).json({ error: err.message, details: err.sqlMessage || err.toString() });
  }
});

// Update entity
app.put('/api/entities/:entity/:id', async (req, res) => {
  const table = getTable(req.params.entity);
  if (!table) return res.status(400).json({ error: 'unsupported_entity' });
  const payload = req.body || {};
  try {
    console.log(`\n=== UPDATE ${table} ===`);
    console.log('ID:', req.params.id);
    console.log('Payload:', payload);

    const allowedColumns = await getTableColumns(table);
    if (!allowedColumns.length) {
      return res.status(500).json({ error: 'table_columns_not_loaded', message: `Could not load columns for table ${table}` });
    }

    if (req.params.entity === 'User' && payload.permissions) {
      if (Array.isArray(payload.permissions)) {
        payload.permissions = JSON.stringify(payload.permissions);
      } else if (typeof payload.permissions === 'object') {
        payload.permissions = JSON.stringify(payload.permissions);
      }
    }

    const unknownKeys = Object.keys(payload).filter((key) => !allowedColumns.includes(key));
    if (unknownKeys.length) {
      console.warn(`Dropping unknown keys for ${table}:`, unknownKeys);
    }

    const updatePayload = filterPayloadToColumns(payload, allowedColumns);
    if (!Object.keys(updatePayload).length) {
      return res.status(400).json({ error: 'empty_or_invalid_payload', message: 'No valid columns found for update' });
    }

    let [result] = await pool.query('UPDATE ?? SET ? WHERE id = ?', [table, updatePayload, req.params.id]);
    console.log('Update result:', result);

    // Fallback: allow update by Sn for Pragram if id update did not match
    if (result.affectedRows === 0 && table === 'pragram') {
      [result] = await pool.query('UPDATE ?? SET ? WHERE Sn = ?', [table, payload, req.params.id]);
      console.log('Update result (Sn fallback):', result);
      if (result.affectedRows > 0) {
        const [snRows] = await pool.query('SELECT * FROM ?? WHERE Sn = ? LIMIT 1', [table, req.params.id]);
        return res.json(snRows[0] || { Sn: req.params.id, ...payload });
      }
    }

    if (result.affectedRows === 0) return res.status(404).json({ error: 'not_found' });
    const [rows] = await pool.query('SELECT * FROM ?? WHERE id = ?', [table, req.params.id]);
    return res.json(rows[0] || { id: req.params.id, ...payload });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete entity
app.delete('/api/entities/:entity/:id', async (req, res) => {
  const table = getTable(req.params.entity);
  if (!table) return res.status(400).json({ error: 'unsupported_entity' });
  try {
    console.log(`[DELETE ${table}] Attempting to delete with id: "${req.params.id}"`);
    const [result] = await pool.query('DELETE FROM ?? WHERE id = ? OR Sn = ?', [table, req.params.id, req.params.id]);
    console.log(`[DELETE ${table}] Result:`, { affectedRows: result.affectedRows });
    if (result.affectedRows === 0) {
      console.warn(`[DELETE ${table}] Record not found for id: "${req.params.id}"`);
      return res.status(404).json({ error: 'not_found' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error(`[DELETE ${table}] Error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

// File upload endpoint with multer
app.post('/api/integrations/Core/UploadFile', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      console.error('Upload error: No file provided');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('File uploaded successfully:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Return the file URL (accessible via /uploads/filename)
    const fileUrl = `/uploads/${req.file.filename}`;
    
    return res.json({ 
      success: true,
      file_url: fileUrl,
      url: fileUrl,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Multer error handler middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err);
    return res.status(400).json({ error: 'File upload error: ' + err.message });
  } else if (err) {
    console.error('Upload middleware error:', err);
    return res.status(400).json({ error: 'File upload error: ' + err.message });
  }
  next();
});

// Simple upload endpoint for designer
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `/uploads/${req.file.filename}`;
    
    return res.json({ 
      success: true,
      url: fileUrl
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// PDF generation endpoint
app.post('/generate-pdf', async (req, res) => {
  let browser = null;
  try {
    const { html } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    // Ensure HTML has base URL for image resolution
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const htmlWithBase = html.includes('<base href') 
      ? html 
      : html.replace('<head>', `<head><base href="${baseUrl}/">`);

    // Dynamic import for puppeteer
    const puppeteer = await import('puppeteer');

    // Launch browser without userDataDir (uses ephemeral profile) - avoids EEXIST on shared hosts
    browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    // Set content with base URL for resolving relative URLs
    await page.setContent(htmlWithBase, {
      waitUntil: 'networkidle0',
      timeout: 30000  // 30 second timeout
    });

    // Generate PDF - disable header/footer to show clean page
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: {
        top: '0mm',
        bottom: '0mm',
        left: '0mm',
        right: '0mm'
      }
    });

    await browser.close();
    browser = null;

    // Send PDF as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=report-design.pdf');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    return res.status(500).json({
      error: 'Failed to generate PDF',
      message: err.message
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('Error closing browser:', e);
      }
    }
  }
});

// WhatsApp Direct Mode function - generates wa.me links for browser
app.post('/api/functions/sendWhatsAppDirect', async (req, res) => {
  try {
    const { phone, recipientName, message, pdfUrl } = req.body;
    
    console.log('WhatsApp Direct Mode Request:', { phone, recipientName, message });

    // Get WhatsApp settings from database
    const [settings] = await pool.query('SELECT * FROM appsettings LIMIT 1');
    const appSettings = settings && settings.length > 0 ? settings[0] : null;

    if (!appSettings) {
      return res.status(400).json({ 
        success: false,
        error: 'WhatsApp settings not configured' 
      });
    }

    // Use provided message or get from settings
    const messageText = message || appSettings.whatsapp_direct_message || 'नमस्कार, कृपया संलग्न पत्र देखें:';

    // Build the message with PDF link
    const messageWithLink = `${messageText}\n\n${pdfUrl || ''}`.trim();

    // Generate wa.me link
    const encodedMessage = encodeURIComponent(messageWithLink);
    const waLink = `https://wa.me/${phone}?text=${encodedMessage}`;

    console.log('Generated WhatsApp Link:', waLink);

    return res.json({
      success: true,
      waLink: waLink,
      phone: phone,
      message: messageWithLink
    });

  } catch (err) {
    console.error('WhatsApp Direct Mode error:', err);
    return res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

// Authentication function - handles login and token verification
app.post('/api/functions/operatorAuth', async (req, res) => {
  try {
    const { action, email, password, token } = req.body;

    // Check if database is connected
    if (!pool) {
      console.error('❌ Database pool is null - environment variables not set');
      return res.status(503).json({ 
        success: false,
        error: 'डेटाबेस कनेक्शन विफल - Hostinger में Environment Variables सेट करें',
        details: 'DB_HOST, DB_USER, DB_NAME, DB_PASSWORD आवश्यक हैं'
      });
    }

    if (action === 'login') {
      // Validate input
      if (!email || !password) {
        return res.status(400).json({ 
          success: false,
          error: 'ईमेल और पासवर्ड आवश्यक हैं' 
        });
      }

      // Find operator by email
      const [operators] = await pool.query(
        'SELECT * FROM operator WHERE email = ?',
        [email]
      );

      if (!operators.length) {
        return res.status(401).json({ 
          success: false,
          error: 'ईमेल या पासवर्ड गलत है' 
        });
      }

      const operator = operators[0];

      // Verify password hash
      const hashedPassword = createHash('sha256').update(String(password)).digest('hex');
      if (hashedPassword !== operator.password_hash) {
        return res.status(401).json({ 
          success: false,
          error: 'ईमेल या पासवर्ड गलत है' 
        });
      }

      // Check if operator is active
      if (!operator.is_active) {
        return res.status(403).json({ 
          success: false,
          error: 'यह खाता अक्षम है। व्यवस्थापक से संपर्क करें।' 
        });
      }

      // Generate simple token (email-based for simplicity, can be enhanced with JWT)
      const token = createHash('sha256')
        .update(`${operator.id}-${operator.email}-${Date.now()}`)
        .digest('hex');

      // Update last_login timestamp
      await pool.query(
        'UPDATE operator SET last_login = NOW() WHERE id = ?',
        [operator.id]
      );

      // Parse permissions for response
      let permissions = [];
      try {
        permissions = JSON.parse(operator.permissions || '[]');
      } catch {
        permissions = [];
      }

      // Parse page permissions
      let pagePermissions = [];
      try {
        pagePermissions = JSON.parse(operator.page_permissions || '[]');
      } catch {
        pagePermissions = [];
      }

      // Return success with token and operator data
      return res.json({
        success: true,
        token: token,
        operator: {
          id: operator.id,
          name: operator.name,
          email: operator.email,
          role: operator.role,
          permissions: permissions,
          page_permissions: pagePermissions,
          is_active: operator.is_active
        }
      });

    } else if (action === 'verify') {
      // Simple token verification - in production, use JWT
      // For now, just check if token is provided
      if (!token) {
        return res.status(401).json({ 
          success: false,
          error: 'टोकन गायब है' 
        });
      }

      // In a real implementation, validate the token signature
      // For now, we just verify it's not empty (JWT would verify signature)
      return res.json({
        success: true,
        message: 'टोकन वैलिड है'
      });

    } else if (action === 'logout') {
      // Logout - token becomes invalid
      return res.json({
        success: true,
        message: 'सफलतापूर्वक लॉगआउट'
      });

    } else {
      return res.status(400).json({ 
        success: false,
        error: 'अमान्य कार्य' 
      });
    }

  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ 
      success: false,
      error: 'प्रमाणीकरण में त्रुटि: ' + err.message 
    });
  }
});

// WhatsApp API function
const DEFAULT_BHASHSMS_WHATSAPP_URL = 'https://bhashsms.com/api/sendmsgutil.php?user=Dharfc_bwa&pass=123456&sender=BUZWAP&phone={{Mob}}&text={{Message}}&priority=wa&stype=normal&htype=document&fname=PDF%20File&url={{PdfUrl}}';

app.post('/api/functions/sendWhatsAppPDF', async (req, res) => {
  try {
    const { pdfUrl, phone, recipientName, message } = req.body;
    
    console.log('WhatsApp API Request:', { pdfUrl, phone, recipientName, message });

    // Get WhatsApp PDF API settings from database
    const [settings] = await pool.query('SELECT * FROM appsettings LIMIT 1');
    const appSettings = settings && settings.length > 0 ? settings[0] : null;

    const apiTemplate = (appSettings?.whatsapp_pdf_api_enabled && appSettings?.whatsapp_pdf_api_url)
      ? appSettings.whatsapp_pdf_api_url
      : DEFAULT_BHASHSMS_WHATSAPP_URL;

    if (!apiTemplate) {
      return res.status(400).json({ 
        success: false,
        error: 'WhatsApp PDF API not configured',
        statusCode: 'NOT_CONFIGURED'
      });
    }

    if (!appSettings?.whatsapp_pdf_api_enabled || !appSettings?.whatsapp_pdf_api_url) {
      console.log('Using default BHASHSMS PDF template URL as fallback');
    }

    // Build API URL with placeholder replacement
    let apiUrl = apiTemplate;
    
    const encodedPdf = encodeURI(pdfUrl || '');

    // Replace placeholders first (if template uses them)
    apiUrl = apiUrl.replace(/\{\{Mob\}\}/g, phone || '');
    apiUrl = apiUrl.replace(/\{\{SenderName\}\}/g, encodeURIComponent(recipientName || ''));
    // For PdfUrl, use encodeURI to preserve protocol and slashes, encode spaces
    apiUrl = apiUrl.replace(/\{\{PdfUrl\}\}/g, encodedPdf);

    // Enforce correct query params regardless of placeholders (override any static phone/url)
    try {
      const urlObj = new URL(apiUrl);
      if (phone) urlObj.searchParams.set('phone', phone);
      apiUrl = urlObj.toString();

      // Manually enforce url param with encodeURI(pdfUrl)
      if (pdfUrl) {
        if (/([?&])url=/.test(apiUrl)) {
          apiUrl = apiUrl.replace(/url=[^&]*/i, `url=${encodedPdf}`);
        } else {
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + `url=${encodedPdf}`;
        }
      }

      // Normalize fname spaces to %20 if present
      apiUrl = apiUrl.replace(/fname=([^&]*)/i, (_, v) => `fname=${encodeURIComponent(decodeURIComponent(v.replace(/\+/g, ' ')))}`);
    } catch (e) {
      // Fallback regex replacements if URL parsing fails
      if (phone) {
        if (/([?&])phone=/.test(apiUrl)) {
          apiUrl = apiUrl.replace(/phone=[^&]*/i, `phone=${encodeURIComponent(phone)}`);
        } else {
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + `phone=${encodeURIComponent(phone)}`;
        }
      }
      if (pdfUrl) {
        if (/([?&])url=/.test(apiUrl)) {
          apiUrl = apiUrl.replace(/url=[^&]*/i, `url=${encodedPdf}`);
        } else {
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + `url=${encodedPdf}`;
        }
      }

      // Normalize fname spaces to %20 if present
      apiUrl = apiUrl.replace(/fname=([^&]*)/i, (_, v) => `fname=${encodeURIComponent(decodeURIComponent(v.replace(/\+/g, ' ')))}`);
    }
    
    console.log('Final API URL (normalized):', apiUrl);

    // If debug prompt is enabled, return URL without making the actual call
    if (appSettings?.whatsapp_debug_prompt) {
      console.log('Debug prompt enabled - returning URL for user inspection');
      return res.json({
        success: true,
        debugMode: true,
        debugUrl: apiUrl,
        message: 'डिबग मोड: URL कॉपी करके विश्लेषण करें',
        statusMessage: 'डिबग मोड सक्षम है - URL को अपने ब्राउज़र में खोलने के लिए कॉपी करें',
        timestamp: new Date().toISOString()
      });
    }

    // Call external WhatsApp API
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const responseText = await response.text();
    console.log('WhatsApp API Response Status:', response.status);
    console.log('WhatsApp API Response Body:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { rawResponse: responseText };
    }

    // Map HTTP status codes to user-friendly messages
    let statusMessage = '';
    if (response.ok) {
      statusMessage = 'PDF successfully sent!';
    } else if (response.status === 401) {
      statusMessage = 'Invalid API key or authentication failed';
    } else if (response.status === 400) {
      statusMessage = 'Invalid request format or missing parameters';
    } else if (response.status === 403) {
      statusMessage = 'Phone number not approved for WhatsApp API';
    } else if (response.status === 422) {
      statusMessage = 'Invalid payload or format error';
    } else if (response.status === 429) {
      statusMessage = 'Rate limit exceeded. Please try again later.';
    } else if (response.status >= 500) {
      statusMessage = 'WhatsApp API server error. Please try again later.';
    } else {
      statusMessage = `API returned status ${response.status}`;
    }

    return res.json({
      success: response.ok,
      statusCode: response.status,
      statusMessage: statusMessage,
      data: responseData,
      bhashResponse: responseText,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('WhatsApp API error:', err);
    return res.status(500).json({ 
      success: false,
      error: err.message,
      statusCode: 'NETWORK_ERROR',
      statusMessage: 'Network error: Unable to connect to WhatsApp API. Check your internet or API URL.',
      timestamp: new Date().toISOString()
    });
  }
});

// WhatsApp text-only message function (for bulk messaging - पार्टी कार्यकर्ता)
app.post('/api/functions/sendWhatsAppMessage', async (req, res) => {
  try {
    const { phone, recipientName, message, apiUrl: providedApiUrl } = req.body;
    
    console.log('WhatsApp Text Message Request:', {
      phone,
      recipientName,
      hasMessage: Boolean(message),
      hasProvidedUrl: Boolean(providedApiUrl),
    });

    // Validate required fields. If apiUrl is provided, phone/message are optional.
    if (!providedApiUrl && (!phone || !message)) {
      return res.status(400).json({ 
        success: false,
        error: 'Phone and message are required unless apiUrl is provided',
        statusCode: 'MISSING_PARAMS'
      });
    }

    const [settings] = await pool.query('SELECT * FROM appsettings LIMIT 1');
    const appSettings = settings && settings.length > 0 ? settings[0] : null;

    if (!appSettings || !appSettings.whatsapp_text_api_enabled || !appSettings.whatsapp_text_api_url) {
      return res.status(400).json({ 
        success: false,
        error: 'WhatsApp TEXT API not configured. Please configure in WhatsApp Settings.',
        statusCode: 'NOT_CONFIGURED'
      });
    }

    // Build API URL - if preview URL is provided from UI, send that exact URL.
    let apiUrl = (providedApiUrl || '').trim();
    if (!apiUrl) {
      // Clean phone number - remove any non-digit characters
      let cleanPhone = (phone || '').replace(/\D/g, '');
      // If phone starts with 91 and is 12 digits, remove 91
      if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
        cleanPhone = cleanPhone.substring(2);
      }

      apiUrl = appSettings.whatsapp_text_api_url;
      const encodedMsg = encodeURIComponent(message || '');
      const encodedName = encodeURIComponent(recipientName || '');
      
      // For params: send name and message as plain text (let URL encoding handle it)
      const paramsName = recipientName || '';
      const paramsMessage = message || '';

      // Replace placeholders
      apiUrl = apiUrl.replace(/\{\{Mob\}\}/g, cleanPhone);
      apiUrl = apiUrl.replace(/\{\{Name\}\}/g, encodedName);
      apiUrl = apiUrl.replace(/\{\{Message\}\}/g, encodedMsg);
      apiUrl = apiUrl.replace(/\{\{SenderName\}\}/g, encodedName); // Alias for Name
      apiUrl = apiUrl.replace(/\{\{PdfUrl\}\}/g, ''); // Remove if present

      // Enforce correct query params
      try {
        const urlObj = new URL(apiUrl);
        urlObj.searchParams.set('phone', cleanPhone);
        // Remove PDF params if they exist
        urlObj.searchParams.delete('url');
        urlObj.searchParams.delete('fname');
        urlObj.searchParams.delete('htype');
        // Force text to template name (not message)
        urlObj.searchParams.set('text', 'team_neena_verma9');
        // Remove legacy text-from-message fields if they exist
        urlObj.searchParams.delete('template_id');

        // Manually build params to avoid + symbols for spaces
        // Replace spaces with %20 and keep Hindi text as-is
        const paramsNameEncoded = paramsName.replace(/ /g, '%20');
        const paramsMessageEncoded = paramsMessage.replace(/ /g, '%20');
        const paramsValue = `${paramsNameEncoded},${paramsMessageEncoded}`;
        
        // Don't use searchParams.set for params (it converts spaces to +)
        // Instead, manually add to URL string
        const urlString = urlObj.toString();
        apiUrl = urlString.includes('?') 
          ? `${urlString}&params=${paramsValue}`
          : `${urlString}?params=${paramsValue}`;
      } catch (e) {
        // Fallback regex replacements if URL parsing fails
        if (/([?&])phone=/.test(apiUrl)) {
          apiUrl = apiUrl.replace(/phone=[^&]*/i, `phone=${cleanPhone}`);
        } else {
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + `phone=${cleanPhone}`;
        }

        // Force text and params directly (replace any old message text)
        if (/([?&])text=/.test(apiUrl)) {
          apiUrl = apiUrl.replace(/text=[^&]*/i, 'text=team_neena_verma9');
        } else {
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + 'text=team_neena_verma9';
        }
        
        // Use %20 for spaces instead of + symbol
        const paramsNameEncoded = paramsName.replace(/ /g, '%20');
        const paramsMessageEncoded = paramsMessage.replace(/ /g, '%20');
        const paramsValue = `${paramsNameEncoded},${paramsMessageEncoded}`;
        
        if (/([?&])params=/.test(apiUrl)) {
          apiUrl = apiUrl.replace(/params=[^&]*/i, `params=${paramsValue}`);
        } else {
          apiUrl += (apiUrl.includes('?') ? '&' : '?') + `params=${paramsValue}`;
        }

        apiUrl = apiUrl.replace(/template_id=[^&]*&?/i, '');
      }
    }
    
    console.log('Final Text Message API URL:', apiUrl);

    const fetch = (await import('node-fetch')).default;
    let response;
    response = await fetchWithGatewayRetry(
      fetch,
      apiUrl,
      {
        method: 'GET',
        headers: {
          // Some gateways behave differently for non-browser clients.
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'close',
        },
        redirect: 'follow',
      },
      {
        timeoutMs: WHATSAPP_TEXT_TIMEOUT_MS,
        maxAttempts: WHATSAPP_TEXT_MAX_ATTEMPTS,
      }
    );
    
    const responseText = await response.text();
    console.log('WhatsApp Text Message Response Status:', response.status);
    console.log('WhatsApp Text Message Response Body:', responseText);

    let responseData;
    try { 
      responseData = JSON.parse(responseText); 
    } catch { 
      responseData = { rawResponse: responseText }; 
    }

    // Map HTTP status codes to user-friendly messages
    let statusMessage = '';
    const trimmedBhashResponse = (responseText || '').trim();
    if (response.ok) {
      if (/^S\.\d+$/i.test(trimmedBhashResponse)) {
        statusMessage = 'गेटवे ने अनुरोध स्वीकार किया (Queued)। अंतिम डिलीवरी प्रदाता पर निर्भर है।';
      } else {
        statusMessage = 'संदेश सफलतापूर्वक भेजा गया!';
      }
    } else if (response.status === 401) {
      statusMessage = 'अमान्य API कुंजी या प्रमाणीकरण विफल';
    } else if (response.status === 400) {
      statusMessage = 'अमान्य अनुरोध प्रारूप या गुम पैरामीटर';
    } else if (response.status === 403) {
      statusMessage = 'फोन नंबर WhatsApp API के लिए अनुमोदित नहीं';
    } else if (response.status === 422) {
      statusMessage = 'अमान्य पेलोड या प्रारूप त्रुटि';
    } else if (response.status === 429) {
      statusMessage = 'दर सीमा पार। बाद में पुन: प्रयास करें।';
    } else if (response.status >= 500) {
      statusMessage = 'WhatsApp API सर्वर त्रुटि। बाद में पुन: प्रयास करें।';
    } else {
      statusMessage = `API ने स्थिति ${response.status} लौटाई`;
    }

    return res.json({ 
      success: response.ok, 
      data: responseData, 
      statusCode: response.status,
      statusMessage: statusMessage,
      bhashResponse: responseText,
      queued: /^S\.\d+$/i.test(trimmedBhashResponse),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('sendWhatsAppMessage error:', err);
    const isTimeout = err?.name === 'AbortError' || /aborted/i.test(err?.message || '');
    return res.status(500).json({ 
      success: false, 
      error: err.message,
      statusCode: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      statusMessage: isTimeout
        ? `WhatsApp API timeout: ${Math.round(WHATSAPP_TEXT_TIMEOUT_MS / 1000)} सेकंड में response नहीं मिला।`
        : 'नेटवर्क त्रुटि: WhatsApp API से कनेक्ट नहीं हो सका। अपना इंटरनेट या API URL जांचें।',
      timestamp: new Date().toISOString()
    });
  }
});

// Log WhatsApp send
app.post('/api/functions/logWhatsAppSend', async (req, res) => {
  try {
    const { person_id, type, message, status, response } = req.body || {};
    await pool.query('INSERT INTO whatsapp_log SET ?', [{ person_id, type, message, status, response }]);
    return res.json({ success: true });
  } catch (err) {
    console.error('logWhatsAppSend error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Simple daily scheduler for auto birthday/anniversary wishes at 1:00 PM
function scheduleAutoWishes() {
  let lastRunDate = null; // YYYY-MM-DD

  const runIfDue = async () => {
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${dd}-${mm}`; // unique order not important, just identifier

      if (now.getHours() !== 13 || now.getMinutes() !== 0) return;
      if (lastRunDate === todayStr) return; // already ran today

      // Fetch settings
      const [settings] = await pool.query('SELECT * FROM appsettings LIMIT 1');
      const appSettings = settings && settings.length > 0 ? settings[0] : null;
      if (!appSettings || !appSettings.whatsapp_text_api_enabled || !appSettings.whatsapp_text_api_url) {
        console.warn('AutoWishes: WhatsApp TEXT API not configured, skipping');
        lastRunDate = todayStr;
        return;
      }

      // Find birthdays and anniversaries with AutoAllow
      const month = mm;
      const day = dd;
      const [birthdays] = await pool.query(
        "SELECT * FROM politician WHERE AutoAllow = 1 AND DOB IS NOT NULL AND DATE_FORMAT(DOB, '%m') = ? AND DATE_FORMAT(DOB, '%d') = ?",
        [month, day]
      );
      const [anniversaries] = await pool.query(
        "SELECT * FROM politician WHERE AutoAllow = 1 AND DOA IS NOT NULL AND DATE_FORMAT(DOA, '%m') = ? AND DATE_FORMAT(DOA, '%d') = ?",
        [month, day]
      );

      const fetch = (await import('node-fetch')).default;

      const buildMessage = (templateBody, person) => {
        const repl = (s, k, v) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || '');
        let msg = templateBody || '';
        msg = repl(msg, 'Name', person.Name);
        msg = repl(msg, 'Designation', person.Designation);
        msg = repl(msg, 'Village', person.Village_City);
        msg = repl(msg, 'Village_City', person.Village_City);
        return msg.trim();
      };

      // Load templates (optional by name matching)
      const [templates] = await pool.query('SELECT * FROM lettertemplate');
      const birthdayTpl = templates.find(t => /birthday|जन्मदिन/i.test(t.name)) || null;
      const anniversaryTpl = templates.find(t => /anniversary|विवाह/i.test(t.name)) || null;

      const sendForList = async (list, type) => {
        for (const person of list) {
          const templateBody = type === 'birthday' ? (birthdayTpl?.body || 'जन्मदिन की हार्दिक शुभकामनाएँ, {{Name}}!') : (anniversaryTpl?.body || 'विवाह वर्षगांठ की हार्दिक शुभकामनाएँ, {{Name}}!');
          const message = buildMessage(templateBody, person);
          let status = 'failed';
          let responseText = '';
          try {
            let apiUrl = appSettings.whatsapp_text_api_url;
            apiUrl = apiUrl.replace(/\{\{Mob\}\}/g, person.Mobile || '');
            apiUrl = apiUrl.replace(/\{\{Message\}\}/g, encodeURIComponent(message));
            apiUrl = apiUrl.replace(/\{\{SenderName\}\}/g, encodeURIComponent(person.Name || ''));

            const resp = await fetchWithGatewayRetry(
              fetch,
              apiUrl,
              {
                method: 'GET',
                headers: {
                  'Accept': '*/*',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                  'Accept-Language': 'en-US,en;q=0.9',
                  'Connection': 'close',
                },
                redirect: 'follow',
              },
              {
                timeoutMs: WHATSAPP_TEXT_TIMEOUT_MS,
                maxAttempts: 2,
              }
            );
            responseText = await resp.text();
            status = resp.ok ? 'success' : 'failed';
          } catch (e) {
            responseText = e.message;
            status = 'failed';
          }
          await pool.query('INSERT INTO whatsapp_log SET ?', [{ person_id: person.id, type, message, status, response: responseText }]);
        }
      };

      await sendForList(birthdays, 'birthday');
      await sendForList(anniversaries, 'anniversary');

      console.log(`AutoWishes: Sent ${birthdays.length} birthdays and ${anniversaries.length} anniversaries`);
      lastRunDate = todayStr;
    } catch (err) {
      console.error('AutoWishes error:', err);
    }
  };

  // Check every minute
  setInterval(runIfDue, 60 * 1000);
}


// Catch-all route for SPA - serves React Router routes
// For manual deployment in public_html, Node.js handles all routing
app.use((req, res, next) => {
  // Skip API routes - they're already handled above
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  // Serve index.html for all other routes (React Router handles client-side routing)
  const frontendIndexPath = path.join(__dirname, 'fronthend', 'dist', 'index.html');
  if (fs.existsSync(frontendIndexPath)) {
    res.sendFile(frontendIndexPath);
  } else {
    // If no frontend, show simple status page
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Sandesh API</title></head>
      <body style="font-family: Arial; padding: 50px; text-align: center;">
        <h1>✅ Sandesh API Server Running</h1>
        <p>Frontend dist folder not found.</p>
        <p><a href="/api/health">Check API Health</a></p>
      </body>
      </html>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${PORT}`);
  // Start daily auto-wishes scheduler
  try {
    scheduleAutoWishes();
    console.log('AutoWishes scheduler started');
  } catch (e) {
    console.warn('Failed to start AutoWishes scheduler:', e.message);
  }
});
