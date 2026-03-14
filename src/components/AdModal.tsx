import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Zap, Layout, Shield } from 'lucide-react';
import { AdBanner } from './AdBanner';

interface AdModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoginCTA?: boolean;
}

export function AdModal({ isOpen, onClose, isLoginCTA }: AdModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-none shadow-2xl">
        <DialogTitle className="sr-only">Aviso ou Anúncio</DialogTitle>
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
            <div className="p-6 flex flex-col items-center">
              <div className="w-full h-6 flex items-center justify-end">
                <span className="text-[10px] uppercase font-bold text-muted-foreground/50 px-2 py-1 bg-muted/50 rounded-md">
                  Publicidade
                </span>
              </div>

              <div className="w-full flex justify-center py-4">
                <div className="w-full max-w-[336px]">
                  <AdBanner variant="square" className="w-full" slotId="9639357571" />
                </div>
              </div>

              <Button
                onClick={onClose}
                variant="default"
                className="w-full mt-4 h-12 font-bold btn-amber shadow-lg shadow-amber-500/20 text-base"
              >
                <X className="w-4 h-4 mr-2" />
                Fechar Anúncio
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
