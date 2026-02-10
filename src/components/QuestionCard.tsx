import { useState, useEffect, useRef } from 'react';
import { Question } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, MoreVertical, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuestionHistory, QuestionHistoryEntry } from '@/hooks/useQuestionHistory';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from './modals/ReportDialog';

interface QuestionCardProps {
  question: Question;
  onAnswered: (selectedAnswer: number, isCorrect: boolean) => void;
  canAnswer: boolean;
  historyEntry?: QuestionHistoryEntry;
}

export function QuestionCard({ question, onAnswered, canAnswer, historyEntry }: QuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const { saveAnswer } = useQuestionHistory();
  const { user } = useAuthContext();
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  // Reset or restore state when question changes
  // Reset state when question changes
  useEffect(() => {
    setSelectedOption(null);
    setShowResult(false);
    startTimeRef.current = Date.now();
  }, [question.id]);

  const handleOptionClick = async (index: number) => {
    if (!canAnswer || showResult) return;

    const isCorrect = index === question.resposta_correta;
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);

    setSelectedOption(index);
    setShowResult(true);

    // Save to history if user is logged in
    if (user) {
      try {
        await saveAnswer({
          questionId: question.id,
          selectedAnswer: index,
          isCorrect,
          timeSpentSeconds: timeSpent,
          campo_medico: question.campo_medico,
          banca: question.banca,
        });
      } catch (error) {
        console.error('Failed to save answer:', error);
      }
    }

    onAnswered(index, isCorrect);
  };

  const getOptionClass = (index: number): string => {
    if (!showResult) {
      return cn(
        'option-neutral',
        !canAnswer && 'option-disabled'
      );
    }

    const isCorrect = index === question.resposta_correta;
    const isSelected = index === selectedOption;

    if (isCorrect) {
      return 'option-correct';
    }
    if (isSelected && !isCorrect) {
      return 'option-incorrect';
    }
    return cn('option-neutral', 'option-disabled');
  };

  const getOptionIcon = (index: number) => {
    if (!showResult) return null;

    const isCorrect = index === question.resposta_correta;
    const isSelected = index === selectedOption;

    if (isCorrect) {
      return <Check className="w-5 h-5 text-success shrink-0" />;
    }
    if (isSelected && !isCorrect) {
      return <X className="w-5 h-5 text-destructive shrink-0" />;
    }
    return null;
  };

  const optionLabels = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="card-elevated p-4 sm:p-6 space-y-4 sm:space-y-6 animate-slide-up">
      {/* Header with metadata */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
            {question.banca}
          </Badge>
          <Badge variant="outline" className="bg-secondary">
            {question.ano}
          </Badge>
          <Badge variant="outline" className="bg-secondary">
            {question.output_grande_area}
          </Badge>
          {historyEntry && (
            <Badge
              variant="outline"
              className={cn(
                "px-2 flex items-center justify-center shrink-0",
                historyEntry.is_correct
                  ? "bg-green-500/10 text-green-600 border-green-200"
                  : "bg-red-500/10 text-red-600 border-red-200"
              )}
              title={historyEntry.is_correct ? "Questão respondida corretamente" : "Questão respondida incorretamente"}
            >
              {historyEntry.is_correct ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
            </Badge>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full -mt-1 -mr-2">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem
              onClick={() => setIsReportDialogOpen(true)}
              className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/5"
            >
              <Flag className="h-4 w-4" />
              Reportar erro
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Question text and Image between statement and options */}
      <div className="space-y-3 sm:space-y-4">
        <p className="text-base sm:text-lg leading-relaxed text-foreground">{question.enunciado}</p>

        {/* Image if present (using status_imagem == 1 or existence of image urls) */}
        {(question.status_imagem === 1 || question.imagem_url || question.referencia_imagem) && (
          <div className="rounded-xl overflow-hidden border border-border bg-secondary/30 -mx-4 sm:mx-0">
            <img
              src={question.imagem_url || question.referencia_imagem || ''}
              alt="Imagem da questão"
              className="w-full max-h-60 sm:max-h-80 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
      </div>

      {/* Options */}
      <div className="space-y-3">
        {question.opcoes.map((opcao, index) => {
          if (!opcao || (typeof opcao === 'string' && opcao.trim() === '')) return null;
          return (
            <button
              key={index}
              onClick={() => handleOptionClick(index)}
              disabled={!canAnswer || showResult}
              className={cn(getOptionClass(index), "p-3 sm:p-4")}
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-secondary flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0">
                  {optionLabels[index]}
                </span>
                <span className="text-left flex-1 pt-0.5 sm:pt-1 text-sm sm:text-base">{opcao}</span>
                {getOptionIcon(index)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Result feedback and Resolution */}
      {showResult && (
        <div className="space-y-4 animate-scale-in">
          <div
            className={cn(
              'p-4 rounded-xl',
              selectedOption === question.resposta_correta
                ? 'bg-success/10 border border-success/30'
                : 'bg-destructive/10 border border-destructive/30'
            )}
          >
            <p className="font-medium">
              {selectedOption === question.resposta_correta
                ? '✓ Resposta correta!'
                : `✗ Resposta incorreta. A alternativa correta é: ${optionLabels[question.resposta_correta]}`}
            </p>
          </div>

          {/* Resolution/Explanation */}
          {question.output_explicacao && (
            <div className="p-4 sm:p-6 rounded-xl bg-primary/5 border border-primary/10 space-y-2 sm:space-y-3">
              <h4 className="text-sm sm:text-base font-semibold text-primary flex items-center gap-2">
                <Check className="w-4 h-4" />
                Resolução comentada
              </h4>
              <p className="text-sm sm:text-base text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {question.output_explicacao}
              </p>
            </div>
          )}
        </div>
      )}

      <ReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        type="question"
        targetId={question.id}
        targetName={`Questão ${question.banca} - ${question.ano}`}
      />
    </div>
  );
}
