'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const { user, profile, loading } = useAuthContext();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timeout);
  }, []);

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
