'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');

  const [confirmed, setConfirmed] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Redireciona se não estiver logado
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth');
    }
  }, [loading, user, router]);

  // Polling a cada 3s para verificar email_confirmed
  // Também detecta quando a conta foi deletada pelo cron (perfil inexistente)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('email_confirmed')
        .eq('id', user.id)
        .single();

      if (data?.email_confirmed === true) {
        setConfirmed(true);
        clearInterval(interval);
        setTimeout(() => router.replace('/app'), 1500);
        return;
      }

      // Perfil não encontrado: conta foi deletada pelo cron após 15 min
      if (error?.code === 'PGRST116' || (!data && !error)) {
        clearInterval(interval);
        await supabase.auth.signOut();
        if (user) localStorage.removeItem(`emailVerificationSent_${user.id}`);
        router.replace('/auth?error=verification_expired');
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [user, router]);

  // Cooldown do botão reenviar
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!user?.email || resendCooldown > 0) return;
    setResendLoading(true);
    setResendSuccess(false);

    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });
      const data = await res.json();

      // Prazo expirou: conta foi deletada, redireciona para novo cadastro
      if (data.error === 'account_expired') {
        await supabase.auth.signOut();
        localStorage.removeItem(`emailVerificationSent_${user.id}`);
        router.replace('/auth?error=verification_expired');
        return;
      }

      setResendSuccess(true);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      // silencioso — o utilizador pode tentar novamente
    } finally {
      setResendLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card-elevated p-8 animate-slide-up text-center space-y-6">
          <div className="flex justify-center mb-2">
            <img src="/logo_withname.svg" alt="Medlibre" className="h-10 dark:hidden" />
            <img src="/logo_withname_white.svg" alt="Medlibre" className="h-10 hidden dark:block" />
          </div>

          {confirmed ? (
            <>
              <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
              <h1 className="text-xl font-semibold">E-mail confirmado!</h1>
              <p className="text-muted-foreground text-sm">Redirecionando para o app...</p>
              <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
            </>
          ) : (
            <>
              <Mail className="w-14 h-14 text-primary mx-auto" />
              <div className="space-y-2">
                <h1 className="text-xl font-semibold">Verifique seu e-mail e spam</h1>
                <p className="text-muted-foreground text-sm">
                  Enviamos um link de confirmação para
                </p>
                <p className="font-medium text-sm break-all">{user?.email}</p>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p className="text-xs mt-1">
                  Você tem <span className="font-medium text-foreground">15 minutos</span> para confirmar.
                  Após isso, a conta será removida e será necessário cadastrar-se novamente.
                </p>
              </div>

              {errorParam === 'expired' && (
                <p className="text-destructive text-sm bg-destructive/10 rounded-md px-3 py-2">
                  O link expirou. Reenvie um novo e-mail.
                </p>
              )}

              {resendSuccess && (
                <p className="text-green-600 dark:text-green-400 text-sm">
                  Novo e-mail enviado!
                </p>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resendLoading || resendCooldown > 0}
              >
                {resendLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {resendCooldown > 0
                  ? `Reenviar em ${resendCooldown}s`
                  : 'Reenviar e-mail'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
