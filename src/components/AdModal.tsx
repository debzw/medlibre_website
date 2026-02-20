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
                <div className="text-3xl text-amber-500">🚀</div>
              </div>
              <div className="space-y-3 px-4">
                <h3 className="text-2xl font-black tracking-tighter">Estude 4x mais!</h3>
                <div className="space-y-4 text-sm sm:text-base">
                  <p className="text-muted-foreground leading-relaxed">
                    Como <span className="font-bold text-foreground">Visitante</span>, você tem um limite de <span className="font-bold text-foreground">5 questões</span> por dia.
                  </p>
                  <div className="py-3 px-4 bg-primary/5 rounded-xl border border-primary/10">
                    <p className="font-medium">
                      ✨ Crie sua conta gratuita e aumente seu limite para <span className="text-primary font-bold">20 questões diárias</span> agora mesmo!
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 w-full">
                <Button
                  className="w-full h-12 text-base font-bold btn-amber shadow-lg shadow-amber-500/20"
                  onClick={() => window.location.href = '/auth'}
                >
                  Criar Conta Grátis
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground text-xs font-medium"
                  onClick={onClose}
                >
                  Continuar sem logar
                </Button>
              </div>
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
