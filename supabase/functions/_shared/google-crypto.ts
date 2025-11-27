import { encode as encodeBase64Url } from 'https://deno.land/std@0.207.0/encoding/base64url.ts'

const textEncoder = new TextEncoder()

export function pemToArrayBuffer(pem: string) {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')

  if (!cleaned) {
    throw new Error('Invalid Google private key format')
  }

  let binary: string
  try {
    binary = atob(cleaned)
  } catch {
    throw new Error('Invalid Google private key format (base64 decode failed)')
  }

  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }

  return buffer.buffer
}

export function base64UrlEncode(input: string | ArrayBuffer | Uint8Array) {
  const bytes =
    typeof input === 'string'
      ? textEncoder.encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input)

  // std encode renvoie parfois '=', on les supprime pour un JWT conforme
  return encodeBase64Url(bytes).replace(/=/g, '')
}

