'use client'

/**
 * Design Direction: Luxury Minimal — Editorial Gold
 * DFII: 13/15 (Excellent)
 *
 * Aesthetic thesis: High-contrast indigo/gold with a dominant annual card that
 * breaks the expected symmetry. The Founders banner is a full-bleed strip that
 * creates asymmetric tension above the cards.
 *
 * Differentiation anchor: The pricing toggle is a pill that slides — not tabs.
 * The annual card carries a bold "R$79,90 riscado" + gold badge. No gradient
 * backgrounds, no purple, no generic SaaS layout.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { CheckoutModal, type CheckoutPlan } from '@/components/CheckoutModal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  Clock,
  Users,
  Crown,
  Zap,
  Brain,
  BarChart3,
  ShieldCheck,
  Infinity,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Promotion {
  id: string
  label: string
  price_cents: number
  slots_total: number | null
  slots_used: number
  active_until: string | null
  active: boolean
}

interface CouponState {
  code: string
  loading: boolean
  valid: boolean | null
  discountType?: string
  discountValue?: number
  finalPriceCents?: number
  label?: string
  error?: string
}

// ─── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(target: Date | null) {
  const [diff, setDiff] = useState(0)
  useEffect(() => {
    if (!target) return
    const update = () => setDiff(Math.max(0, target.getTime() - Date.now()))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [target])
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
    expired: diff === 0 && target !== null,
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CountdownPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center bg-white/10 rounded-lg px-3 py-1.5 min-w-[48px]">
      <span className="font-[Archivo_Black] text-xl text-primary tabular-nums leading-tight">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[9px] uppercase tracking-widest text-white/50">{label}</span>
    </div>
  )
}

const FEATURES_FREE = [
  { icon: Zap, text: '20 questões por dia' },
  { icon: BarChart3, text: 'Estatísticas básicas' },
  { icon: Brain, text: 'Revisão espaçada (SRS)' },
]

const FEATURES_PREMIUM = [
  { icon: Infinity, text: 'Questões ilimitadas todo dia' },
  { icon: Brain, text: 'Algoritmo FSRS v4.5 — adaptativo' },
  { icon: BarChart3, text: 'Análise completa por especialidade e banca' },
  { icon: ShieldCheck, text: 'Sem anúncios' },
  { icon: Crown, text: 'Modo Simulado (em breve)' },
]

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual')
  const [promotion, setPromotion] = useState<Promotion | null>(null)
  const [coupon, setCoupon] = useState<CouponState>({ code: '', loading: false, valid: null })
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan>('annual')
  const [checkoutPrice, setCheckoutPrice] = useState(69900)
  const [checkoutPromoId, setCheckoutPromoId] = useState<string | undefined>()
  const [checkoutCoupon, setCheckoutCoupon] = useState<string | undefined>()

  const countdownTarget = promotion?.active_until ? new Date(promotion.active_until) : null
  const countdown = useCountdown(countdownTarget)

  const foundersActive =
    promotion?.id === 'founders' &&
    promotion.active &&
    !countdown.expired &&
    (promotion.slots_total === null || promotion.slots_used < promotion.slots_total)

  // Prices
  const monthlyPrice = coupon.valid && coupon.finalPriceCents ? coupon.finalPriceCents : 7990
  const annualPrice =
    foundersActive
      ? promotion!.price_cents
      : coupon.valid && coupon.finalPriceCents
      ? coupon.finalPriceCents
      : 69900

  useEffect(() => {
    fetch('/api/asaas/promotions')
      .then((r) => r.json())
      .then((data: { promotions?: Promotion[] }) => {
        const active = data.promotions?.find(
          (p) => p.active && (p.slots_total === null || p.slots_used < p.slots_total),
        )
        setPromotion(active ?? null)
      })
      .catch(() => {/* non-critical */})
  }, [])

  const validateCoupon = useCallback(async () => {
    if (!coupon.code.trim()) return
    setCoupon((c) => ({ ...c, loading: true, valid: null, error: undefined }))
    try {
      const res = await fetch('/api/asaas/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coupon.code, plan: billing }),
      })
      const data = await res.json()
      if (data.valid) {
        setCoupon((c) => ({
          ...c,
          loading: false,
          valid: true,
          discountType: data.discountType,
          discountValue: data.discountValue,
          finalPriceCents: data.finalPriceCents,
          label: data.label,
        }))
      } else {
        setCoupon((c) => ({ ...c, loading: false, valid: false, error: 'Cupom inválido ou expirado.' }))
      }
    } catch {
      setCoupon((c) => ({ ...c, loading: false, valid: false, error: 'Erro ao validar cupom.' }))
    }
  }, [coupon.code, billing])

  const openCheckout = (plan: CheckoutPlan, priceCents: number, promoId?: string) => {
    setCheckoutPlan(plan)
    setCheckoutPrice(priceCents)
    setCheckoutPromoId(promoId)
    setCheckoutCoupon(coupon.valid ? coupon.code : undefined)
    setCheckoutOpen(true)
  }

  const slotsRemaining =
    foundersActive && promotion?.slots_total
      ? promotion.slots_total - promotion.slots_used
      : null

  return (
    <main className="min-h-screen bg-background">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="pt-20 pb-12 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-4">
            Planos & Preços
          </p>
          <h1 className="font-[Archivo_Black] text-4xl sm:text-5xl text-foreground max-w-2xl mx-auto leading-tight">
            O método que aprova,<br />no preço que respeita.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-md mx-auto">
            Active Recall + Repetição Espaçada. Sem videoaulas. Sem enrolação.
          </p>
        </motion.div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mt-10">
          <span className={cn('text-sm font-medium', billing === 'monthly' ? 'text-foreground' : 'text-muted-foreground')}>
            Mensal
          </span>
          <button
            onClick={() => setBilling(billing === 'annual' ? 'monthly' : 'annual')}
            className="relative w-14 h-7 rounded-full bg-secondary transition-colors"
            aria-label="Alternar ciclo de cobrança"
          >
            <motion.div
              layout
              className="absolute top-1 w-5 h-5 rounded-full bg-primary shadow"
              animate={{ left: billing === 'annual' ? '2.25rem' : '0.25rem' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
          <span className={cn('text-sm font-medium flex items-center gap-1.5', billing === 'annual' ? 'text-foreground' : 'text-muted-foreground')}>
            Anual
            {billing === 'annual' && (
              <span className="bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5">
                Melhor valor
              </span>
            )}
          </span>
        </div>
      </section>

      {/* ── Founders banner (conditional) ────────────────────── */}
      <AnimatePresence>
        {foundersActive && promotion && (
          <motion.section
            key="founders-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-secondary mx-4 sm:mx-auto sm:max-w-3xl rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex-1 space-y-1">
                <p className="inline-block bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 mb-2">
                  Oferta Fundadores — {slotsRemaining} vagas
                </p>
                <p className="font-[Archivo_Black] text-white text-2xl">
                  R$ 249<span className="text-base font-normal text-white/60">/ano</span>
                </p>
                <p className="text-white/50 text-xs line-through">R$ 958,80/ano</p>

                {/* Slot bar */}
                {promotion.slots_total && (
                  <div className="pt-2 space-y-1">
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden w-48">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        animate={{
                          width: `${(promotion.slots_used / promotion.slots_total) * 100}%`,
                        }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <p className="text-[10px] text-white/40 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {promotion.slots_used}/{promotion.slots_total} vagas preenchidas
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-4">
                {/* Countdown */}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-white/40 shrink-0" />
                  <div className="flex gap-1.5">
                    <CountdownPill value={countdown.days} label="d" />
                    <CountdownPill value={countdown.hours} label="h" />
                    <CountdownPill value={countdown.mins} label="m" />
                    <CountdownPill value={countdown.secs} label="s" />
                  </div>
                </div>

                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6"
                  onClick={() => openCheckout('founders', promotion.price_cents, promotion.id)}
                >
                  Garantir vaga de Fundador
                </Button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ── Plan cards ───────────────────────────────────────── */}
      <section className="px-4 pb-8">
        <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {/* Free card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border bg-card p-6 flex flex-col"
          >
            <div className="mb-6">
              <p className="text-sm font-semibold text-muted-foreground mb-1">Explorador</p>
              <p className="font-[Archivo_Black] text-3xl text-foreground">Gratuito</p>
              <p className="text-xs text-muted-foreground mt-1">Sempre</p>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {FEATURES_FREE.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Icon className="w-4 h-4 shrink-0 text-muted-foreground/60" />
                  {text}
                </li>
              ))}
            </ul>

            <Link href="/auth">
              <Button variant="outline" className="w-full">
                Começar grátis
              </Button>
            </Link>
          </motion.div>

          {/* Premium card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="rounded-2xl border-2 border-primary bg-card p-6 flex flex-col relative overflow-hidden"
          >
            {/* Gold accent top line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-t-2xl" />

            <div className="mb-6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-primary">Premium</p>
                <span className="bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5">
                  Recomendado
                </span>
              </div>

              <AnimatePresence mode="wait">
                {billing === 'annual' ? (
                  <motion.div
                    key="annual"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="space-y-0.5"
                  >
                    {!foundersActive && (
                      <p className="text-xs text-muted-foreground line-through">R$ 79,90/mês</p>
                    )}
                    <p className="font-[Archivo_Black] text-3xl text-foreground">
                      R$ {foundersActive ? '249' : '699'}
                      <span className="text-sm font-normal text-muted-foreground">/ano</span>
                    </p>
                    {!foundersActive && (
                      <p className="text-xs text-muted-foreground">R$ 58,25/mês — economize 26%</p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="monthly"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    <p className="font-[Archivo_Black] text-3xl text-foreground">
                      R$ 79,90
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Sem fidelidade</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {FEATURES_PREMIUM.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
                  {text}
                </li>
              ))}
            </ul>

            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
              onClick={() =>
                openCheckout(
                  billing === 'annual' ? (foundersActive ? 'founders' : 'annual') : 'monthly',
                  billing === 'annual' ? annualPrice : monthlyPrice,
                  billing === 'annual' && foundersActive ? promotion?.id : undefined,
                )
              }
            >
              Assinar {billing === 'annual' ? 'Anual' : 'Mensal'}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── Coupon field ─────────────────────────────────────── */}
      <section className="px-4 pb-10 max-w-sm mx-auto">
        <p className="text-xs text-center text-muted-foreground mb-3">Tem um cupom de desconto?</p>
        <div className="flex gap-2">
          <input
            value={coupon.code}
            onChange={(e) => setCoupon((c) => ({ ...c, code: e.target.value.toUpperCase(), valid: null }))}
            onKeyDown={(e) => e.key === 'Enter' && validateCoupon()}
            placeholder="CÓDIGO"
            className="flex-1 h-9 rounded-xl border border-border bg-background px-3 text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-4"
            onClick={validateCoupon}
            disabled={coupon.loading || !coupon.code.trim()}
          >
            {coupon.loading ? '…' : 'Aplicar'}
          </Button>
        </div>
        <AnimatePresence>
          {coupon.valid === true && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-[#38BE58] mt-2 text-center"
            >
              ✓ {coupon.label} aplicado!
            </motion.p>
          )}
          {coupon.valid === false && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-destructive mt-2 text-center"
            >
              {coupon.error}
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      {/* ── FAQ teaser ───────────────────────────────────────── */}
      <section className="px-4 pb-20 max-w-xl mx-auto text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Dúvidas? Cancele quando quiser. Acesso imediato após confirmação do pagamento.
        </p>
        <p className="text-xs text-muted-foreground">
          Pagamentos processados com segurança pela{' '}
          <span className="font-medium text-foreground">Asaas</span>.
        </p>
      </section>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        plan={checkoutPlan}
        promotionId={checkoutPromoId}
        couponCode={checkoutCoupon}
        finalPriceCents={checkoutPrice}
      />
    </main>
  )
}
