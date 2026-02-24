import { useState } from 'react';
import { ThumbsUp, Minus, ThumbsDown, Brain, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DifficultyLevel } from '@/hooks/useQuestionHistory';

interface DifficultyOption {
  value: DifficultyLevel;
  label: string;
  Icon: React.ElementType;
  baseClass: string;
  selectedClass: string;
}

const OPTIONS: DifficultyOption[] = [
  {
    value: 'easy',
    label: 'Fácil',
    Icon: ThumbsUp,
    baseClass:
      'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400 hover:shadow-green-100/60 dark:border-green-800/60 dark:bg-green-950/20 dark:text-green-400 dark:hover:bg-green-900/40 dark:hover:border-green-700',
    selectedClass:
      'bg-green-500 border-green-500 text-white shadow-lg shadow-green-200/60 dark:bg-green-600 dark:border-green-600 dark:shadow-green-900/50',
  },
  {
    value: 'medium',
    label: 'Médio',
    Icon: Minus,
    baseClass:
      'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400 hover:shadow-amber-100/60 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-900/40 dark:hover:border-amber-700',
    selectedClass:
      'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200/60 dark:bg-amber-600 dark:border-amber-600 dark:shadow-amber-900/50',
  },
  {
    value: 'hard',
    label: 'Difícil',
    Icon: ThumbsDown,
    baseClass:
      'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400 hover:shadow-red-100/60 dark:border-red-800/60 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/40 dark:hover:border-red-700',
    selectedClass:
      'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200/60 dark:bg-red-600 dark:border-red-600 dark:shadow-red-900/50',
  },
];

interface MetacognitiveFeedbackProps {
  onFeedback?: (difficulty: DifficultyLevel) => Promise<void>;
  isLoggedIn?: boolean;
}

export function MetacognitiveFeedback({ onFeedback, isLoggedIn = false }: MetacognitiveFeedbackProps) {
  const [selected, setSelected] = useState<DifficultyLevel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelect = async (difficulty: DifficultyLevel) => {
    if (selected !== null || isSubmitting) return;
    setSelected(difficulty);
    setIsSubmitting(true);
    try {
      await onFeedback?.(difficulty);
    } catch {
      // feedback é não-crítico, não reverter selecção em caso de erro
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-muted/20 border border-border/40 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-muted-foreground">
          Como foi esta questão para você?
        </span>
      </div>

      {/* Difficulty buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        {OPTIONS.map(({ value, label, Icon, baseClass, selectedClass }) => {
          const isSelected = selected === value;
          const isDimmed = selected !== null && !isSelected;

          return (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              disabled={selected !== null || isSubmitting}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3',
                'rounded-xl border font-medium text-sm',
                'transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isSelected
                  ? selectedClass
                  : cn(
                      baseClass,
                      'shadow-sm',
                      isDimmed
                        ? 'opacity-40 cursor-default'
                        : 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
                    ),
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Confirmation message */}
      {selected && (
        <div className="flex items-center gap-2 pt-0.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            {isLoggedIn
              ? 'Avaliação registada. O algoritmo SRS irá optimizar a sua próxima revisão.'
              : 'Faça login para activar o SRS e guardar o seu progresso de revisões.'}
          </p>
        </div>
      )}
    </div>
  );
}
