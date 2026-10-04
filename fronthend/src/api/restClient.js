// Lightweight REST client for FC-Dhar invitation management system.
// Uses fetch and normalizes common response shapes.

// Get API base URL from environment or default to relative path
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
  // Get token from session storage (cleared on browser restart)
  const token = sessionStorage.getItem('operator_token');
  const operatorData = sessionStorage.getItem('operator_data');
  
  // If we have operator data in localStorage, return it directly
  // This avoids unnecessary server calls and works with the token-based auth
  if (operatorData) {
    try {
      const parsed = JSON.parse(operatorData);

      // Normalize page_permissions to array (handles string, array, null)
      const normalizePages = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try {
            const parsedVal = JSON.parse(val);
            return Array.isArray(parsedVal) ? parsedVal : [];
          } catch (_err) {
            return [];
          }
        }
        return [];
      };

      return {
        ...parsed,
        page_permissions: normalizePages(parsed.page_permissions),
      };
    } catch (e) {
      // If parsing fails, remove corrupted data
      sessionStorage.removeItem('operator_data');
      sessionStorage.removeItem('operator_token');
    }
  }
  
  // If no token, user is not authenticated
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  // In development mode, allow dev token
  if (token === 'dev-token') {
    return {
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
      pages: []
    };
  }
  
  // Otherwise return error to force re-login
  throw new Error('Invalid or expired token');
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
      const opts = { credentials: 'same-origin' };
      if (body) {
        opts.method = 'POST';
        opts.headers = { 'Content-Type': 'application/json' };
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
  const resp = await fetch(`${API_BASE_URL}/entities/${entity}/${id}`, { credentials: 'same-origin' });
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await wrapJson(resp);
  if (!resp.ok) {
    const msg = (json && json.error) ? json.error : 'create failed';
    throw new Error(msg);
  }
  return json;
}

export async function updateEntity(entity, id, payload) {
  const resp = await fetch(`${API_BASE_URL}/entities/${entity}/${id}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error('update failed');
  return await wrapJson(resp);
}

export async function deleteEntity(entity, id) {
  const resp = await fetch(`${API_BASE_URL}/entities/${entity}/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  const json = await wrapJson(resp);
  if (!resp.ok) {
    throw new Error((json && json.error) ? json.error : 'delete failed');
  }
  return json;
}

export async function uploadFile(formData) {
  const resp = await fetch(`${API_BASE_URL}/integrations/Core/UploadFile`, {
    method: 'POST',
    credentials: 'same-origin',
    body: formData,
  });
  return await wrapJson(resp);
}

export async function invokeFunction(name, payload) {
  // API_BASE_URL already includes /api, so just append /functions/
  const resp = await fetch(`${API_BASE_URL}/functions/${encodeURIComponent(name)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await wrapJson(resp);
  
  console.log(`[invokeFunction] ${name} - Status: ${resp.status}, Response:`, json);
  
  if (!resp.ok) {
    throw new Error((json && json.error) ? json.error : `function invocation failed with status ${resp.status}`);
  }
  return json;
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
