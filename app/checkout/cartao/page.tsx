'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthContext } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CreditCard, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const PLAN_LABEL: Record<string, string> = {
  monthly: 'Mensal — Sem Compromisso',
  annual: 'Anual — Acesso Completo',
  founders: 'Fundadores',
  early_adopter: 'Early Adopter',
}

// ─── Inner (uses useSearchParams) ─────────────────────────────────────────────

function CardCheckoutForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { session } = useAuthContext()

  const plan = params.get('plan') ?? 'annual'
  const finalPriceCents = Number(params.get('price') ?? '69900')
  const prefillName = params.get('name') ?? ''
  const prefillEmail = params.get('email') ?? ''
  const prefillCpf = params.get('cpf') ?? ''
  const couponCode = params.get('coupon') ?? undefined
  const promotionId = params.get('promo') ?? undefined

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Billing info (pre-filled from modal)
  const [name, setName] = useState(prefillName)
  const [email, setEmail] = useState(prefillEmail)
  const [cpf, setCpf] = useState(prefillCpf)

  // Card fields
  const [cardHolder, setCardHolder] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [addressNumber, setAddressNumber] = useState('')

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
          paymentMethod: 'CREDIT_CARD',
          billingInfo: { name, email, cpfCnpj: cpf.replace(/\D/g, '') },
          promotionId: promotionId ?? undefined,
          couponCode: couponCode ?? undefined,
          cardToken: {
            holderName: cardHolder,
            number: cardNumber.replace(/\s/g, ''),
            expiryMonth: expMonth?.trim(),
            expiryYear: expYear?.trim(),
            ccv: cardCvv,
          },
          holderInfo: {
            name,
            email,
            cpfCnpj: cpf.replace(/\D/g, ''),
            postalCode: postalCode.replace(/\D/g, ''),
            addressNumber,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro desconhecido.')
        return
      }

      setSuccess(true)
    } catch {
      setError('Falha na conexão. Verifique sua internet e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }, [
    submitting, plan, name, email, cpf,
    cardHolder, cardNumber, cardExpiry, cardCvv,
    postalCode, addressNumber,
    couponCode, promotionId, session?.access_token,
  ])

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6 py-12 text-center"
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
          <p className="text-2xl font-[Archivo_Black]">Bem-vindo ao Premium!</p>
          <p className="text-muted-foreground">Seu acesso foi ativado. Bons estudos!</p>
        </div>
        <Button
          className="bg-primary text-primary-foreground font-semibold h-11 px-8"
          onClick={() => { window.location.href = '/dashboard' }}
        >
          Ir para o painel
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-[Archivo_Black] text-xl text-foreground">Dados do cartão</h1>
            <p className="text-xs text-muted-foreground">
              {PLAN_LABEL[plan]} · {formatBRL(finalPriceCents)}{plan === 'monthly' ? '/mês' : '/ano'}
            </p>
          </div>
        </div>
      </div>

      {/* Billing info */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados pessoais</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="name" className="text-xs mb-1 block">Nome completo</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div>
            <Label htmlFor="cpf" className="text-xs mb-1 block">CPF</Label>
            <Input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" maxLength={14} />
          </div>
        </div>
        <div>
          <Label htmlFor="email" className="text-xs mb-1 block">E-mail</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
        </div>
      </div>

      {/* Card fields */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados do cartão</p>
        <div>
          <Label htmlFor="card-holder" className="text-xs mb-1 block">Nome no cartão</Label>
          <Input id="card-holder" value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} placeholder="NOME SOBRENOME" />
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
            <Input id="card-expiry" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/AAAA" maxLength={7} />
          </div>
          <div>
            <Label htmlFor="card-cvv" className="text-xs mb-1 block">CVV</Label>
            <Input id="card-cvv" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="123" maxLength={4} />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço de cobrança</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="postal-code" className="text-xs mb-1 block">CEP</Label>
            <Input id="postal-code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="00000-000" maxLength={9} />
          </div>
          <div>
            <Label htmlFor="address-number" className="text-xs mb-1 block">Número</Label>
            <Input id="address-number" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="123" maxLength={10} />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
        onClick={handleSubmit}
        disabled={submitting || !name || !email || !cardNumber || !cardExpiry || !cardCvv || !cardHolder}
      >
        {submitting ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando…</>
        ) : (
          `Confirmar pagamento — ${formatBRL(finalPriceCents)}`
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Pagamento processado com segurança pela Asaas · Cancele quando quiser
      </p>
    </motion.div>
  )
}

// ─── Page wrapper ──────────────────────────────────────────────────────────────

export default function CardCheckoutPage() {
  return (
    <main className="min-h-screen bg-background flex items-start justify-center pt-12 px-4 pb-16">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
          <CardCheckoutForm />
        </Suspense>
      </div>
    </main>
  )
}
