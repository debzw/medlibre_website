'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FilterBar } from '@/components/FilterBar';
import { QuestionCard } from '@/components/QuestionCard';
import { AdBanner } from '@/components/AdBanner';
import { AdModal } from '@/components/AdModal';
import { LimitReachedCard } from '@/components/LimitReachedCard';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { useQuestions, useFilterOptions } from '@/hooks/useQuestions';
import { useAuthContext } from '@/contexts/AuthContext';
import { useQuestionHistory } from '@/hooks/useQuestionHistory';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, TrendingUp } from 'lucide-react';
import { QuestionTimer, QuestionTimerRef } from '@/components/QuestionTimer';
import { useToast } from '@/hooks/use-toast';
import { AD_CONFIG } from '@/config/devMode';

export default function QuestionsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [selectedBanca, setSelectedBanca] = useState(searchParams.get('banca') || 'all');
    const [selectedAno, setSelectedAno] = useState(Number(searchParams.get('ano')) || 0);
    const [selectedCampo, setSelectedCampo] = useState(searchParams.get('campo') || 'all');
    const [selectedEspecialidade, setSelectedEspecialidade] = useState(searchParams.get('especialidade') || 'all');
    const [selectedTemaUI, setSelectedTemaUI] = useState(searchParams.get('tema') || 'all');
    const [hideAnswered, setHideAnswered] = useState(true);
    const [showAdModal, setShowAdModal] = useState(false);
    const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
    const [recentlyAnsweredId, setRecentlyAnsweredId] = useState<string | null>(null);
    const [questionHistory, setQuestionHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);

    // Sync state with search params when they change
    useEffect(() => {
        setSelectedBanca(searchParams.get('banca') || 'all');
        setSelectedAno(Number(searchParams.get('ano')) || 0);
        setSelectedCampo(searchParams.get('campo') || 'all');
        setSelectedEspecialidade(searchParams.get('especialidade') || 'all');
        setSelectedTemaUI(searchParams.get('tema') || 'all');
        setCurrentQuestionId(null);
        setQuestionHistory([]);
        setHistoryIndex(-1);
    }, [searchParams]);

    const status = searchParams.get('status') as 'all_answered' | 'correct' | 'incorrect' | null;

    const { options, loading: optionsLoading } = useFilterOptions();
    const { questions: allQuestions, loading: questionsLoading, error: questionsError, refetch } = useQuestions({
        banca: selectedBanca,
        ano: selectedAno,
        campo_medico: selectedCampo,
        especialidade: selectedEspecialidade,
        tema: selectedTemaUI,
        search: searchParams.get('search') || undefined,
        hideAnswered: status ? false : hideAnswered,
        status: status || undefined
    });

    const { userType, canAnswerMore, incrementUsage, getRemainingQuestions } = useAuthContext();
    const { isQuestionAnswered: checkIfAnswered, getQuestionAttempts } = useQuestionHistory();
    const questionsAnsweredSinceAd = useRef(0);
    const timerRef = useRef<QuestionTimerRef>(null);
    const { toast } = useToast();

    const questions = useMemo(() => {
        const historyIds = new Set(questionHistory);
        // If viewing status-based history, don't filter out answered questions
        if (status || !hideAnswered) return allQuestions;
        return allQuestions.filter(q =>
            !checkIfAnswered(q.id) ||
            q.id === currentQuestionId ||
            historyIds.has(q.id)
        );
    }, [allQuestions, hideAnswered, checkIfAnswered, currentQuestionId, questionHistory, status]);

    const showInterstitialAds = (
        (userType === 'guest' && AD_CONFIG.interstitial.enabledForGuest) ||
        (userType === 'free' && AD_CONFIG.interstitial.enabledForFree)
    ) && AD_CONFIG.enabled;

    const showLateralAds = (
        (userType === 'guest' && AD_CONFIG.lateral.enabledForGuest) ||
        (userType === 'free' && AD_CONFIG.lateral.enabledForFree) ||
        (userType === 'paid' && AD_CONFIG.lateral.enabledForPaid)
    ) && AD_CONFIG.enabled;

    const currentQuestionIndex = currentQuestionId ? questions.findIndex(q => q.id === currentQuestionId) : -1;
    const currentQuestion = currentQuestionIndex >= 0 ? questions[currentQuestionIndex] : null;

    useEffect(() => {
        // Case 1: Initial load or reset - No ID selected
        if (!currentQuestionId && questions.length > 0 && historyIndex === -1) {
            const firstId = questions[0].id;
            setCurrentQuestionId(firstId);
            setQuestionHistory([firstId]);
            setHistoryIndex(0);
        }
        // Case 2: Stale ID - Selected ID is not in the current list
        else if (currentQuestionId && questions.length > 0) {
            const isCurrentIdValid = questions.some(q => q.id === currentQuestionId);
            if (!isCurrentIdValid) {
                console.log("⚠️ Stale ID detected, resetting to first available question");
                const firstId = questions[0].id;
                setCurrentQuestionId(firstId);
                setQuestionHistory([firstId]);
                setHistoryIndex(0);
            }
        }
    }, [currentQuestionId, questions, historyIndex]);

    const historyEntry = currentQuestionId ? getQuestionAttempts(currentQuestionId)?.[0] : undefined;
    const isQuestionAnswered = !!historyEntry || recentlyAnsweredId === currentQuestionId;

    const handleAnswered = async (selectedAnswer: number, isCorrect: boolean) => {
        if (currentQuestionId) setRecentlyAnsweredId(currentQuestionId);
        timerRef.current?.pause();

        if (!isQuestionAnswered) {
            await incrementUsage();
            questionsAnsweredSinceAd.current += 1;
        }
    };

    const handleNextClick = () => {
        const shouldShowAd = showInterstitialAds && questionsAnsweredSinceAd.current >= AD_CONFIG.interstitial.frequency;

        if (shouldShowAd) {
            setShowAdModal(true);
            questionsAnsweredSinceAd.current = 0;
        } else {
            handleNextQuestion();
        }
    };

    const handlePreviousQuestion = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const previousId = questionHistory[newIndex];
            setHistoryIndex(newIndex);
            setCurrentQuestionId(previousId);
            timerRef.current?.reset();
        }
    };

    const handleNextQuestion = () => {
        if (historyIndex < questionHistory.length - 1) {
            const nextIndex = historyIndex + 1;
            const nextId = questionHistory[nextIndex];
            setHistoryIndex(nextIndex);
            setCurrentQuestionId(nextId);
            timerRef.current?.reset();
            return;
        }

        if (currentQuestionIndex < questions.length - 1) {
            const nextQuestion = questions[currentQuestionIndex + 1];

            const newHistory = [...questionHistory, nextQuestion.id];
            setQuestionHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);

            setCurrentQuestionId(nextQuestion.id);
            timerRef.current?.reset();
        } else {
            setCurrentQuestionId(null);
            setQuestionHistory([]);
            setHistoryIndex(-1);
            refetch();
            toast({
                title: "Gerando nova sessão",
                description: "Carregando mais questões baseadas no seu desempenho...",
            });
        }
    };

    const handleAdClose = () => {
        setShowAdModal(false);
        handleNextQuestion();
    };

    const resetFilters = () => {
        setCurrentQuestionId(null);
    };

    const updateSearchParams = (key: string, value: string | number) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === 'all' || value === 0) {
            params.delete(key);
        } else {
            params.set(key, value.toString());
        }
        router.push(`?${params.toString()}`, { scroll: false });
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex gap-6">
                {/* Main content */}
                <div className="flex-1 space-y-6">
                    {/* Hero section */}
                    <div className="text-center py-4 sm:py-8 animate-fade-in px-2">
                        {status ? (
                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] mb-3 sm:mb-4">
                                    <TrendingUp className="h-3 w-3" />
                                    {status === 'correct' ? 'Seus Acertos' : status === 'incorrect' ? 'Suas Falhas' : 'Questões Respondidas'}
                                </div>
                                <h1 className="text-2xl sm:text-4xl font-black mb-2 sm:mb-3 tracking-tighter">
                                    Histórico de Performance
                                </h1>
                                <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto flex items-center gap-2">
                                    {status === 'correct'
                                        ? 'Revisando as questões que você já domina'
                                        : status === 'incorrect'
                                            ? 'Focando no que ainda precisa ser superado'
                                            : 'Analise o seu progresso na plataforma'}
                                </p>
                            </div>
                        ) : selectedCampo !== 'all' ? (
                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] mb-3 sm:mb-4">
                                    <TrendingUp className="h-3 w-3" />
                                    Modo Focado Ativo
                                </div>
                                <h1 className="text-2xl sm:text-4xl font-black mb-2 sm:mb-3 tracking-tighter">
                                    {selectedCampo}
                                </h1>
                                <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto flex items-center gap-2">
                                    Extraindo o seu melhor em uma área específica
                                </p>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-3 tracking-tight">
                                    Banco de Questões
                                </h1>
                                <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                                    Prepare-se para a residência médica com questões de provas anteriores
                                </p>
                            </>
                        )}
                    </div>

                    {/* Filters */}
                    <FilterBar
                        options={options}
                        selectedBanca={selectedBanca}
                        selectedAno={selectedAno}
                        selectedCampo={selectedCampo}
                        hideAnswered={hideAnswered}
                        onBancaChange={(v) => {
                            setSelectedBanca(v);
                            updateSearchParams('banca', v);
                            resetFilters();
                        }}
                        onAnoChange={(v) => {
                            setSelectedAno(v);
                            updateSearchParams('ano', v);
                            resetFilters();
                        }}
                        onCampoChange={(v) => {
                            setSelectedCampo(v);
                            updateSearchParams('campo', v);
                            resetFilters();
                        }}
                        onHideAnsweredChange={(v) => {
                            if (userType === 'guest') {
                                router.push('/pricing');
                                return;
                            }
                            setHideAnswered(v);
                            resetFilters();
                        }}
                        loading={optionsLoading}
                    />

                    {/* Progress indicator */}
                    {questions.length > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-y-2 text-[10px] sm:text-xs text-muted-foreground animate-fade-in px-1">
                            <span className="bg-secondary/50 px-2 py-1 rounded-md">Questão {currentQuestionIndex + 1}/{questions.length}</span>
                            <div className="flex items-center justify-center">
                                <QuestionTimer ref={timerRef} />
                            </div>
                            <span className="bg-primary/5 text-primary px-2 py-1 rounded-md font-medium">
                                {getRemainingQuestions() === Infinity ? 'Ilimitado' : `${getRemainingQuestions()} r.`}
                            </span>
                        </div>
                    )}

                    {/* Content */}
                    {questionsLoading ? (
                        <LoadingState />
                    ) : questionsError ? (
                        <EmptyState
                            title="Erro ao carregar questões"
                            description={questionsError}
                            action={{
                                label: "Tentar Novamente",
                                onClick: () => refetch()
                            }}
                        />
                    ) : (!canAnswerMore() && !isQuestionAnswered) ? (
                        <LimitReachedCard />
                    ) : questions.length === 0 ? (
                        <EmptyState
                            title={status ? "Acabou a revisão?" : (hideAnswered ? "Você resolveu todas as questões deste bloco!" : "Nenhuma questão encontrada")}
                            description={status
                                ? "Você revisou todas as questões filtradas. Que tal praticar com conteúdos novos?"
                                : (allQuestions.length > 0 && hideAnswered
                                    ? `Você já resolveu as ${allQuestions.length} questões carregadas. Desative o filtro 'Ocultar respondidas' para revê-las.`
                                    : "Tente ajustar os filtros para encontrar mais questões.")
                            }
                            action={status ? {
                                label: "Ver Questões Novas",
                                onClick: () => {
                                    const params = new URLSearchParams();
                                    router.push(`?${params.toString()}`, { scroll: false });
                                    resetFilters();
                                }
                            } : hideAnswered ? {
                                label: "Ver Questões Respondidas",
                                onClick: () => setHideAnswered(false)
                            } : {
                                label: "Limpar Filtros",
                                onClick: () => {
                                    const params = new URLSearchParams();
                                    router.push(`?${params.toString()}`, { scroll: false });
                                    resetFilters();
                                }
                            }}
                        />
                    ) : currentQuestion ? (
                        <div className="space-y-6">
                            <QuestionCard
                                key={currentQuestion.id}
                                question={currentQuestion}
                                onAnswered={handleAnswered}
                                canAnswer={canAnswerMore()}
                                historyEntry={historyEntry}
                            />
                            <div className="flex justify-between items-center gap-4 animate-fade-in shadow-sm rounded-xl py-2">
                                {historyIndex > 0 ? (
                                    <Button
                                        size="default"
                                        variant="outline"
                                        onClick={handlePreviousQuestion}
                                        className="flex-1 sm:flex-none gap-2 h-11"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        <span className="hidden sm:inline">Questão Anterior</span>
                                        <span className="sm:hidden">Anterior</span>
                                    </Button>
                                ) : (
                                    <div className="hidden sm:block sm:flex-1" />
                                )}

                                <Button
                                    size="default"
                                    variant={isQuestionAnswered ? "default" : "secondary"}
                                    onClick={handleNextClick}
                                    className="flex-1 sm:flex-none gap-2 h-11"
                                >
                                    <span className="hidden sm:inline">{isQuestionAnswered ? "Próxima Questão" : "Pular Questão"}</span>
                                    <span className="sm:hidden">{isQuestionAnswered ? "Próxima" : "Pular"}</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 space-y-4 animate-fade-in">
                            <LoadingState />
                            <p className="text-muted-foreground">Selecionando a melhor questão para você...</p>
                        </div>
                    )}
                </div>

                {/* Sidebar ads - desktop only */}
                {showLateralAds && (
                    <aside className="hidden lg:block w-[200px] shrink-0">
                        <div className="sticky top-24">
                            <AdBanner variant="sidebar" />
                        </div>
                    </aside>
                )}
            </div>

            {/* Ad Modal */}
            <AdModal isOpen={showAdModal} onClose={handleAdClose} />
        </div>
    );
}
