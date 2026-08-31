// =====================================================
// PLATAFORMA LUJAV · password.ts
// Hashing + verificación de contraseñas con scrypt
// Ajustado a la tabla users.password_hash (PostgreSQL)
// Usa crypto nativo de Node (sin dependencias extra: bcrypt)
// Formato Modular Crypt Format compatible:
//   $scrypt$N=$N$r=$r$p=$p$${salt_b64}$${hash_b64}
// =====================================================

import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export interface PasswordHashOptions {
  N?: number; // CPU/memory cost (potencia de 2, default 2^14 = 16384)
  r?: number; // block size (default 8)
  p?: number; // parallelism (default 1)
  keyLen?: number; // output hash length bytes (default 32 = 256 bits)
  saltLen?: number; // salt bytes length (default 16 = 128 bits)
}

const DEFAULT_OPTIONS: Required<Omit<PasswordHashOptions, "keyLen">> & {
  keyLen: number;
} = {
  N: 16384,
  r: 8,
  p: 1,
  keyLen: 32,
  saltLen: 16,
};

/**
 * Convierte un Buffer a base64url (sin padding = , para que
 * sea compatible con el formato que guardamos en DB como TEXT.
 */
function toB64u(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64u(str: string): Buffer {
  const padded =
    str + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(
    padded.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );
}

/**
 * Genera el hash scrypt de una contraseña + salt aleatorio nuevo
 * Devuelve un STRING listo para INSERTAR en users.password_hash.
 *
 *   hashPassword("miClaveSecreta123")
 *   => "$scrypt$N=16384$r=8$p=1$...salt...$...hash..."
 *
 * @param plaintext Contraseña en claro (del input del SignupForm / Password)
 */
export function hashPassword(
  plaintext: string,
  opts: PasswordHashOptions = {}
): string {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const { N, r, p, keyLen, saltLen } = options;

  const salt = randomBytes(saltLen);
  const derived = scryptSync(plaintext, salt, keyLen, { N, r, p, maxmem: 128 * 1024 * 1024 });

  return [
    "$scrypt",
    `N=${N}`,
    `r=${r}`,
    `p=${p}`,
    toB64u(salt),
    toB64u(derived),
  ].join("$");
}

/**
 * Verifica una contraseña en claro contra un hash MCf guardado.
 * Usa timingSafeEqual para evitar ataques de timing.
 *
 * @param plaintext contraseña escrita por el usuario en Login
 * @param storedHash valor de users.password_hash leído de PostgreSQL
 */
export function verifyPassword(
  plaintext: string,
  storedHash: string
): boolean {
  try {
    if (typeof storedHash !== "string" || !storedHash.startsWith("$scrypt$")) {
      return false;
    }

    // Partir: $scrypt$N=X$r=Y$p=Z$salt$hash
    const parts = storedHash.split("$");
    // parts: [ "", "scrypt", "N=X", "r=Y", "p=Z", salt, hash ]
    if (parts.length !== 7 || parts[1] !== "scrypt") {
      return false;
    }

    const N = parseInt(parts[2].split("=")[1] ?? "0", 10);
    const r = parseInt(parts[3].split("=")[1] ?? "0", 10);
    const p = parseInt(parts[4].split("=")[1] ?? "0", 10);
    const salt64 = parts[5];
    const hash64 = parts[6];

    if (!N || !r || !p || !salt64 || !hash64) {
      return false;
    }

    const salt = fromB64u(salt64);
    const expected = fromB64u(hash64);
    const keyLen = expected.length;

    const actual = scryptSync(plaintext, salt, keyLen, {
      N,
      r,
      p,
      maxmem: 128 * 1024 * 1024,
    });

    // timingSafeEqual: compara longitudes primero.
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    // Cualquier excepción (hash mal formato, params inválidos) => NO coincide
    return false;
  }
}
