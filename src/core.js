/**
 * Z85 (ZeroMQ Base85) encoder/decoder.
 *
 * Z85 is a Base85 variant designed for ZeroMQ RFC 32. It maps 4-byte groups
 * to 5-character groups using an 85-symbol alphabet. The alphabet excludes
 * characters that are problematic in source code and configuration files:
 * quotes, backslash, backtick, and non-printable characters.
 *
 * Key constraint: input length must be a multiple of 4 bytes for encoding,
 * and encoded length must be a multiple of 5 characters for decoding. This
 * library rejects input that does not meet this constraint rather than
 * padding, because ZeroMQ peers will reject padded data anyway and silent
 * corruption is worse than a loud error.
 */

const Z85_ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';

// Precompute the reverse lookup table once at module load. Using a plain
// object gives O(1) lookups and avoids scanning the alphabet string per char.
const Z85_REVERSE = (() => {
  const map = Object.create(null);
  for (let i = 0; i < Z85_ALPHABET.length; i++) {
    map[Z85_ALPHABET.charCodeAt(i)] = i;
  }
  return map;
})();

/**
 * Encode 4 bytes into 5 Z85 characters.
 *
 * The algorithm treats the 4 bytes as a big-endian 32-bit unsigned integer,
 * then repeatedly divides by 85, collecting remainders. The least
 * significant remainder maps to the last character, so we write backwards.
 *
 * @param {number} b0 - Most significant byte.
 * @param {number} b1 - Second byte.
 * @param {number} b2 - Third byte.
 * @param {number} b3 - Least significant byte.
 * @returns {string} 5-character Z85 group.
 */
function encodeGroup(b0, b1, b2, b3) {
  // Combine into a 32-bit value. Using multiplication and bitwise-OR is
  // safe here because each byte is 0-255, so intermediate products stay
  // within Number.MAX_SAFE_INTEGER.
  let value = (b0 * 256 * 256 * 256) + (b1 * 256 * 256) + (b2 * 256) + b3;
  const out = [' ', ' ', ' ', ' ', ' '];
  for (let i = 4; i >= 0; i--) {
    const rem = value % 85;
    value = (value - rem) / 85;
    out[i] = Z85_ALPHABET[rem];
  }
  return out.join('');
}

/**
 * Decode 5 Z85 characters into 4 bytes.
 *
 * @param {string} group - Exactly 5 Z85 characters.
 * @returns {number[]} Array of 4 byte values.
 */
function decodeGroup(group) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const code = group.charCodeAt(i);
    const idx = Z85_REVERSE[code];
    if (idx === undefined) {
      throw new Error(`Invalid Z85 character at position ${i}: ${JSON.stringify(group[i])}`);
    }
    value = value * 85 + idx;
  }
  // Extract bytes big-endian. value is at most 85^5 - 1 = 4437053124,
  // which exceeds 32 bits, so we mask to 32 bits to be safe.
  value = value >>> 0;
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

/**
 * Encode a Uint8Array to a Z85 string.
 *
 * @param {Uint8Array} bytes - Binary data. Length must be a multiple of 4.
 * @returns {string} Z85-encoded string.
 * @throws {Error} If length is not a multiple of 4.
 */
export function encode(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('encode expects a Uint8Array');
  }
  if (bytes.length % 4 !== 0) {
    throw new Error(`Z85 input length must be a multiple of 4, got ${bytes.length}`);
  }
  let result = '';
  for (let i = 0; i < bytes.length; i += 4) {
    result += encodeGroup(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
  }
  return result;
}

/**
 * Decode a Z85 string to a Uint8Array.
 *
 * @param {string} str - Z85-encoded string. Length must be a multiple of 5.
 * @returns {Uint8Array} Decoded binary data.
 * @throws {Error} If length is not a multiple of 5 or contains invalid characters.
 */
export function decode(str) {
  if (typeof str !== 'string') {
    throw new TypeError('decode expects a string');
  }
  if (str.length % 5 !== 0) {
    throw new Error(`Z85 input length must be a multiple of 5, got ${str.length}`);
  }
  const out = new Uint8Array((str.length / 5) * 4);
  let pos = 0;
  for (let i = 0; i < str.length; i += 5) {
    const group = decodeGroup(str.slice(i, i + 5));
    out[pos++] = group[0];
    out[pos++] = group[1];
    out[pos++] = group[2];
    out[pos++] = group[3];
  }
  return out;
}

/**
 * Encode a hex string to Z85.
 *
 * Convenience wrapper for callers that work with hex-encoded keys (common
 * in ZeroMQ CURVE security setups).
 *
 * @param {string} hex - Hex string (even length, multiple of 8 chars).
 * @returns {string} Z85-encoded string.
 */
export function encodeFromHex(hex) {
  if (typeof hex !== 'string') {
    throw new TypeError('encodeFromHex expects a string');
  }
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`Invalid hex digit at position ${i}`);
    }
    bytes[i / 2] = byte;
  }
  return encode(bytes);
}

/**
 * Decode a Z85 string to a hex string.
 *
 * @param {string} str - Z85-encoded string.
 * @returns {string} Lowercase hex string.
 */
export function decodeToHex(str) {
  const bytes = decode(str);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Object-oriented interface for callers who prefer it.
 */
export const Z85_ENCODER = {
  encode,
  decode,
  encodeFromHex,
  decodeToHex,
};
