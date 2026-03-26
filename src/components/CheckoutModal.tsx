'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Copy,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckoutPlan = 'monthly' | 'annual' | 'founders' | 'early_adopter'

interface CheckoutModalProps {
  open: boolean
  onClose: () => void
  plan: CheckoutPlan
  promotionId?: string
  couponCode?: string
  /** Pre-calculated final price in cents (after coupon/promo) */
  finalPriceCents: number
}

type PaymentMethod = 'CREDIT_CARD' | 'PIX'
type Step = 'form' | 'pix_pending' | 'success'

const PLAN_LABEL: Record<CheckoutPlan, string> = {
  monthly: 'Mensal — Sem Compromisso',
  annual: 'Anual — Acesso Completo',
  founders: 'Fundadores',
  early_adopter: 'Early Adopter',
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CheckoutModal({
  open,
  onClose,
  plan,
  promotionId,
  couponCode,
  finalPriceCents,
}: CheckoutModalProps) {
  const { session, loading: authLoading } = useAuthContext()
  const router = useRouter()

  const [method, setMethod] = useState<PaymentMethod>('PIX')
  const [step, setStep] = useState<Step>('form')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // PIX state
  const [pixQr, setPixQr] = useState<string | null>(null)
  const [pixCopiaECola, setPixCopiaECola] = useState<string | null>(null)
  const [pixCopied, setPixCopied] = useState(false)

  // Form fields (shared for PIX + card page redirect)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')

  // Redirect to login if not authenticated when modal opens
  useEffect(() => {
    if (open && !authLoading && !session) {
      onClose()
      router.push('/auth?redirect=/pricing')
    }
  }, [open, authLoading, session, onClose, router])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
  }, [])

  const startPixPoll = useCallback(() => {
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > 60) { stopPoll(); return }
      try {
        const res = await fetch('/api/asaas/subscription', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        })
        const data = await res.json()
        if (data.status === 'active') {
          stopPoll()
          setStep('success')
        }
      } catch {/* ignore */ }
    }, 5000)
  }, [stopPoll, session?.access_token])

  const handleSubmit = useCallback(async () => {
    if (submitting) return
    setError(null)

    // Card → redirect to dedicated page
    if (method === 'CREDIT_CARD') {
      const params = new URLSearchParams({
        plan,
        price: String(finalPriceCents),
        name,
        email,
        cpf,
        ...(couponCode ? { coupon: couponCode } : {}),
        ...(promotionId ? { promo: promotionId } : {}),
      })
      router.push(`/checkout/cartao?${params.toString()}`)
      onClose()
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/asaas/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          plan,
          paymentMethod: 'PIX',
          billingInfo: { name, email, cpfCnpj: cpf.replace(/\D/g, '') },
          promotionId: promotionId ?? undefined,
          couponCode: couponCode ?? undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro desconhecido.')
        return
      }

      setPixQr(data.pixQrCode)
      setPixCopiaECola(data.pixCopiaECola)
      setStep('pix_pending')
      startPixPoll()
    } catch {
      setError('Falha na conexão. Verifique sua internet e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }, [
    submitting, plan, method, name, email, cpf,
    promotionId, couponCode, finalPriceCents,
    startPixPoll, session?.access_token, router, onClose,
  ])

  const handleClose = useCallback(() => {
    stopPoll()
    if (step === 'success') {
      window.location.href = '/dashboard'
      return
    }
    onClose()
  }, [step, onClose, stopPoll])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0">
        {/* Header strip */}
        <div className="bg-secondary px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white font-[Archivo_Black] text-base">
              {step === 'success' ? 'Acesso ativado!' : 'Finalizar assinatura'}
            </DialogTitle>
            <p className="text-white/70 text-xs mt-0.5">
              {PLAN_LABEL[plan]} · {formatBRL(finalPriceCents)}
              {plan === 'monthly' ? '/mês' : '/ano'}
            </p>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4">
          <AnimatePresence mode="wait">
            {step === 'form' && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Billing info */}
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="checkout-name" className="text-xs mb-1 block">Nome completo</Label>
                      <Input
                        id="checkout-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                      />
                    </div>
                    <div>
                      <Label htmlFor="checkout-cpf" className="text-xs mb-1 block">CPF</Label>
                      <Input
                        id="checkout-cpf"
                        value={cpf}
                        onChange={(e) => setCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        maxLength={14}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="checkout-email" className="text-xs mb-1 block">E-mail</Label>
                    <Input
                      id="checkout-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                {/* Payment method */}
                <div>
                  <Label className="text-xs mb-2 block text-muted-foreground uppercase tracking-wider">
                    Forma de pagamento
                  </Label>
                  <div className="flex gap-2">
                    {(['PIX', 'CREDIT_CARD'] as PaymentMethod[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMethod(m)}
                        className={cn(
                          'flex-1 flex flex-col items-center gap-1 rounded-xl border-2 py-3 px-2 text-xs font-medium transition-all',
                          method === m
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40',
                        )}
                      >
                        {m === 'PIX' && <QrCode className="w-5 h-5" />}
                        {m === 'CREDIT_CARD' && <CreditCard className="w-5 h-5" />}
                        {m === 'PIX' ? 'PIX' : 'Cartão'}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10"
                  onClick={handleSubmit}
                  disabled={submitting || !name || !email}
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando…</>
                  ) : method === 'CREDIT_CARD' ? (
                    'Continuar com Cartão →'
                  ) : (
                    `Gerar PIX — ${formatBRL(finalPriceCents)}`
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Pagamento seguro via Asaas · Cancele quando quiser
                </p>
              </motion.div>
            )}

            {step === 'pix_pending' && (
              <motion.div
                key="pix"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4 py-2"
              >
                {pixQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pixQr} alt="QR Code PIX" className="w-48 h-48 rounded-xl border" />
                ) : (
                  <div className="w-48 h-48 rounded-xl border bg-muted animate-pulse" />
                )}

                {pixCopiaECola && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pixCopiaECola)
                      setPixCopied(true)
                      setTimeout(() => setPixCopied(false), 2000)
                    }}
                    className="flex items-center gap-2 text-sm text-primary font-medium hover:underline"
                  >
                    <Copy className="w-4 h-4" />
                    {pixCopied ? 'Copiado!' : 'Copiar código PIX'}
                  </button>
                )}

                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Aguardando pagamento…</p>
                  <p className="text-xs text-muted-foreground">
                    Seu acesso será ativado automaticamente.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Verificando a cada 5 segundos
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-5 py-4 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="w-20 h-20 rounded-full bg-[#38BE58]/15 flex items-center justify-center"
                >
                  <CheckCircle2 className="w-10 h-10 text-[#38BE58]" />
                </motion.div>
                <div className="space-y-1.5">
                  <p className="text-xl font-[Archivo_Black]">Bem-vindo ao Premium!</p>
                  <p className="text-sm text-muted-foreground">Seu acesso foi ativado. Bons estudos!</p>
                </div>
                <Button className="bg-primary text-primary-foreground font-semibold" onClick={handleClose}>
                  Ir para o painel
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
