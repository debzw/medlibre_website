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

    const { options, loading: optionsLoading } = useFilterOptions();
    const { questions: allQuestions, loading: questionsLoading, error: questionsError, refetch } = useQuestions({
        banca: selectedBanca,
        ano: selectedAno,
        campo_medico: selectedCampo,
        especialidade: selectedEspecialidade,
        tema: selectedTemaUI,
        search: searchParams.get('search') || undefined,
        hideAnswered: hideAnswered
    });

    const { userType, canAnswerMore, incrementUsage, getRemainingQuestions } = useAuthContext();
    const { isQuestionAnswered: checkIfAnswered, getQuestionAttempts } = useQuestionHistory();
    const questionsAnsweredSinceAd = useRef(0);
    const timerRef = useRef<QuestionTimerRef>(null);
    const { toast } = useToast();

    const questions = useMemo(() => {
        const historyIds = new Set(questionHistory);
        if (!hideAnswered) return allQuestions;
        return allQuestions.filter(q =>
            !checkIfAnswered(q.id) ||
            q.id === currentQuestionId ||
            historyIds.has(q.id)
        );
    }, [allQuestions, hideAnswered, checkIfAnswered, currentQuestionId, questionHistory]);

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
                    <div className="text-center py-8 animate-fade-in">
                        {selectedCampo !== 'all' ? (
                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-[0.2em] mb-4">
                                    <TrendingUp className="h-3 w-3" />
                                    Modo Focado Ativo
                                </div>
                                <h1 className="text-4xl font-black mb-3 tracking-tighter">
                                    {selectedCampo}
                                </h1>
                                <p className="text-lg text-muted-foreground max-w-2xl mx-auto flex items-center gap-2">
                                    Extraindo o seu melhor em uma área crítica
                                </p>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-4xl font-bold mb-3 tracking-tight">
                                    Banco de Questões
                                </h1>
                                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
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
                        <div className="flex items-center justify-between text-sm text-muted-foreground animate-fade-in">
                            <span>Questão {currentQuestionIndex + 1} de {questions.length}</span>
                            <QuestionTimer ref={timerRef} />
                            <span>{getRemainingQuestions() === Infinity ? 'Ilimitado' : `${getRemainingQuestions()} restantes hoje`}</span>
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
                            title={hideAnswered ? "Você resolveu todas as questões deste bloco!" : "Nenhuma questão encontrada"}
                            description={allQuestions.length > 0 && hideAnswered
                                ? `Você já resolveu as ${allQuestions.length} questões carregadas. Desative o filtro 'Ocultar respondidas' para revê-las.`
                                : "Tente ajustar os filtros para encontrar mais questões."}
                            action={hideAnswered ? {
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
                            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 animate-fade-in shadow-sm rounded-xl py-2">
                                {historyIndex > 0 ? (
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        onClick={handlePreviousQuestion}
                                        className="gap-2 order-2 sm:order-1"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Questão Anterior
                                    </Button>
                                ) : (
                                    <div className="hidden sm:block sm:flex-1 order-1" />
                                )}

                                <Button
                                    size="lg"
                                    variant={isQuestionAnswered ? "default" : "secondary"}
                                    onClick={handleNextClick}
                                    className="gap-2 order-1 sm:order-2"
                                >
                                    {isQuestionAnswered ? "Próxima Questão" : "Pular Questão"}
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
