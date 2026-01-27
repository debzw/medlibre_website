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
}

export function AdModal({ isOpen, onClose }: AdModalProps) {
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
          {/* Ad content placeholder */}
          <div className="w-full h-64 ad-placeholder mb-6">
            <div className="text-center">
              <p className="font-medium text-muted-foreground">Anúncio Interstitial</p>
              <p className="text-xs text-muted-foreground/70 mt-1">300x250</p>
            </div>
          </div>

          {/* Close button */}
          <Button
            onClick={onClose}
            disabled={!canClose}
            variant={canClose ? 'default' : 'secondary'}
            className={canClose ? 'btn-amber' : ''}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
