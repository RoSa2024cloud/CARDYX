// Zentrale API-Basis-URL: Lokal auf localhost:4000, online über
// NEXT_PUBLIC_API_URL konfigurierbar (z.B. https://cardyx-api.up.railway.app).
// In frontend/.env.local lokal überschreibbar.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
