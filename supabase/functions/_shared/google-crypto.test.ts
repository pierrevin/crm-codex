import { base64UrlEncode, pemToArrayBuffer } from './google-crypto.ts'

const TEST_PEM = `-----BEGIN PRIVATE KEY-----
dGVzdC1rZXk=
-----END PRIVATE KEY-----`

Deno.test('pemToArrayBuffer convertit un PEM valide en ArrayBuffer', () => {
  const buffer = pemToArrayBuffer(TEST_PEM)
  const decoded = new TextDecoder().decode(new Uint8Array(buffer))
  if (decoded !== 'test-key') {
    throw new Error(`La clé décodée est "${decoded}" au lieu de "test-key"`)
  }
})

Deno.test('pemToArrayBuffer rejette un format vide', () => {
  let errorCaught = false
  try {
    pemToArrayBuffer('-----BEGIN PRIVATE KEY-----\n\n-----END PRIVATE KEY-----')
  } catch (error) {
    errorCaught = true
    if (!(error instanceof Error) || !error.message.includes('Invalid Google private key format')) {
      throw new Error('Message d’erreur inattendu')
    }
  }
  if (!errorCaught) {
    throw new Error('Une erreur était attendue pour un PEM vide')
  }
})

Deno.test('base64UrlEncode encode sans padding', () => {
  const encoded = base64UrlEncode('test-key')
  if (encoded !== 'dGVzdC1rZXk') {
    throw new Error(`Encodage inattendu: ${encoded}`)
  }
})

