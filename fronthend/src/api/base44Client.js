// base44Client compatibility stub
// The real SDK and shim were intentionally removed. The app should use
// `@/api/restClient` and the entity wrappers in `@/api/entities`.

/* eslint-disable */
export const base44 = {
  entities: {},
  auth: {
    me: async () => null,
    redirectToLogin: () => { if (typeof window !== 'undefined') window.location.href = '/OperatorLogin'; }
  },
  integrations: {},
  functions: {},
};

// NOTE: Please delete this file after verifying the app runs without imports
// to this module. Removing the real SDK package and this file keeps the
// repository clean.
