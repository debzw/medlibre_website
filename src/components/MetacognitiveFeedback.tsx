import { useState } from 'react';
import { BrainCircuit, AlertTriangle, Minus, Check, Zap, Brain, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConfidenceLevel } from '@/hooks/useQuestionHistory';

interface ConfidenceOption {
  value: ConfidenceLevel;
  label: string;
  sublabel: string;
  Icon: React.ElementType;
  baseClass: string;
  selectedClass: string;
}

const OPTIONS: ConfidenceOption[] = [
  {
    value: 0,
    label: 'Apagão',
    sublabel: 'Não recordei',
    Icon: BrainCircuit,
    baseClass:
      'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400 hover:shadow-red-100/60 dark:border-red-800/60 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/40 dark:hover:border-red-700',
    selectedClass:
      'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200/60 dark:bg-red-600 dark:border-red-600 dark:shadow-red-900/50',
  },
  {
    value: 1,
    label: 'Muito difícil',
    sublabel: 'Quase não recordei',
    Icon: AlertTriangle,
    baseClass:
      'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-400 hover:shadow-orange-100/60 dark:border-orange-800/60 dark:bg-orange-950/20 dark:text-orange-400 dark:hover:bg-orange-900/40 dark:hover:border-orange-700',
    selectedClass:
      'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200/60 dark:bg-orange-600 dark:border-orange-600 dark:shadow-orange-900/50',
  },
  {
    value: 2,
    label: 'Com esforço',
    sublabel: 'Precisei pensar',
    Icon: Minus,
    baseClass:
      'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400 hover:shadow-amber-100/60 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-900/40 dark:hover:border-amber-700',
    selectedClass:
      'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200/60 dark:bg-amber-600 dark:border-amber-600 dark:shadow-amber-900/50',
  },
  {
    value: 3,
    label: 'Bom',
    sublabel: 'Recordei bem',
    Icon: Check,
    baseClass:
      'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-400 hover:shadow-blue-100/60 dark:border-blue-800/60 dark:bg-blue-950/20 dark:text-blue-400 dark:hover:bg-blue-900/40 dark:hover:border-blue-700',
    selectedClass:
      'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-200/60 dark:bg-blue-600 dark:border-blue-600 dark:shadow-blue-900/50',
  },
  {
    value: 4,
    label: 'Instantâneo',
    sublabel: 'Sem dificuldade',
    Icon: Zap,
    baseClass:
      'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-400 hover:shadow-green-100/60 dark:border-green-800/60 dark:bg-green-950/20 dark:text-green-400 dark:hover:bg-green-900/40 dark:hover:border-green-700',
    selectedClass:
      'bg-green-500 border-green-500 text-white shadow-lg shadow-green-200/60 dark:bg-green-600 dark:border-green-600 dark:shadow-green-900/50',
  },
];

interface MetacognitiveFeedbackProps {
  onFeedback?: (confidence: ConfidenceLevel) => Promise<void>;
  isLoggedIn?: boolean;
}

export function MetacognitiveFeedback({ onFeedback, isLoggedIn = false }: MetacognitiveFeedbackProps) {
  const [selected, setSelected] = useState<ConfidenceLevel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelect = async (confidence: ConfidenceLevel) => {
    if (selected !== null || isSubmitting) return;
    setSelected(confidence);
    setIsSubmitting(true);
    try {
      await onFeedback?.(confidence);
    } catch {
      // Feedback é não-crítico, não reverter selecção em caso de erro
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
          Como foi o esforço de recordar?
        </span>
      </div>

      {/* 5 confidence buttons — wrap on mobile, single row on sm+ */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2">
        {OPTIONS.map(({ value, label, sublabel, Icon, baseClass, selectedClass }) => {
          const isSelected = selected === value;
          const isDimmed = selected !== null && !isSelected;

          return (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              disabled={selected !== null || isSubmitting}
              className={cn(
                'flex-1 min-w-[72px] flex flex-col items-center justify-center gap-1 px-2 py-3',
                'rounded-xl border font-medium text-xs',
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
              <span className="font-semibold leading-tight text-center">{label}</span>
              <span className="text-[10px] opacity-70 leading-tight text-center">{sublabel}</span>
            </button>
          );
        })}
      </div>

      {/* Confirmation message */}
      {selected !== null && (
        <div className="flex items-center gap-2 pt-0.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">
            {isLoggedIn
              ? 'Avaliação registada. O algoritmo FSRS irá optimizar a sua próxima revisão.'
              : 'Faça login para activar o FSRS e guardar o seu progresso de revisões.'}
          </p>
        </div>
      )}
    </div>
  );
}
