'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useAuthContext } from '@/contexts/AuthContext'
import { Clock, X } from 'lucide-react'

interface SubscriptionData {
  status: string
  nextDueDate: string | null
  hasActiveSubscription: boolean
}

export function TrialExpiryBanner() {
  const { user, session } = useAuthContext()
  const [sub, setSub] = useState<SubscriptionData | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!user || !session) return
    fetch('/api/asaas/subscription', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then(setSub)
      .catch(() => {/* non-critical */})
  }, [user, session])

  if (!user || !sub || dismissed) return null

  // Show only when: subscription_status = 'none' AND expiry < 7 days
  if (sub.status !== 'none' || !sub.nextDueDate) return null

  const daysLeft = Math.ceil(
    (new Date(sub.nextDueDate).getTime() - Date.now()) / 86400000,
  )
  if (daysLeft > 7 || daysLeft < 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="relative flex items-center justify-between gap-3 bg-secondary text-white text-sm px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          <span>
            Seu período de teste termina em{' '}
            <strong>{daysLeft === 0 ? 'hoje' : `${daysLeft} dia${daysLeft > 1 ? 's' : ''}`}</strong>
            {' '}—{' '}
            <Link href="/pricing" className="underline font-semibold text-primary hover:text-primary/80 transition-colors">
              Assinar agora
            </Link>
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/50 hover:text-white transition-colors shrink-0"
          aria-label="Fechar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
