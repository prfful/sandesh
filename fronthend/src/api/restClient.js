// Lightweight REST client for FC-Dhar invitation management system.
// Uses fetch and normalizes common response shapes.

// Get API base URL from environment or default to relative path
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const authHeaders = (headers = {}) => {
  const token = sessionStorage.getItem('operator_token');
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
};

const wrapJson = async (resp) => {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
};

const normalizeList = (json) => {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (json.data && Array.isArray(json.data)) return json.data;
  if (json.results && Array.isArray(json.results)) return json.results;
  if (typeof json === 'object') return Object.values(json);
  return [];
};

// Ensure Pragram records always carry a usable `id` field from actual database id field
// If no id exists, use Sn as fallback (for legacy databases without id column)
const normalizePragramId = (record) => {
  if (!record) return record;

  const rawId = record.id ?? record.ID ?? record.Id ?? record.pragram_id ?? record.pragramId ?? record.programId ?? record.uuid ?? record.UUID;

  if (rawId === undefined || rawId === null || rawId === '') {
    // If no id found, use Sn as fallback for tables without id column
    if (record.Sn) {
      return { ...record, id: record.Sn };
    }
    // DO NOT fake id if Sn also missing
    return record;
  }

  if (record.id === rawId) return record;

  return { ...record, id: rawId };
};

export async function authMe() {
  const token = sessionStorage.getItem('operator_token');
  if (!token) {
    throw new Error('Not authenticated');
  }

  const resp = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'same-origin',
    headers: authHeaders(),
  });
  const json = await wrapJson(resp);
  if (!resp.ok) {
    sessionStorage.removeItem('operator_data');
    sessionStorage.removeItem('operator_token');
    throw new Error(json?.error || 'Invalid or expired token');
  }

  return json;
}

export async function listEntities(entity, body = null) {
  // Try common endpoints
  const urls = [
    `${API_BASE_URL}/entities/${entity}`,
    `${API_BASE_URL}/entities/${entity}/list`,
    `${API_BASE_URL}/${entity.toLowerCase()}`,
    `${API_BASE_URL}/${entity}`,
  ];
  for (const url of urls) {
    try {
      const opts = { credentials: 'same-origin', headers: authHeaders() };
      if (body) {
        opts.method = 'POST';
        opts.headers = authHeaders({ 'Content-Type': 'application/json' });
        opts.body = JSON.stringify(body);
      }
      const resp = await fetch(url, opts);
      if (!resp.ok) continue;
      const json = await wrapJson(resp);
      const list = normalizeList(json);
      if (list.length || Array.isArray(json)) {
        // Normalize program IDs to avoid null/undefined id downstream
        if (entity === 'Pragram') {
          return list.map(normalizePragramId);
        }
        return list;
      }
    } catch (e) {
      // try next
    }
  }
  return [];
}

export async function getEntity(entity, id) {
  const resp = await fetch(`${API_BASE_URL}/entities/${entity}/${id}`, {
    credentials: 'same-origin',
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error('not found');

  const json = await wrapJson(resp);

  // Normalize Pragram responses to ensure id field is properly set
  if (entity === 'Pragram') {
    if (json?.data) return normalizePragramId(json.data);
    return normalizePragramId(json);
  }
  return json;
}

export async function createEntity(entity, payload) {
  const resp = await fetch(`${API_BASE_URL}/entities/${entity}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await wrapJson(resp);
  if (!resp.ok) {
    const msg = (json && (json.message || json.error)) ? (json.message || json.error) : 'create failed';
    throw new Error(msg);
  }
  return json;
}

export async function updateEntity(entity, id, payload) {
  const resp = await fetch(`${API_BASE_URL}/entities/${entity}/${id}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await wrapJson(resp);
  if (!resp.ok) {
    throw new Error((json && (json.message || json.error)) ? (json.message || json.error) : 'update failed');
  }
  return json;
}

export async function deleteEntity(entity, id) {
  const resp = await fetch(`${API_BASE_URL}/entities/${entity}/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: authHeaders(),
  });
  const json = await wrapJson(resp);
  if (!resp.ok) {
    throw new Error((json && (json.message || json.error)) ? (json.message || json.error) : 'delete failed');
  }
  return json;
}

export async function uploadFile(formData) {
  const resp = await fetch(`${API_BASE_URL}/integrations/Core/UploadFile`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: authHeaders(),
    body: formData,
  });
  return await wrapJson(resp);
}

export async function invokeFunction(name, payload) {
  // API_BASE_URL already includes /api, so just append /functions/
  const url = `${API_BASE_URL}/functions/${encodeURIComponent(name)}`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const json = await wrapJson(resp);

    console.log(`[invokeFunction] ${name} - Status: ${resp.status}`);

    if (!resp.ok) {
      throw new Error((json && json.error) ? json.error : `function invocation failed with status ${resp.status}`);
    }
    return json;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const networkHint = `API unavailable at ${url}. Start the backend with "npm run api" and ensure MySQL is reachable.`;
    console.error(`[invokeFunction] ${name} failed:`, message);
    throw new Error(message.includes('Failed to fetch') ? networkHint : message);
  }
}

export default {
  authMe,
  listEntities,
  getEntity,
  createEntity,
  updateEntity,
  deleteEntity,
  uploadFile,
  invokeFunction,
};
