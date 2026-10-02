# Z85 ZeroMQ Encoder

Encodes and decodes the Z85 Base85 variant used by ZeroMQ (RFC 32). Z85 maps every 4 bytes to 5 printable characters using an 85-symbol alphabet that avoids quotes, backslash, and backtick, making the output safe to embed in source code, config files, and CURVE key material.

## Usage

```js
import { encode, decode, encodeFromHex, decodeToHex } from './src/index.js';

const bytes = new Uint8Array([0x86, 0x4f, 0xd2, 0x6f, 0xb5, 0x59, 0xf7, 0x5b]);
const encoded = encode(bytes);        // "r^!/-n!Pp<"
const decoded = decode(encoded);      // Uint8Array [134, 79, 210, 111, 181, 89, 247, 91]

// Convenience wrappers for hex-encoded keys (common in ZeroMQ CURVE):
const z85 = encodeFromHex('864fd26fb559f75b');
const hex = decodeToHex(z85);         // "864fd26fb559f75b"
```

## Exports

- `encode(bytes: Uint8Array): string` — bytes to Z85. Length must be a multiple of 4.
- `decode(str: string): Uint8Array` — Z85 to bytes. Length must be a multiple of 5.
- `encodeFromHex(hex: string): string` — hex string to Z85.
- `decodeToHex(str: string): string` — Z85 to lowercase hex.
- `Z85_ENCODER` — object wrapping all four functions.

## Why this exists

ZeroMQ uses Z85 for CURVE public/secret keys and other binary data that must travel over text channels. If you are interoperating with ZeroMQ peers, you need this exact alphabet and this exact 4-to-5 block alignment — standard Base85 (Ascii85) will not work.

The trade-off: this library rejects input that is not a multiple of 4 bytes (for encoding) or 5 characters (for decoding) rather than padding. ZeroMQ peers reject padded data, so failing early is better than producing data that silently corrupts on the wire.

## Edge cases

- Input length is strictly enforced. `encode(new Uint8Array(3))` throws. `decode("1234")` throws. If you have data that is not a multiple of 4 bytes, pad it yourself and track the real length out-of-band.
- Invalid Z85 characters cause a throw on decode, not silent substitution.
- The library accepts `Uint8Array` only for `encode` — not regular arrays, not `Buffer`. Convert first if needed.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

