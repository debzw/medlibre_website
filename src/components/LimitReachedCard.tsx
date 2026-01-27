'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { Lock, LogIn, Crown } from 'lucide-react';

export function LimitReachedCard() {
  const { user, userType } = useAuthContext();

  return (
    <div className="card-elevated p-8 text-center animate-slide-up">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Lock className="w-8 h-8 text-primary" />
      </div>

      <h2 className="text-2xl font-bold mb-3">Limite de questões atingido</h2>

      {userType === 'guest' ? (
        <>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Você atingiu o limite de questões diárias para visitantes.
            Faça login para continuar estudando.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth">
              <Button className="btn-amber">
                <LogIn className="w-4 h-4 mr-2" />
                Fazer Login
              </Button>
            </Link>
            <Link href="/pricing">
              <Button variant="outline">
                <Crown className="w-4 h-4 mr-2" />
                Ver Planos e Benefícios
              </Button>
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Você atingiu o limite de 20 questões diárias.
            Assine o plano Premium para acesso ilimitado às questões.
          </p>

          <Button className="btn-amber">
            <Crown className="w-4 h-4 mr-2" />
            Assinar Premium
          </Button>
        </>
      )}

      <p className="text-sm text-muted-foreground mt-6">
        O limite será renovado amanhã às 00:00
      </p>
    </div>
  );
}
