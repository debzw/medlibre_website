'use client'

import { useState, useCallback, useRef } from 'react'
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
  FileText,
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

type PaymentMethod = 'CREDIT_CARD' | 'PIX' | 'BOLETO'
type Step = 'form' | 'pix_pending' | 'boleto_pending' | 'success'

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
  const { session } = useAuthContext()
  const [method, setMethod] = useState<PaymentMethod>('PIX')
  const [step, setStep] = useState<Step>('form')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // PIX state
  const [pixQr, setPixQr] = useState<string | null>(null)
  const [pixCopiaECola, setPixCopiaECola] = useState<string | null>(null)
  const [pixCopied, setPixCopied] = useState(false)

  // Boleto state
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cpf, setCpf] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardHolder, setCardHolder] = useState('')

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
  }, [])

  const startPixPoll = useCallback(() => {
    let attempts = 0
    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > 60) { stopPoll(); return } // 5 min max
      try {
        const res = await fetch('/api/asaas/subscription', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        })
        const data = await res.json()
        if (data.status === 'active') {
          stopPoll()
          setStep('success')
        }
      } catch {/* ignore */}
    }, 5000)
  }, [stopPoll, session?.access_token])

  const handleSubmit = useCallback(async () => {
    if (submitting) return
    setError(null)
    setSubmitting(true)

    try {
      const [expMonth, expYear] = cardExpiry.split('/')

      const res = await fetch('/api/asaas/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          plan,
          paymentMethod: method,
          billingInfo: { name, email, cpfCnpj: cpf.replace(/\D/g, '') },
          promotionId: promotionId ?? undefined,
          couponCode: couponCode ?? undefined,
          ...(method === 'CREDIT_CARD'
            ? {
                cardToken: {
                  holderName: cardHolder,
                  number: cardNumber.replace(/\s/g, ''),
                  expiryMonth: expMonth?.trim(),
                  expiryYear: expYear?.trim(),
                  ccv: cardCvv,
                },
              }
            : {}),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro desconhecido.')
        return
      }

      if (method === 'PIX') {
        setPixQr(data.pixQrCode)
        setPixCopiaECola(data.pixCopiaECola)
        setStep('pix_pending')
        startPixPoll()
      } else if (method === 'BOLETO') {
        setBoletoUrl(data.boletoUrl)
        setStep('boleto_pending')
      } else {
        // Card — webhook will confirm; treat as success
        setStep('success')
      }
    } catch {
      setError('Falha na conexão. Verifique sua internet e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }, [
    submitting, plan, method, name, email, cpf,
    cardExpiry, cardHolder, cardNumber, cardCvv,
    promotionId, couponCode, startPixPoll, session?.access_token,
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
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0">
        {/* Header strip */}
        <div className="bg-secondary px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-white font-[Archivo_Black] text-lg">
              {step === 'success' ? 'Acesso ativado!' : 'Finalizar assinatura'}
            </DialogTitle>
            <p className="text-white/70 text-sm mt-0.5">
              {PLAN_LABEL[plan]} · {formatBRL(finalPriceCents)}
              {plan === 'monthly' ? '/mês' : '/ano'}
            </p>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          <AnimatePresence mode="wait">
            {step === 'form' && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Billing info */}
                <div className="space-y-3">
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

                {/* Payment method tabs */}
                <div>
                  <Label className="text-xs mb-2 block text-muted-foreground uppercase tracking-wider">
                    Forma de pagamento
                  </Label>
                  <div className="flex gap-2">
                    {(['PIX', 'BOLETO', 'CREDIT_CARD'] as PaymentMethod[]).map((m) => (
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
                        {m === 'BOLETO' && <FileText className="w-5 h-5" />}
                        {m === 'CREDIT_CARD' && <CreditCard className="w-5 h-5" />}
                        {m === 'PIX' ? 'PIX' : m === 'BOLETO' ? 'Boleto' : 'Cartão'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card fields */}
                {method === 'CREDIT_CARD' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3"
                  >
                    <div>
                      <Label htmlFor="card-holder" className="text-xs mb-1 block">Nome no cartão</Label>
                      <Input
                        id="card-holder"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        placeholder="NOME SOBRENOME"
                      />
                    </div>
                    <div>
                      <Label htmlFor="card-number" className="text-xs mb-1 block">Número do cartão</Label>
                      <Input
                        id="card-number"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="card-expiry" className="text-xs mb-1 block">Validade</Label>
                        <Input
                          id="card-expiry"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/AAAA"
                          maxLength={7}
                        />
                      </div>
                      <div>
                        <Label htmlFor="card-cvv" className="text-xs mb-1 block">CVV</Label>
                        <Input
                          id="card-cvv"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          placeholder="123"
                          maxLength={4}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {method === 'BOLETO' && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                    Acesso ativado após compensação do boleto — <strong>1 a 3 dias úteis</strong>.
                  </p>
                )}

                {error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
                  onClick={handleSubmit}
                  disabled={submitting || !name || !email}
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando…</>
                  ) : (
                    `Confirmar — ${formatBRL(finalPriceCents)}`
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Pagamento processado com segurança pela Asaas. Cancele quando quiser.
                </p>
              </motion.div>
            )}

            {step === 'pix_pending' && (
              <motion.div
                key="pix"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-5 py-2"
              >
                {pixQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pixQr} alt="QR Code PIX" className="w-52 h-52 rounded-xl border" />
                ) : (
                  <div className="w-52 h-52 rounded-xl border bg-muted animate-pulse" />
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
                    Após o pagamento, seu acesso será ativado automaticamente.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Verificando a cada 5 segundos
                </div>
              </motion.div>
            )}

            {step === 'boleto_pending' && (
              <motion.div
                key="boleto"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-5 py-2 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">Boleto gerado!</p>
                  <p className="text-sm text-muted-foreground">
                    Seu acesso será ativado após a compensação — <strong>1 a 3 dias úteis</strong>.
                  </p>
                </div>
                {boletoUrl && (
                  <a
                    href={boletoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold rounded-xl px-5 py-2.5 text-sm hover:bg-primary/90 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Abrir boleto
                  </a>
                )}
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Fechar
                </Button>
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
                  <p className="text-sm text-muted-foreground">
                    Seu acesso foi ativado. Bons estudos!
                  </p>
                </div>
                <Button
                  className="bg-primary text-primary-foreground font-semibold"
                  onClick={handleClose}
                >
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
