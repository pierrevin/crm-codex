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

