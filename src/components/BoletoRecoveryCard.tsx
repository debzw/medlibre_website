'use client'

import { useState, useEffect } from 'react'
import { useAuthContext } from '@/contexts/AuthContext'
import { FileText, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SubscriptionData {
  status: string
  boletoUrl: string | null
}

export function BoletoRecoveryCard() {
  const { user, session } = useAuthContext()
  const [sub, setSub] = useState<SubscriptionData | null>(null)

  useEffect(() => {
    if (!user || !session) return
    fetch('/api/asaas/subscription', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then(setSub)
      .catch(() => {/* non-critical */})
  }, [user, session])

  if (!sub || sub.status !== 'pending' || !sub.boletoUrl) return null

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-warning/15 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-warning" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="font-semibold text-sm">Pagamento pendente</p>
        <p className="text-xs text-muted-foreground">
          Seu boleto ainda não foi compensado. Após o pagamento, seu acesso Premium será ativado em <strong>1 a 3 dias úteis</strong>.
        </p>
      </div>
      <a href={sub.boletoUrl} target="_blank" rel="noopener noreferrer">
        <Button size="sm" variant="outline" className="shrink-0 gap-1.5">
          <ExternalLink className="w-3.5 h-3.5" />
          Ver boleto
        </Button>
      </a>
    </div>
  )
}
