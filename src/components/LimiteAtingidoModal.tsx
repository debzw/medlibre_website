'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckoutModal, type CheckoutPlan } from '@/components/CheckoutModal'
import { Crown, Clock, Users, Zap } from 'lucide-react'

interface Promotion {
  id: string
  label: string
  price_cents: number
  slots_total: number | null
  slots_used: number
  active_until: string | null
  active: boolean
}

interface LimiteAtingidoModalProps {
  open: boolean
  onClose: () => void
}

function useCountdown(target: Date | null) {
  const [diff, setDiff] = useState<number>(0)
  useEffect(() => {
    if (!target) return
    const update = () => setDiff(Math.max(0, target.getTime() - Date.now()))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [target])

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  return { days, hours, mins, secs, expired: diff === 0 }
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-[Archivo_Black] text-xl text-primary tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  )
}

export function LimiteAtingidoModal({ open, onClose }: LimiteAtingidoModalProps) {
  const [promotion, setPromotion] = useState<Promotion | null>(null)
  const [loadingPromo, setLoadingPromo] = useState(true)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlan>('annual')
  const [selectedPrice, setSelectedPrice] = useState(69900)
  const [selectedPromoId, setSelectedPromoId] = useState<string | undefined>()

  const countdownTarget = promotion?.active_until ? new Date(promotion.active_until) : null
  const countdown = useCountdown(countdownTarget)

  useEffect(() => {
    if (!open) return
    setLoadingPromo(true)
    fetch('/api/asaas/promotions')
      .then((r) => r.json())
      .then((data: { promotions?: Promotion[] }) => {
        const active = data.promotions?.find(
          (p) => p.active && (p.slots_total === null || p.slots_used < p.slots_total),
        )
        setPromotion(active ?? null)
      })
      .catch(() => setPromotion(null))
      .finally(() => setLoadingPromo(false))
  }, [open])

  const foundersActive =
    promotion?.id === 'founders' &&
    !countdown.expired &&
    (promotion.slots_total === null || promotion.slots_used < promotion.slots_total)

  const slotsRemaining = foundersActive && promotion?.slots_total
    ? promotion.slots_total - promotion.slots_used
    : null

  const openCheckout = (plan: CheckoutPlan, priceCents: number, promoId?: string) => {
    setSelectedPlan(plan)
    setSelectedPrice(priceCents)
    setSelectedPromoId(promoId)
    setCheckoutOpen(true)
  }

  return (
    <>
      <Dialog open={open && !checkoutOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
          {/* Header */}
          <div className="bg-secondary px-6 py-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-white font-[Archivo_Black] text-base leading-tight">
                    Limite de 20 questões atingido
                  </DialogTitle>
                  <p className="text-white/60 text-xs mt-0.5">Limite renova à meia-noite</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-5">
            {loadingPromo ? (
              <div className="h-32 bg-muted animate-pulse rounded-xl" />
            ) : foundersActive && promotion ? (
              /* Founders offer */
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border-2 border-primary/40 bg-primary/5 p-4 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 mb-2">
                      Oferta Fundadores
                    </span>
                    <p className="font-[Archivo_Black] text-2xl">
                      R$ 249
                      <span className="text-sm font-normal text-muted-foreground">/ano</span>
                    </p>
                    <p className="text-xs text-muted-foreground line-through">R$ 958,80/ano</p>
                  </div>
                  <Crown className="w-6 h-6 text-primary mt-1" />
                </div>

                {/* Countdown */}
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex gap-3">
                    <CountdownUnit value={countdown.days} label="dias" />
                    <CountdownUnit value={countdown.hours} label="horas" />
                    <CountdownUnit value={countdown.mins} label="min" />
                    <CountdownUnit value={countdown.secs} label="seg" />
                  </div>
                </div>

                {/* Slot progress */}
                {slotsRemaining !== null && promotion.slots_total && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="w-3 h-3" />
                        {slotsRemaining} vagas restantes
                      </span>
                      <span className="text-muted-foreground">
                        {promotion.slots_used}/{promotion.slots_total}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(promotion.slots_used / promotion.slots_total) * 100}%`,
                        }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10"
                  onClick={() => openCheckout('founders', promotion.price_cents, promotion.id)}
                >
                  Garantir vaga de Fundador
                </Button>
              </motion.div>
            ) : (
              /* Standard annual offer */
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border-2 border-border p-4 space-y-4"
              >
                <div>
                  <p className="font-[Archivo_Black] text-2xl">
                    R$ 699
                    <span className="text-sm font-normal text-muted-foreground">/ano</span>
                  </p>
                  <p className="text-xs text-muted-foreground">R$ 58,25/mês — economize 26%</p>
                </div>
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10"
                  onClick={() => openCheckout('annual', 69900)}
                >
                  Assinar Premium Anual
                </Button>
              </motion.div>
            )}

            {/* Feature list */}
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                'Questões ilimitadas todo dia',
                'Algoritmo FSRS — revisão inteligente',
                'Análise de desempenho por especialidade',
                'Sem anúncios',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={onClose}
            >
              Continuar no plano gratuito
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        plan={selectedPlan}
        promotionId={selectedPromoId}
        finalPriceCents={selectedPrice}
      />
    </>
  )
}
