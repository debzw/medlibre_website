import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Zap, Sparkles, Layout, Shield } from 'lucide-react';

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
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-none shadow-2xl [&>button]:hidden">
        <div className="flex flex-col">
          {isLoginCTA ? (
            <div className="bg-background">
              {/* Header Visual */}
              <div className="h-32 bg-primary/5 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent" />
                <div className="relative w-16 h-16 bg-background rounded-2xl shadow-sm border border-primary/10 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-primary fill-primary/10" />
                </div>
              </div>

              <div className="px-8 pt-8 pb-10 text-center space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">
                    Estude 4 vezes mais!
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Crie sua conta agora e tenha acesso aos melhores recursos para sua aprovação.
                  </p>
                </div>

                {/* Benefits List */}
                <div className="grid grid-cols-1 gap-3 text-left">
                  <div className="flex items-center p-3 rounded-xl bg-muted/30 border border-border/50">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
                      <Layout className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">20 Questões/Dia</p>
                      <p className="text-[11px] text-muted-foreground">Corrigidas e comentadas</p>
                    </div>
                  </div>
                  <div className="flex items-center p-3 rounded-xl bg-muted/30 border border-border/50">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mr-3">
                      <Shield className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Entenda seu progresso</p>
                      <p className="text-[11px] text-muted-foreground">Estatísticas e algorítmo de questões personalizado</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    className="w-full h-12 text-sm font-bold btn-amber shadow-lg shadow-amber-500/20"
                    onClick={() => window.location.href = '/auth'}
                  >
                    Cadastrar Gratuitamente
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground hover:text-foreground text-xs font-medium"
                    onClick={onClose}
                  >
                    Continuar como visitante
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center">
              <div className="w-full flex justify-between items-center mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center">
                  <Sparkles className="w-3 h-3 mr-1.5" />
                  Publicidade
                </span>
                {!canClose && (
                  <span className="text-[10px] font-medium text-muted-foreground px-2 py-1 bg-muted rounded-full">
                    Aguarde {countdown}s
                  </span>
                )}
              </div>

              {/* Ad content placeholder */}
              <div className="w-full h-64 ad-placeholder rounded-2xl bg-muted/30 border border-dashed border-border flex items-center justify-center">
                <div className="text-center opacity-40">
                  <p className="text-xs font-semibold uppercase tracking-tighter">Espaço Reservado</p>
                  <p className="text-[10px]">300x250 Ad Display</p>
                </div>
              </div>

              <Button
                onClick={onClose}
                disabled={!canClose}
                variant={canClose ? 'default' : 'secondary'}
                className={`w-full mt-6 h-12 font-bold transition-all ${canClose ? 'btn-amber shadow-lg shadow-amber-500/20' : 'opacity-50'}`}
              >
                {canClose ? (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Fechar Anúncio
                  </>
                ) : (
                  `Fechar em ${countdown}s`
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
