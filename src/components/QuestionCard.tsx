import { useState, useEffect, useRef, useCallback } from 'react';
import { Question, QuestionHistoryEntry } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, MoreVertical, Flag, Link } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuestionHistory } from '@/hooks/useQuestionHistory';
import type { ConfidenceLevel } from '@/hooks/useQuestionHistory';
import { MetacognitiveFeedback } from './MetacognitiveFeedback';
import { useAuthContext } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdBanner } from './AdBanner';
import { ReportDialog } from './modals/ReportDialog';
import { toast } from '@/components/ui/sonner';

interface QuestionCardProps {
  question: Question;
  onAnswered: (selectedAnswer: number, isCorrect: boolean) => void;
  canAnswer: boolean;
  historyEntry?: QuestionHistoryEntry;
  sourceBucket?: string;
  sessionId?: string;
}

export function QuestionCard({ question, onAnswered, canAnswer, historyEntry, sourceBucket = 'unknown', sessionId }: QuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const { saveAnswer, saveSRSFeedback } = useQuestionHistory();
  const { user, userType, incrementUsage } = useAuthContext();
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  // ── Idempotency: one UUID per question-view, reset when question changes ──
  // This UUID is passed to the DB. The UNIQUE constraint on idempotency_key
  // ensures that even if handleOptionClick fires twice (double-click, StrictMode,
  // network retry), only ONE row is ever inserted.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  // ── Mutex: prevents the async saveAnswer from being called a second time
  // while the first is still in-flight (belt-and-suspenders alongside idempotency key).
  const isSavingRef = useRef<boolean>(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/app?questao=${question.id}`;
    navigator.clipboard.writeText(url)
      .then(() => toast('Link copiado!', { description: 'Cole para compartilhar esta questão.', duration: 2500 }))
      .catch(() => toast('Erro ao copiar link'));
  };

  // Reset state AND generate a fresh idempotency key when the question changes
  useEffect(() => {
    setSelectedOption(null);
    setShowResult(false);
    startTimeRef.current = Date.now();
    idempotencyKeyRef.current = crypto.randomUUID();
    isSavingRef.current = false;
  }, [question.id]);

  const handleOptionClick = useCallback(async (index: number) => {
    // Guard: already answered or mid-save (mutex prevents ghost data)
    if (!canAnswer || showResult || isSavingRef.current) return;

    const isCorrect = index === question.resposta_correta;
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);

    // Lock immediately — before any async work
    isSavingRef.current = true;

    setSelectedOption(index);
    setShowResult(true);

    // Save to history if user is logged in
    if (user) {
      try {
        const result = await saveAnswer({
          questionId: question.id,
          selectedAnswer: index,
          isCorrect,
          timeSpentSeconds: timeSpent,
          campo_medico: question.campo_medico,
          banca: question.banca,
          idempotencyKey: idempotencyKeyRef.current,
          sourceBucket,
          sessionId,
        });

        // Update daily usage count instantly using the authoritative count from the DB response
        // (result is { today_count: number } for authenticated users)
        if (result && 'today_count' in result && typeof result.today_count === 'number') {
          incrementUsage(result.today_count);
        }
      } catch (error) {
        console.error('Failed to save answer:', error);
        // Don't unlock isSavingRef — the answer is shown, we don't want a retry
      }
    } else {
      // Guest user path
      incrementUsage();
    }

    onAnswered(index, isCorrect);
  }, [canAnswer, showResult, user, question, saveAnswer, onAnswered]);

  const handleSRSFeedback = async (confidence: ConfidenceLevel) => {
    if (user) {
      await saveSRSFeedback({ questionId: question.id, confidence });
    }
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
  const optionImageKeys: (keyof Question)[] = ['imagem_alt_a', 'imagem_alt_b', 'imagem_alt_c', 'imagem_alt_d', 'imagem_alt_e'];

  // Check if texto_base is substantially different from enunciado
  const showTextoBase = question.texto_base &&
    question.texto_base.trim() !== "" &&
    question.texto_base.trim() !== question.enunciado.trim();

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
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"
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
            <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
              <Link className="h-4 w-4" />
              Copiar link
            </DropdownMenuItem>
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
      <div className="space-y-4">
        {showTextoBase && (
          <div className="p-4 rounded-xl bg-secondary/20 border-l-4 border-primary/30 text-sm sm:text-base text-foreground/70 italic leading-relaxed whitespace-pre-wrap">
            {question.texto_base}
          </div>
        )}
        <p className="text-base sm:text-lg leading-relaxed text-foreground font-medium whitespace-pre-wrap">
          {question.enunciado}
        </p>

        {/* Image if present (using status_imagem == 1 or existence of image urls) */}
        {(question.status_imagem === 1 || question.imagem_nova || question.referencia_imagem) && (
          <div className="rounded-xl overflow-hidden border border-border bg-secondary/30 -mx-4 sm:mx-0">
            <img
              src={question.imagem_nova || question.referencia_imagem || ''}
              alt="Imagem da questão"
              className="w-full max-h-60 sm:max-h-80 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
      </div>

      {/* Ad Banner for mobile - Only shown for free/guest users */}
      {userType !== 'paid' && (
        <div className="md:hidden py-1">
          <AdBanner variant="horizontal" className="h-[100px] border-dashed border-2 border-border/30 rounded-xl" slotId="7061295697" />
        </div>
      )}

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
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-secondary flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0">
                    {optionLabels[index]}
                  </span>
                  <span className="text-left flex-1 pt-0.5 sm:pt-1 text-sm sm:text-base">{opcao}</span>
                  {getOptionIcon(index)}
                </div>

                {/* Alternative Image if present */}
                {question[optionImageKeys[index]] && (
                  <div className="ml-9 sm:ml-11 rounded-lg overflow-hidden border border-border/50 bg-white/5 max-w-xs">
                    <img
                      src={question[optionImageKeys[index]] as string}
                      alt={`Imagem alternativa ${optionLabels[index]}`}
                      className="w-full h-auto object-contain max-h-40"
                      onError={(e) => {
                        (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                      }}
                    />
                  </div>
                )}
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

          {/* Feedback Metacognitivo – alimenta o algoritmo SRS */}
          <MetacognitiveFeedback onFeedback={handleSRSFeedback} isLoggedIn={!!user} />
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
