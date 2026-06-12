// One-off generator of VAPID keys for web push (S16).
// Usage: node scripts/generate-vapid-keys.mjs
// Prints:
//  1) VAPID_KEYS — JSON with both JWK keys → Supabase Edge Function secret
//  2) VITE_VAPID_PUBLIC_KEY — base64url raw P-256 public key → .env.local / Vercel env
import { webcrypto } from "node:crypto";

const { subtle } = webcrypto;

const pair = await subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);
const publicKey = await subtle.exportKey("jwk", pair.publicKey);
const privateKey = await subtle.exportKey("jwk", pair.privateKey);

// applicationServerKey for PushManager.subscribe: 0x04 || x || y (base64url)
const raw = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(publicKey.x, "base64url"),
  Buffer.from(publicKey.y, "base64url"),
]);

console.log("VAPID_KEYS=" + JSON.stringify({ publicKey, privateKey }));
console.log("VITE_VAPID_PUBLIC_KEY=" + raw.toString("base64url"));
