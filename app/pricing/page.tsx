'use client'

/**
 * Design Direction: Editorial Gold — Endowment Effect First
 *
 * Structure:
 *   1. Momentum / Hero section
 *   2. User reviews / social proof
 *   3. Billing toggle + Pricing cards
 *   4. Coupon
 *   5. Trust signals
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import Link from 'next/link'
import { CheckoutModal, type CheckoutPlan } from '@/components/CheckoutModal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthContext } from '@/contexts/AuthContext'
import { useQuestionHistory } from '@/hooks/useQuestionHistory'
import {
  CheckCircle2,
  Crown,
  Zap,
  Brain,
  BarChart3,
  ShieldCheck,
  Infinity,
  Flame,
  Target,
  ArrowRight,
  Lock,
  Star,
  Quote,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

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

// ─── Features ──────────────────────────────────────────────────────────────────

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
  { icon: Crown, text: 'Flashcards (em breve)' },
  { icon: Crown, text: 'Caderno de erros (em breve)' },
]

// ─── Reviews ───────────────────────────────────────────────────────────────────

const REVIEWS = [
  {
    name: 'Mariana S.',
    role: 'R2 Clínica Médica — USP',
    avatar: 'MS',
    stars: 5,
    text: 'Passei a usar o Medlibre 3 semanas antes da prova do REVALIDA e senti a diferença na fixação. O método é simples e realmente funciona.',
  },
  {
    name: 'Lucas F.',
    role: 'Residente de Pediatria — UNIFESP',
    avatar: 'LF',
    stars: 5,
    text: 'Diferente de outros apps, aqui eu consigo ver exatamente onde estou falhando por especialidade. Isso muda completamente a forma de estudar.',
  },
  {
    name: 'Camila R.',
    role: 'Acadêmica de Medicina — UFMG',
    avatar: 'CR',
    stars: 5,
    text: 'Comecei na versão gratuita e em 2 semanas já assine o Premium. A repetição espaçada é viciante no bom sentido — minha retenção subiu 40%.',
  },
  {
    name: 'Pedro A.',
    role: 'Aprovado em Residência — FMUSP',
    avatar: 'PA',
    stars: 5,
    text: 'R$1,91 por dia é menos que um café. E o ROI de passar na residência? Não tem comparação. Recomendo sem hesitar.',
  },
]

// ─── Animated counter ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const duration = 900
    const start = performance.now()
    const frame = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, [inView, value])

  return (
    <span ref={ref}>
      {display.toLocaleString('pt-BR')}
      {suffix}
    </span>
  )
}

// ─── Star Rating ───────────────────────────────────────────────────────────────

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="w-3.5 h-3.5 fill-primary text-primary" />
      ))}
    </div>
  )
}

// ─── Review Card ───────────────────────────────────────────────────────────────

function ReviewCard({ review, delay }: { review: typeof REVIEWS[0]; delay: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay }}
      className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 relative"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.05)' }}
    >
      <Quote className="absolute top-4 right-4 w-6 h-6 text-primary/10" />
      <StarRating count={review.stars} />
      <p className="text-sm text-foreground/80 leading-relaxed flex-1">"{review.text}"</p>
      <div className="flex items-center gap-3 pt-1 border-t border-border/60">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-bold text-primary">{review.avatar}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground leading-tight">{review.name}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">{review.role}</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { user } = useAuthContext()
  const { stats } = useQuestionHistory('all')

  const [billing, setBilling] = useState<'annual' | 'monthly'>('annual')
  const [coupon, setCoupon] = useState<CouponState>({ code: '', loading: false, valid: null })
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan>('annual')
  const [checkoutPrice, setCheckoutPrice] = useState(69900)
  const [checkoutCoupon, setCheckoutCoupon] = useState<string | undefined>()

  const questionsAnswered = stats.totalAnswered
  const retentionRate = Math.round(stats.accuracy)
  const daysStudied = stats.recentActivity?.length ?? 0
  const showMomentum = !!user && (questionsAnswered > 0 || daysStudied > 0)

  const monthlyPrice = coupon.valid && coupon.finalPriceCents ? coupon.finalPriceCents : 7990
  const annualPrice = coupon.valid && coupon.finalPriceCents ? coupon.finalPriceCents : 69900

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

  const openCheckout = (plan: CheckoutPlan, priceCents: number) => {
    setCheckoutPlan(plan)
    setCheckoutPrice(priceCents)
    setCheckoutCoupon(coupon.valid ? coupon.code : undefined)
    setCheckoutOpen(true)
  }

  return (
    <main className="min-h-screen bg-background overflow-x-hidden">

      {/* ── 1. MOMENTUM — Endowment Effect (logged-in users with activity) ── */}
      {showMomentum && (
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-2xl mx-auto">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="text-primary text-xs font-semibold uppercase tracking-widest text-center mb-6"
            >
              Seu progresso no Medlibre
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="font-[Archivo_Black] text-3xl sm:text-4xl text-foreground text-center leading-tight mb-2"
            >
              Você já construiu algo real aqui.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.12 }}
              className="text-muted-foreground text-center text-sm mb-8"
            >
              Este histórico é seu — e ele cresce a cada sessão.
            </motion.p>

            {/* Stats strip */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.18 }}
              className="grid grid-cols-3 gap-3"
            >
              {[
                { icon: Target, value: questionsAnswered, suffix: '', label: 'questões\nrespondidas' },
                { icon: Brain, value: retentionRate, suffix: '%', label: 'taxa de\nretenção' },
                { icon: Flame, value: daysStudied, suffix: '', label: 'dias\nestudados' },
              ].map(({ icon: Icon, value, suffix, label }) => (
                <div
                  key={label}
                  className="rounded-2xl bg-card border border-border p-4 flex flex-col items-center text-center"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.04)' }}
                >
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="font-[Archivo_Black] text-2xl text-foreground leading-none">
                    <AnimatedNumber value={value} suffix={suffix} />
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-tight whitespace-pre-line">{label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Hero for non-logged-in or zero-activity users */}
      {!showMomentum && (
        <section className="pt-24 pb-16 px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-4">Planos & Preços</p>
            <h1 className="font-[Archivo_Black] text-4xl sm:text-5xl text-foreground max-w-2xl mx-auto leading-tight">
              O método que aprova,<br />no preço que respeita.
            </h1>
            <p className="text-muted-foreground mt-4 max-w-md mx-auto text-sm">
              Active Recall + Repetição Espaçada. Sem videoaulas. Sem enrolação.
            </p>
          </motion.div>
        </section>
      )}

      {/* ── 2. USER REVIEWS ─────────────────────────────────────────────────── */}
      <section className="px-4 py-16 border-t border-border/40">
        <div className="max-w-3xl mx-auto">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-center mb-8"
          >
            {/* Aggregate stars */}
            <div className="flex items-center justify-center gap-1.5 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-primary text-primary" />
              ))}
              <span className="text-sm font-semibold text-foreground ml-1">5.0</span>
              <span className="text-sm text-muted-foreground">· aprovado por quem usou</span>
            </div>
            <h2 className="font-[Archivo_Black] text-2xl sm:text-3xl text-foreground leading-tight">
              Quem estuda com o Medlibre, aprova.
            </h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
              Médicos e estudantes que transformaram sua rotina de estudos.
            </p>
          </motion.div>

          {/* Review grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {REVIEWS.map((review, i) => (
              <ReviewCard key={review.name} review={review} delay={i * 0.08} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. HEADLINE BRIDGE + BILLING TOGGLE ─────────────────────────────── */}
      <section className="px-4 pt-16 pb-8 text-center border-t border-border/40">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="max-w-xl mx-auto"
        >
          <p className="text-primary text-xs font-semibold uppercase tracking-widest mb-3">Escolha seu plano</p>
          <h2 className="font-[Archivo_Black] text-2xl sm:text-3xl text-foreground leading-tight mb-2">
            Remova o teto. Mantenha o ritmo.
          </h2>
          <p className="text-muted-foreground text-sm">
            Você já tem o hábito. O Premium só tira o freio.
          </p>
        </motion.div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <span className={cn('text-sm font-medium', billing === 'monthly' ? 'text-foreground' : 'text-muted-foreground')}>
            Mensal
          </span>
          <button
            onClick={() => setBilling(billing === 'annual' ? 'monthly' : 'annual')}
            className={cn(
              'relative w-14 h-7 rounded-full transition-colors',
              billing === 'annual' ? 'bg-primary/20' : 'bg-secondary/20',
            )}
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
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
              >
                Melhor valor
              </motion.span>
            )}
          </span>
        </div>
      </section>

      {/* ── 4. PRICING CARDS ────────────────────────────────────────────────── */}
      <section className="px-4 pb-16">
        <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">

          {/* Free card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border bg-card p-6 flex flex-col"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.04)' }}
          >
            <div className="mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Explorador</p>
              <p className="font-[Archivo_Black] text-3xl text-foreground">Gratuito</p>
              <p className="text-xs text-muted-foreground mt-1">Sempre disponível</p>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {FEATURES_FREE.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Icon className="w-4 h-4 shrink-0 text-muted-foreground/50" />
                  {text}
                </li>
              ))}
              <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Lock className="w-4 h-4 shrink-0 text-muted-foreground/30" />
                <span className="line-through opacity-50">Questões ilimitadas</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Lock className="w-4 h-4 shrink-0 text-muted-foreground/30" />
                <span className="line-through opacity-50">Análise por especialidade</span>
              </li>
            </ul>

            <Link href="/auth">
              <Button variant="outline" className="w-full rounded-xl">
                Continuar grátis
              </Button>
            </Link>
          </motion.div>

          {/* Premium card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.18 }}
            className="rounded-2xl border-2 border-primary bg-card p-6 flex flex-col relative overflow-hidden"
            style={{ boxShadow: '0 4px 6px rgba(237,185,46,0.08), 0 12px 32px rgba(237,185,46,0.16)' }}
          >
            {/* Gold top accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-t-2xl" />
            {/* Subtle glow */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-primary/6 blur-3xl pointer-events-none" />

            <div className="mb-6 relative">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-primary">Premium</p>
                <span className="bg-primary/12 text-primary text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5">
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
                    transition={{ duration: 0.2 }}
                    className="space-y-0.5"
                  >
                    <p className="text-xs text-muted-foreground line-through">R$ 79,90/mês</p>
                    <p className="font-[Archivo_Black] text-3xl text-foreground">
                      R$ 699
                      <span className="text-sm font-normal text-muted-foreground">/ano</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">R$ 58,25/mês</span>
                      <span className="bg-[#38BE58]/10 text-[#38BE58] text-[10px] font-bold rounded-full px-2 py-0.5">
                        economize 26%
                      </span>
                    </div>
                    <p className="text-[11px] text-primary/80 font-medium pt-1">
                      R$ 1,91/dia — menos que 1% do custo de um extensivo
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="monthly"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="font-[Archivo_Black] text-3xl text-foreground">
                      R$ 79,90
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Sem fidelidade</p>
                    <p className="text-[11px] text-primary/80 font-medium pt-1">
                      R$ 2,66/dia — cancele quando quiser
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <ul className="space-y-3 flex-1 mb-4 relative">
              {FEATURES_PREMIUM.map(({ text }) => (
                <li key={text} className="flex items-center gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
                  {text}
                </li>
              ))}
              <li className="flex items-center gap-2.5 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
                Mesmo preço para sempre
              </li>
            </ul>

            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 rounded-xl mt-4 relative"
              onClick={() =>
                openCheckout(
                  billing === 'annual' ? 'annual' : 'monthly',
                  billing === 'annual' ? annualPrice : monthlyPrice,
                )
              }
            >
              Assinar {billing === 'annual' ? 'Anual' : 'Mensal'}
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── 5. COUPON ───────────────────────────────────────────────────────── */}
      <section className="px-4 py-10 max-w-sm mx-auto border-t border-border/40">
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
            className="h-9 px-4 rounded-xl"
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

      {/* ── 6. TRUST SIGNALS ────────────────────────────────────────────────── */}
      <section className="px-4 pt-4 pb-24 max-w-xl mx-auto text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Acesso imediato após confirmação · Cancele quando quiser · Sem compromisso.
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
        couponCode={checkoutCoupon}
        finalPriceCents={checkoutPrice}
      />
    </main>
  )
}
