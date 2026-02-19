import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface AdModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoginCTA?: boolean;
}

export function AdModal({ isOpen, onClose, isLoginCTA }: AdModalProps) {
  const [countdown, setCountdown] = useState(5);
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCountdown(5);
      setCanClose(false);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanClose(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={canClose ? onClose : undefined}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="text-center">Propaganda</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-8">
          {isLoginCTA ? (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="text-3xl">✨</div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-tight">Estude sem interrupções!</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Faça login gratuito agora para remover os anúncios entre as questões e salvar seu progresso.
                </p>
              </div>
              <Button
                className="w-full h-12 text-base font-semibold btn-amber"
                onClick={() => window.location.href = '/auth'}
              >
                Fazer Login Gratuito
              </Button>
            </div>
          ) : (
            <>
              {/* Ad content placeholder */}
              <div className="w-full h-64 ad-placeholder mb-6">
                <div className="text-center">
                  <p className="font-medium text-muted-foreground">Anúncio Interstitial</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">300x250</p>
                </div>
              </div>
            </>
          )}

          {/* Close button */}
          {!isLoginCTA && (
            <Button
              onClick={onClose}
              disabled={!canClose}
              variant={canClose ? 'default' : 'secondary'}
              className={canClose ? 'mt-6 btn-amber' : 'mt-6'}
            >
              {canClose ? (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Fechar
                </>
              ) : (
                `Aguarde ${countdown}s...`
              )}
            </Button>
          )}

          {isLoginCTA && (
            <Button
              variant="ghost"
              className="mt-4 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              Continuar sem logar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
