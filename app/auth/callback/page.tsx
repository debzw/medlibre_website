'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const { user, session, profile, loading } = useAuthContext();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const referralAttempted = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timeout);
  }, []);

  // Registra referral code se presente no localStorage (uma única vez)
  useEffect(() => {
    if (!user || !session || referralAttempted.current) return;
    const refCode = localStorage.getItem('medlibre_ref');
    if (!refCode) return;

    referralAttempted.current = true;

    // Aguarda o perfil ser criado pelo trigger do Supabase antes de registrar o referral
    const registerReferral = async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
        const res = await fetch('/api/referral/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ referral_code: refCode }),
        });
        if (res.ok || res.status === 409) {
          // Só remove do localStorage após confirmação (ok = registrado, 409 = já registrado)
          localStorage.removeItem('medlibre_ref');
          break;
        }
      }
    };
    registerReferral().catch(() => {});
  }, [user, session]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/auth');
      return;
    }

    // Aguarda o perfil carregar antes de decidir para onde ir
    if (profile === null) return;

    if (profile.email_confirmed === false) {
      router.replace('/verify-email');
      return;
    }

    // Usuário existente confirmado → vai direto para o app
    router.replace('/app');
  }, [loading, user, profile, router]);

  if (timedOut) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Algo deu errado ao carregar sua conta.</p>
          <button
            onClick={() => router.replace('/auth')}
            className="text-primary underline text-sm"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Carregando sua conta...</p>
      </div>
    </div>
  );
}
