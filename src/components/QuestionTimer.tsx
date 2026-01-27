import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Timer, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface QuestionTimerRef {
  getElapsedSeconds: () => number;
  reset: () => void;
  pause: () => void;
  resume: () => void;
}

interface QuestionTimerProps {
  className?: string;
  onTimeUpdate?: (seconds: number) => void;
}

export const QuestionTimer = forwardRef<QuestionTimerRef, QuestionTimerProps>(
  ({ className, onTimeUpdate }, ref) => {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isVisible, setIsVisible] = useState(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('medlibre-timer-visible');
        return saved !== 'false';
      }
      return true;
    });

    useEffect(() => {
      if (isPaused) return;

      const interval = setInterval(() => {
        setElapsedSeconds(prev => {
          const next = prev + 1;
          onTimeUpdate?.(next);
          return next;
        });
      }, 1000);

      return () => clearInterval(interval);
    }, [isPaused, onTimeUpdate]);

    useEffect(() => {
      localStorage.setItem('medlibre-timer-visible', String(isVisible));
    }, [isVisible]);

    const reset = useCallback(() => {
      setElapsedSeconds(0);
      setIsPaused(false);
    }, []);

    const pause = useCallback(() => {
      setIsPaused(true);
    }, []);

    const resume = useCallback(() => {
      setIsPaused(false);
    }, []);

    const getElapsedSeconds = useCallback(() => {
      return elapsedSeconds;
    }, [elapsedSeconds]);

    useImperativeHandle(ref, () => ({
      getElapsedSeconds,
      reset,
      pause,
      resume,
    }), [getElapsedSeconds, reset, pause, resume]);

    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <div className={cn('flex items-center gap-1', className)}>
        <div className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap',
          isPaused ? 'bg-muted' : 'bg-secondary',
          isVisible ? 'max-w-[150px] opacity-100' : 'max-w-[36px] opacity-100 px-2'
        )}>
          <button
            onClick={() => setIsVisible(!isVisible)}
            className="flex items-center justify-center shrink-0 focus:outline-none"
            title={isVisible ? "Ocultar tempo" : "Mostrar tempo"}
          >
            <Timer className={cn(
              'w-4 h-4 transition-transform duration-300',
              isVisible ? 'rotate-0' : 'rotate-180',
              isPaused ? 'text-muted-foreground' : 'text-primary'
            )} />
          </button>

          <div className={cn(
            'flex items-center gap-2 transition-all duration-300',
            isVisible ? 'w-auto opacity-100' : 'w-0 opacity-0 pointer-events-none translate-x-4'
          )}>
            <span className={cn(
              'font-medium tabular-nums',
              isPaused && 'text-muted-foreground'
            )}>
              {formatTime(elapsedSeconds)}
            </span>
          </div>
        </div>

        <div className={cn(
          'transition-all duration-300 overflow-hidden',
          isVisible ? 'w-8 opacity-100 ml-0' : 'w-0 opacity-0 -ml-1 pointer-events-none'
        )}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => isPaused ? resume() : pause()}
            className="w-7 h-7 text-muted-foreground hover:text-foreground"
            title={isPaused ? 'Continuar' : 'Pausar'}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </Button>
        </div>
      </div>
    );
  }
);

QuestionTimer.displayName = 'QuestionTimer';
