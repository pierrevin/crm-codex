// JWT utilities for Edge Functions
import { create, verify } from 'https://deno.land/x/djwt@v3.0.1/mod.ts'

const JWT_ACCESS_SECRET = Deno.env.get('JWT_ACCESS_SECRET') ?? 'local-dev-secret'
const JWT_REFRESH_SECRET = Deno.env.get('JWT_REFRESH_SECRET') ?? 'local-refresh-secret'

const encoder = new TextEncoder()
const accessKey = await crypto.subtle.importKey(
  'raw',
  encoder.encode(JWT_ACCESS_SECRET),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify']
)

const refreshKey = await crypto.subtle.importKey(
  'raw',
  encoder.encode(JWT_REFRESH_SECRET),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign', 'verify']
)

export async function createAccessToken(userId: string) {
  return await create(
    { alg: 'HS256', typ: 'JWT' },
    { userId, exp: Math.floor(Date.now() / 1000) + 900 }, // 15 min
    accessKey
  )
}

export async function createRefreshToken(userId: string) {
  return await create(
    { alg: 'HS256', typ: 'JWT' },
    { userId, exp: Math.floor(Date.now() / 1000) + 604800 }, // 7 days
    refreshKey
  )
}

export async function verifyAccessToken(token: string) {
  try {
    const payload = await verify(token, accessKey)
    return payload as { userId: string }
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string) {
  try {
    const payload = await verify(token, refreshKey)
    return payload as { userId: string }
  } catch {
    return null
  }
}

