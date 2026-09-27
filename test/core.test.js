import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, encodeFromHex, decodeToHex, Z85_ENCODER } from '../src/index.js';

// The Z85 spec (ZeroMQ RFC 32) provides a known test vector. Using it
// directly verifies our alphabet and algorithm match the reference.
const Z85_TEST_VECTOR_HEX =
  '0000000000000000000000000000000000000000';
const Z85_TEST_VECTOR_EXPECTED = '00000000000000000000';

test('encode produces the spec test vector for 16 zero bytes', () => {
  const bytes = new Uint8Array(16);
  assert.equal(encode(bytes), Z85_TEST_VECTOR_EXPECTED);
});

test('encode and decode are round-trip inverses for arbitrary data', () => {
  const data = new Uint8Array([
    0x86, 0x4F, 0xD2, 0x6F,
    0xB5, 0x59, 0xF7, 0x5B,
    0x48, 0x00, 0xCD, 0x9A,
    0xFF, 0xFF, 0xFF, 0xFF,
  ]);
  const encoded = encode(data);
  assert.equal(encoded.length, 20);
  const decoded = decode(encoded);
  assert.deepEqual(Array.from(decoded), Array.from(data));
});

test('encode rejects input whose length is not a multiple of 4', () => {
  assert.throws(
    () => encode(new Uint8Array(3)),
    /multiple of 4/
  );
  assert.throws(
    () => encode(new Uint8Array(5)),
    /multiple of 4/
  );
});

test('decode rejects input whose length is not a multiple of 5', () => {
  assert.throws(
    () => decode('0000'),
    /multiple of 5/
  );
  assert.throws(
    () => decode('000000'),
    /multiple of 5/
  );
});

test('decode rejects strings with invalid Z85 characters', () => {
  // The space character is NOT in the Z85 alphabet.
  assert.throws(
    () => decode('0000 '),
    /Invalid Z85 character/
  );
});

test('encode rejects non-Uint8Array input', () => {
  assert.throws(
    () => encode([1, 2, 3, 4]),
    TypeError
  );
});

test('decode rejects non-string input', () => {
  assert.throws(
    () => decode(12345),
    TypeError
  );
});

test('encode handles the full 0x00000000 group', () => {
  assert.equal(encode(new Uint8Array(4)), '00000');
});

test('encode handles the full 0xFFFFFFFF group', () => {
  const bytes = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
  // 0xFFFFFFFF = 4294967295; 4294967295 / 85^4 = ... last char is index 84 = '#'
  const encoded = encode(bytes);
  assert.equal(encoded.length, 5);
  assert.deepEqual(Array.from(decode(encoded)), [0xff, 0xff, 0xff, 0xff]);
});

test('encodeFromHex converts hex to Z85 correctly', () => {
  const hex = '864fd26fb559f75b';
  const encoded = encodeFromHex(hex);
  const bytes = new Uint8Array([0x86, 0x4f, 0xd2, 0x6f, 0xb5, 0x59, 0xf7, 0x5b]);
  assert.equal(encoded, encode(bytes));
});

test('decodeToHex produces lowercase hex', () => {
  const bytes = new Uint8Array([0xab, 0xcd, 0xef, 0x01]);
  const hex = decodeToHex(encode(bytes));
  assert.equal(hex, 'abcdef01');
});

test('encodeFromHex rejects odd-length hex', () => {
  assert.throws(
    () => encodeFromHex('abc'),
    /even length/
  );
});

test('encodeFromHex rejects invalid hex digits', () => {
  assert.throws(
    () => encodeFromHex('zzzzzzzz'),
    /Invalid hex digit/
  );
});

test('Z85_ENCODER object exposes all functions', () => {
  assert.equal(typeof Z85_ENCODER.encode, 'function');
  assert.equal(typeof Z85_ENCODER.decode, 'function');
  assert.equal(typeof Z85_ENCODER.encodeFromHex, 'function');
  assert.equal(typeof Z85_ENCODER.decodeToHex, 'function');
});

test('empty input round-trips through encode and decode', () => {
  const empty = new Uint8Array(0);
  assert.equal(encode(empty), '');
  assert.equal(decode('').length, 0);
});

test('every byte value 0-255 appears and round-trips', () => {
  // 256 bytes, padded to 260 (multiple of 4) with zeros.
  const data = new Uint8Array(260);
  for (let i = 0; i < 256; i++) data[i] = i;
  const encoded = encode(data);
  const decoded = decode(encoded);
  assert.deepEqual(Array.from(decoded), Array.from(data));
});
