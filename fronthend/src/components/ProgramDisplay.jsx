import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ProgramType } from "@/api/entities";

// Helper component to display program type name from ID
export default function ProgramTypeDisplay({ programTypeId }) {
  // Fetch program types from local API (tries common endpoints).
  const fetchProgramTypes = async () => {
    const tryUrls = ['/api/entities/ProgramType', '/api/programtypes', '/api/entities/ProgramType/list'];
    for (const url of tryUrls) {
      try {
        const resp = await fetch(url, { credentials: 'same-origin' });
        if (!resp.ok) continue;
        const json = await resp.json();
        if (!json) continue;
        // If envelope, unwrap
        if (Array.isArray(json)) return json;
        if (Array.isArray(json.data)) return json.data;
        if (Array.isArray(json.results)) return json.results;
        if (typeof json === 'object') return Object.values(json);
      } catch (e) {
        // try next
      }
    }
    return [];
  };

  const { data: programTypes = [] } = useQuery({
    queryKey: ['program-types'],
    queryFn: fetchProgramTypes,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  // Normalize the shape returned by the SDK: some SDK versions return an
  // array, others return an object with a `data`/`results`/`items` property,
  // or even a keyed object. Coerce into an array for safe iteration.
  const normalizeList = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;

    // Common SDK envelopes
    if (v.data) {
      if (Array.isArray(v.data)) return v.data;
      if (v.data && typeof v.data === 'object' && (v.data.programtyp || v.data.Programtyp || v.data.id || v.data._id)) return [v.data];
      // fallback: if data contains results/items
      if (v.data.results && Array.isArray(v.data.results)) return v.data.results;
      if (v.data.items && Array.isArray(v.data.items)) return v.data.items;
    }
    if (v.results && Array.isArray(v.results)) return v.results;
    if (v.items && Array.isArray(v.items)) return v.items;
    if (v.rows && Array.isArray(v.rows)) return v.rows;

    if (typeof v === 'object') {
      const entries = Object.entries(v);
      const vals = entries.map(([, val]) => val);
      const allPrimitives = vals.every(x => x === null || (typeof x !== 'object'));
      if (allPrimitives) {
        // { "1001": true } -> [{ id: '1001', Programtyp: '1001' }]
        // If the primitive value is a generic meta string (success/ok/true)
        // prefer the key as the label so UI shows meaningful names.
        return entries.map(([k, val]) => ({
          id: k,
          programtyp: (typeof val === 'string' && /^(success|ok|true|false|error)$/i.test(val.trim())) ? String(k) : (typeof val === 'string' ? val : String(k))
        }));
      }

      const out = [];
      for (const [k, val] of entries) {
        if (val == null) continue;
        if (typeof val !== 'object') {
          const prim = String(val);
          const label = /^(success|ok|true|false|error)$/i.test(prim.trim()) ? k : prim;
          out.push({ id: k, programtyp: String(label) });
          continue;
        }

        // If wrapper like { success: true, data: {...} }
        if (val.success && val.data) {
          const d = val.data;
          if (Array.isArray(d)) {
            out.push(...d);
            continue;
          }
          if (d && typeof d === 'object') {
            out.push({ id: d.id ?? d._id ?? k, programtyp: d.programtyp ?? d.Programtyp ?? String(k), ...d });
            continue;
          }
        }

        // If nested 'data' object
        if (val.data && typeof val.data === 'object' && (val.data.programtyp || val.data.Programtyp || val.data.id)) {
          const d = val.data;
          out.push({ id: d.id ?? d._id ?? k, programtyp: d.programtyp ?? d.Programtyp ?? String(k), ...d });
          continue;
        }

        // If the value itself looks like a ProgramType
        if (val.programtyp || val.Programtyp || val.id || val._id) {
          out.push({ id: val.id ?? val._id ?? k, programtyp: val.programtyp ?? val.Programtyp ?? String(k), ...val });
          continue;
        }

        // Fallback: represent key as a programtyp label
        out.push({ id: k, programtyp: String(k) });
      }
      return out;
    }
    return [];
  };

  const pts = normalizeList(programTypes);

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[ProgramDisplay] raw programTypes:', programTypes);
    // eslint-disable-next-line no-console
    console.debug('[ProgramDisplay] normalized pts:', pts.slice ? pts.slice(0, 20) : pts);
  }

  // Be forgiving about types: DB / SDK may return numeric IDs, hex strings or the
  // actual programtyp name. Compare by stringified id first, then fall back to
  // matching by the programtyp name. This handles changes from hex -> numeric ids
  // (e.g. 1001..1015) and avoids missing labels on the dashboard.
  const programType = pts.find(pt => String(pt.id) === String(programTypeId))
    || pts.find(pt => pt.programtyp === programTypeId || pt.Programtyp === programTypeId);

  return programType?.programtyp || programType?.Programtyp || programTypeId || "-";
}

// Hook to get program type name
export function useProgramTypeName(programTypeId) {
  const { data: programTypes = [] } = useQuery({
    queryKey: ['program-types'],
    queryFn: () => ProgramType.list(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const normalizeList = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (v.data && Array.isArray(v.data)) return v.data;
    if (v.results && Array.isArray(v.results)) return v.results;
    if (v.items && Array.isArray(v.items)) return v.items;
    if (v.rows && Array.isArray(v.rows)) return v.rows;
    if (typeof v === 'object') return Object.values(v);
    return [];
  };

  const pts = normalizeList(programTypes);

  const programType = pts.find(pt => String(pt.id) === String(programTypeId))
    || pts.find(pt => pt.programtyp === programTypeId || pt.Programtyp === programTypeId);
  return programType?.programtyp || programType?.Programtyp || programTypeId || "-";
}

// Hook to get all program types as a map (UUID -> Hindi name)
export function useProgramTypesMap() {
  const { data: programTypes = [] } = useQuery({
    queryKey: ['program-types'],
    queryFn: () => ProgramType.list(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const map = React.useMemo(() => {
    const normalizeList = (v) => {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (v.data && Array.isArray(v.data)) return v.data;
      if (v.results && Array.isArray(v.results)) return v.results;
      if (v.items && Array.isArray(v.items)) return v.items;
      if (v.rows && Array.isArray(v.rows)) return v.rows;
      if (typeof v === 'object') return Object.values(v);
      return [];
    };
    const pts = normalizeList(programTypes);
    const result = {};
    // Only map ID -> name to avoid duplicates in dropdowns
    pts.forEach(pt => {
      const name = pt.programtyp || pt.Programtyp || (pt.data && pt.data.programtyp) || (pt.data && pt.data.Programtyp);
      if (pt.id && name) {
        result[String(pt.id)] = name;
      }
    });
    return result;
  }, [programTypes]);
  
  return map;
}