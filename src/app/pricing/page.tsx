'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { CheckoutModal, type CheckoutPlan } from '@/components/CheckoutModal'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  CircleCheck,
  ArrowRight,
  Clock,
  Users,
  Zap,
  Brain,
  BarChart3,
  ShieldCheck,
  Crown,
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
  const [isAnnual, setIsAnnual] = useState(true)
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
      .catch(() => {})
  }, [])

  const validateCoupon = useCallback(async () => {
    if (!coupon.code.trim()) return
    setCoupon((c) => ({ ...c, loading: true, valid: null, error: undefined }))
    try {
      const res = await fetch('/api/asaas/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coupon.code, plan: isAnnual ? 'annual' : 'monthly' }),
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
  }, [coupon.code, isAnnual])

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
      <section className="py-32">
        <div className="container">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">

            {/* Heading */}
            <p className="text-primary text-sm font-semibold uppercase tracking-widest">
              Planos & Preços
            </p>
            <h1 className="text-pretty text-4xl font-bold lg:text-6xl font-[Archivo_Black]">
              O método que aprova,<br className="hidden sm:block" /> no preço que respeita.
            </h1>
            <p className="text-muted-foreground lg:text-xl max-w-md">
              Active Recall + Repetição Espaçada. Sem videoaulas. Sem enrolação.
            </p>

            {/* Billing toggle */}
            <div className="flex items-center gap-3 text-lg">
              <span className={isAnnual ? 'text-muted-foreground' : 'text-foreground font-medium'}>
                Mensal
              </span>
              <Switch
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
              />
              <span className={isAnnual ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                Anual
                {isAnnual && (
                  <span className="ml-2 bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5">
                    Melhor valor
                  </span>
                )}
              </span>
            </div>

            {/* Founders banner */}
            <AnimatePresence>
              {foundersActive && promotion && (
                <motion.div
                  key="founders-banner"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden w-full max-w-3xl"
                >
                  <div className="bg-secondary rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div className="flex-1 space-y-1">
                      <p className="inline-block bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 mb-2">
                        Oferta Fundadores — {slotsRemaining} vagas
                      </p>
                      <p className="font-[Archivo_Black] text-white text-2xl">
                        R$ 249<span className="text-base font-normal text-white/60">/ano</span>
                      </p>
                      <p className="text-white/50 text-xs line-through">R$ 958,80/ano</p>
                      {promotion.slots_total && (
                        <div className="pt-2 space-y-1">
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden w-48">
                            <motion.div
                              className="h-full bg-primary rounded-full"
                              animate={{ width: `${(promotion.slots_used / promotion.slots_total) * 100}%` }}
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
                        <ArrowRight className="ml-2 size-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Plan cards */}
            <div className="flex flex-col items-stretch gap-6 md:flex-row">

              {/* Free card */}
              <Card className="flex w-80 flex-col justify-between text-left">
                <CardHeader>
                  <CardTitle>
                    <p>Explorador</p>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Para começar</p>
                  <span className="text-4xl font-bold font-[Archivo_Black]">Gratuito</span>
                  <p className="text-muted-foreground">Sempre, para sempre</p>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-6" />
                  <ul className="space-y-4">
                    {FEATURES_FREE.map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-center gap-2">
                        <CircleCheck className="size-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{text}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="mt-auto">
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/auth">
                      Começar grátis
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>

              {/* Premium card */}
              <Card className="flex w-80 flex-col justify-between text-left border-2 border-primary relative overflow-hidden">
                {/* Gold accent top line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-t-xl" />

                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <p className="text-primary">Premium</p>
                    <span className="bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5">
                      Recomendado
                    </span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Para quem quer passar</p>

                  <AnimatePresence mode="wait">
                    {isAnnual ? (
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
                        <span className="text-4xl font-bold font-[Archivo_Black]">
                          R$ {foundersActive ? '249' : '699'}
                        </span>
                        <p className="text-muted-foreground">
                          {foundersActive ? 'Oferta Fundadores' : 'R$ 58,25/mês — economize 26%'}
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="monthly"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                      >
                        <span className="text-4xl font-bold font-[Archivo_Black]">R$ 79,90</span>
                        <p className="text-muted-foreground">Por mês, sem fidelidade</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardHeader>

                <CardContent>
                  <Separator className="mb-6" />
                  <p className="mb-3 font-semibold">Tudo incluso:</p>
                  <ul className="space-y-4">
                    {FEATURES_PREMIUM.map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-center gap-2">
                        <CircleCheck className="size-4 text-primary" />
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="mt-auto flex-col gap-3">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
                    onClick={() =>
                      openCheckout(
                        isAnnual ? (foundersActive ? 'founders' : 'annual') : 'monthly',
                        isAnnual ? annualPrice : monthlyPrice,
                        isAnnual && foundersActive ? promotion?.id : undefined,
                      )
                    }
                  >
                    Assinar {isAnnual ? 'Anual' : 'Mensal'}
                    <ArrowRight className="ml-2 size-4" />
                  </Button>

                  {/* Coupon field */}
                  <div className="w-full space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={coupon.code}
                        onChange={(e) => setCoupon((c) => ({ ...c, code: e.target.value.toUpperCase(), valid: null }))}
                        onKeyDown={(e) => e.key === 'Enter' && validateCoupon()}
                        placeholder="CUPOM DE DESCONTO"
                        className="flex-1 h-9 rounded-xl border border-border bg-background px-3 text-xs uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 px-3 text-xs"
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
                          className="text-xs text-[#38BE58] text-center"
                        >
                          ✓ {coupon.label} aplicado!
                        </motion.p>
                      )}
                      {coupon.valid === false && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-destructive text-center"
                        >
                          {coupon.error}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </CardFooter>
              </Card>
            </div>

            {/* Footer note */}
            <p className="text-sm text-muted-foreground max-w-md">
              Cancele quando quiser. Acesso imediato após confirmação do pagamento.
              Pagamentos processados com segurança pela{' '}
              <span className="font-medium text-foreground">Asaas</span>.
            </p>
          </div>
        </div>
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
