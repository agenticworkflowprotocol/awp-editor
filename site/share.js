// Share links: the manifest compressed with deflate-raw and encoded as base64url in the URL
// fragment. Fragments are not sent in HTTP requests, so the manifest stays on the client.
const MAX_SHARE_BYTES = 64 * 1024;
const CHUNK = 0x8000;

function toBase64Url(bytes) {
  let binary = '';
  // Chunked to stay below the argument limit of String.fromCharCode.
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encodeShare(text) {
  return toBase64Url(await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw')));
}

export async function decodeShare(fragment) {
  const bytes = await pipe(fromBase64Url(fragment), new DecompressionStream('deflate-raw'));
  if (bytes.length > MAX_SHARE_BYTES) throw new Error('shared manifest too large');
  return new TextDecoder().decode(bytes);
}
