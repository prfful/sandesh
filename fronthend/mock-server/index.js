#!/usr/bin/env node
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Ensure we don't send an overly restrictive CSP during development which
// blocks DevTools or other local requests. Set a permissive policy for local
// development so tools can connect. In production the real API will set the
// appropriate CSP.
app.use((req, res, next) => {
  try {
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' http: https: data:");
  } catch (e) {
    // ignore
  }
  next();
});

// Log incoming requests for debugging
app.use((req, res, next) => {
  // eslint-disable-next-line no-console
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    // eslint-disable-next-line no-console
    console.log('  body:', JSON.stringify(req.body).slice(0, 1000));
  }
  next();
});

const port = process.env.PORT || 3000;

// Simple mock auth endpoints
app.get('/api/auth/isAuthenticated', (req, res) => {
  return res.json({ authenticated: true });
});

app.get('/api/auth/me', (req, res) => {
  return res.json({ id: 'dev', name: 'Developer', role: 'admin', permissions: {
    can_add_program: true,
    can_edit_program: true,
    can_view_reminder: true,
    can_mark_attended: true,
    can_generate_letter: true,
  }});
});

// In-memory entity store for CRUD operations
const store = {
  // ProgramType: seed with numeric IDs to match production DB (1001..1015)
  ProgramType: [],
  Pragram: [],
  LetterTemplate: [],
  LetterSettings: [],
  AppSettings: [],
  Operator: [],
};

// Optionally seed the Pragram entity with many items to simulate your DB.
// If SEED_PROGRAMS is not set, default to 5000 in non-production for convenience.
let seedCount = parseInt(process.env.SEED_PROGRAMS || '0', 10);
if (!seedCount && process.env.NODE_ENV !== 'production') {
  seedCount = 5000;
}
if (seedCount > 0) {
  const now = Date.now();
  // Define a canonical list of program types (IDs and Hindi labels)
  const programTypeDefs = [
    ['1001', 'विवाह'],
    ['1002', 'पगडी'],
    ['1003', 'प्रवचन'],
    ['1004', 'शिविर'],
    ['1005', 'सत्संग'],
    ['1006', 'खेलकूद'],
    ['1007', 'रक्तदान'],
    ['1008', 'संगीत'],
    ['1009', 'शिक्षा'],
    ['1010', 'बैठक'],
    ['1011', 'समारोह'],
    ['1012', 'दौरा'],
    ['1013', 'अभियान'],
    ['1014', 'सेमिनार'],
    ['1015', 'अन्य']
  ];

  // Seed ProgramType store entries with both `id` and `data.Programtyp`.
  store.ProgramType = programTypeDefs.map(([id, name]) => ({ id: String(id), Programtyp: name, data: { Programtyp: name } }));

  for (let i = 0; i < seedCount; i++) {
    const pt = programTypeDefs[i % programTypeDefs.length];
    const ptId = String(pt[0]);
    const ptName = pt[1];
    store.Pragram.push({
      id: `pg_${now}_${i}`,
      Sn: i + 1,
      // include both lowercase 'programtyp' (used in app) and 'Programtyp' for compatibility
      programtyp: ptId,
      Programtyp: ptId,
      programtyp_name: ptName,
      Mob: `90000${String(i).padStart(5, '0')}`,
      Date: new Date(Date.now() + (i - seedCount/2) * 24*60*60*1000).toISOString(),
      detail: `डमी कार्यक्रम विवरण ${i+1}`,
      sended: false,
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded Pragram with ${seedCount} records`);
  // eslint-disable-next-line no-console
  console.log(`Pragram store length after seeding: ${store.Pragram.length}`);
}

// List entities
app.get('/api/entities/:entity', (req, res) => {
  const entity = req.params.entity;
  const list = store[entity] || [];
  return res.json(list);
});

// Also support GET /api/entities/:entity/list
app.get('/api/entities/:entity/list', (req, res) => {
  const entity = req.params.entity;
  const list = store[entity] || [];
  return res.json(list);
});

// Some SDKs call a POST endpoint to list entities (e.g. /api/entities/Pragram/list)
app.post('/api/entities/:entity/list', (req, res) => {
  const entity = req.params.entity;
  const list = store[entity] || [];
  return res.json(list);
});

// Get single entity
app.get('/api/entities/:entity/:id', (req, res) => {
  const { entity, id } = req.params;
  const list = store[entity] || [];
  const found = list.find((it) => it.id === id);
  if (!found) return res.status(404).json({ error: 'not_found' });
  return res.json(found);
});

// Create entity
app.post('/api/entities/:entity', (req, res) => {
  const entity = req.params.entity;
  // Some SDKs POST with an empty body or special action to request a list.
  const bodyKeys = req.body && Object.keys(req.body || {});
  if (!bodyKeys || bodyKeys.length === 0 || req.body.action === 'list') {
    const list = store[entity] || [];
    return res.json(list);
  }
  const id = Date.now().toString();
  const record = { id, ...req.body };
  store[entity] = store[entity] || [];
  store[entity].push(record);
  return res.status(201).json(record);
});

// Update entity
app.put('/api/entities/:entity/:id', (req, res) => {
  const { entity, id } = req.params;
  const list = store[entity] || [];
  const idx = list.findIndex((it) => it.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  list[idx] = { ...list[idx], ...req.body };
  return res.json(list[idx]);
});

// Delete entity
app.delete('/api/entities/:entity/:id', (req, res) => {
  const { entity, id } = req.params;
  store[entity] = (store[entity] || []).filter((it) => it.id !== id);
  return res.json({ success: true });
});

// Catch-all for other API calls
// Generic catch-all for other API calls under /api
// Integrations: file upload endpoint used by the frontend
app.post('/api/integrations/Core/UploadFile', (req, res) => {
  // Return a dummy file URL where the frontend expects file_url
  const fileUrl = `http://localhost:${port}/files/${Date.now()}.pdf`;
  return res.json({ file_url: fileUrl });
});

// Functions invocation (e.g., functions.invoke('sendWhatsAppPDF', {...}))
app.post('/api/functions/:name', (req, res) => {
  const name = req.params.name;
  // Respond with a generic success payload. Customize per function if needed.
  return res.json({ success: true, function: name, result: {} });
});

// Catch-all for other /api requests
// Provide a friendly root so visiting http://localhost:3000 shows useful info
app.get('/', (req, res) => {
  return res.send('Mock API running. Use /api or /__debug__/store for details.');
});

// Improve the /api catch-all: for GET /api return a health/summary payload so
// callers receive useful information instead of an empty object. Non-GET
// requests still echo back a success payload.
app.use('/api', (req, res) => {
  if (req.method === 'GET' && (req.path === '/' || req.path === '')) {
    const summary = Object.fromEntries(Object.keys(store).map(k => [k, (store[k] || []).length]));
    return res.json({ healthy: true, message: 'Mock API root', summary });
  }
  return res.json({ success: true, body: req.body });
});

// Debug endpoint to inspect in-memory store
app.get('/__debug__/store', (req, res) => {
  const summary = Object.fromEntries(Object.keys(store).map(k => [k, (store[k] || []).length]));
  return res.json({ summary });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Mock API running on http://localhost:${port}`);
});
