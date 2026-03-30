import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Rate limiting via in-memory map (resets on cold start — acceptable for edge)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 })
  }

  let body: { code?: string; plan?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const { code, plan } = body
  if (!code || !plan) {
    return NextResponse.json({ error: 'code e plan são obrigatórios.' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('validate_coupon', {
    p_code: code,
    p_plan: plan,
  })

  if (error) {
    console.error('validate_coupon rpc error', error)
    return NextResponse.json({ error: 'Erro ao validar cupom.' }, { status: 500 })
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row || !row.valid) {
    return NextResponse.json({ valid: false, error: 'Cupom inválido ou expirado.' }, { status: 200 })
  }

  return NextResponse.json({
    valid: true,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    finalPriceCents: row.final_price_cents,
    label: row.label,
  })
}
