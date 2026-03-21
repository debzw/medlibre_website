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
import { useQuestions, useFilterOptions, useQuestionById } from '@/hooks/useQuestions';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuestionHistory } from '@/hooks/useQuestionHistory';
import type { ConfidenceLevel } from '@/hooks/useQuestionHistory';
import { Button } from '@/components/ui/button';
import { MetacognitiveFeedback } from '@/components/MetacognitiveFeedback';
import { ArrowRight, ArrowLeft, TrendingUp, Search, Loader2 } from 'lucide-react';
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
    const testAd = searchParams.get('test_ad');
    const sharedQuestionId = searchParams.get('questao');
    const { question: sharedQuestion, loading: sharedLoading } = useQuestionById(sharedQuestionId);

    // Debug trigger for AdModal
    useEffect(() => {
        if (testAd) {
            setShowAdModal(true);
        }
    }, [testAd]);

    const { options, loading: optionsLoading } = useFilterOptions();
    const {
        questions: allQuestions,
        questionBuckets,
        loading: questionsLoading,
        loadingMore,
        error: questionsError,
        searchMeta,
        loadMore,
        refetch,
    } = useQuestions({
        banca: selectedBanca,
        ano: selectedAno,
        campo_medico: selectedCampo,
        especialidade: selectedEspecialidade,
        tema: selectedTemaUI,
        search: searchParams.get('search') || undefined,
        hideAnswered: status ? false : hideAnswered,
        status: status || undefined
    });

    const activeSearch = searchParams.get('search');
    const isSearchMode = !!(activeSearch && activeSearch.trim().length > 0);

    const { user, userType, canAnswerMore, getRemainingQuestions, isFirstGuestInterstitial, markInterstitialAsShown } = useAuthContext();
    const { isQuestionAnswered: checkIfAnswered, getQuestionAttempts, saveSRSFeedback } = useQuestionHistory();
    const questionsAnsweredSinceAd = useRef(0);
    const timerRef = useRef<QuestionTimerRef>(null);

    // ── Session tracking ──────────────────────────────────────────────────────
    const sessionIdRef = useRef<string>(crypto.randomUUID());
    const sessionStartedAt = useRef<number>(Date.now());
    const sessionQuestionsAttempted = useRef<number>(0);
    const sessionQuestionsCorrect = useRef<number>(0);

    // ── Study session lifecycle ───────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;

        supabase.rpc('start_study_session', {
            p_session_id: sessionIdRef.current,
            p_session_type: 'study',
        }).then(({ error }) => {
            if (error) console.warn('start_study_session:', error.message);
        });

        return () => {
            const totalTime = Math.round((Date.now() - sessionStartedAt.current) / 1000);
            supabase.rpc('end_study_session', {
                p_session_id: sessionIdRef.current,
                p_questions_attempted: sessionQuestionsAttempted.current,
                p_questions_correct: sessionQuestionsCorrect.current,
                p_total_time_seconds: totalTime,
            }).then(() => { }, (err: any) => console.warn('end_study_session:', err));
        };
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const { toast } = useToast();

    const questions = useMemo(() => {
        let base = allQuestions;
        if (sharedQuestion && !base.some(q => q.id === sharedQuestion.id)) {
            base = [sharedQuestion, ...base];
        }
        const historyIds = new Set(questionHistory);
        // If viewing status-based history, don't filter out answered questions
        if (status || !hideAnswered) return base;
        return base.filter(q =>
            !checkIfAnswered(q.id) ||
            q.id === currentQuestionId ||
            historyIds.has(q.id)
        );
    }, [allQuestions, sharedQuestion, hideAnswered, checkIfAnswered, currentQuestionId, questionHistory, status]);

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

    const handleAnswered = async (_selectedAnswer: number, isCorrect: boolean) => {
        if (currentQuestionId) setRecentlyAnsweredId(currentQuestionId);
        timerRef.current?.pause();

        if (!isQuestionAnswered) {
            // incrementUsage is handled by QuestionCard via the record_answer RPC result
            questionsAnsweredSinceAd.current += 1;
            sessionQuestionsAttempted.current += 1;
            if (isCorrect) sessionQuestionsCorrect.current += 1;
        }
    };

    const handleSRSFeedback = async (confidence: ConfidenceLevel) => {
        if (user && currentQuestionId) {
            await saveSRSFeedback({ questionId: currentQuestionId, confidence });
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

            if (isSearchMode && searchMeta.hasMore) {
                // Search mode: load next page via keyset pagination
                loadMore();
                toast({
                    title: "Carregando mais resultados",
                    description: "Buscando próximas questões relevantes...",
                });
            } else {
                refetch();
                toast({
                    title: "Gerando nova sessão",
                    description: "Carregando mais questões baseadas no seu desempenho...",
                });
            }
        }
    };

    const handleAdClose = () => {
        markInterstitialAsShown();
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

                    {/* Search context banner */}
                    {isSearchMode && searchMeta.layerUsed === 2 && searchMeta.correctedTerm && searchMeta.correctedTerm.toLowerCase() !== activeSearch?.toLowerCase() && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/5 border border-primary/15 text-sm text-muted-foreground animate-fade-in">
                            <Search className="h-4 w-4 text-primary shrink-0" />
                            <span>
                                Mostrando resultados para{' '}
                                <span className="font-semibold text-foreground">{searchMeta.correctedTerm}</span>
                                {' '}(corrigido de{' '}
                                <span className="italic">{activeSearch}</span>)
                            </span>
                        </div>
                    )}

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
                            <span className="bg-secondary/50 px-2 py-1 rounded-md">Questão {currentQuestionIndex + 1}</span>
                            <div className="flex items-center justify-center">
                                <QuestionTimer ref={timerRef} />
                            </div>
                            <span className="bg-primary/5 text-primary px-2 py-1 rounded-md font-medium">
                                {getRemainingQuestions() === Infinity ? 'Ilimitado' : `${getRemainingQuestions()} r.`}
                            </span>
                        </div>
                    )}

                    {/* Content */}
                    {(sharedQuestionId ? sharedLoading : questionsLoading) ? (
                        <LoadingState message={
                            isSearchMode
                                ? (activeSearch && activeSearch.trim().split(/\s+/).length > 4
                                    ? 'A analisar caso clínico...'
                                    : 'A pesquisar questões...')
                                : 'Carregando questões...'
                        } />
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
                                sourceBucket={questionBuckets[currentQuestion.id] ?? 'unknown'}
                                sessionId={user ? sessionIdRef.current : undefined}
                            />
                            <div className="flex flex-row justify-between items-center gap-2 sm:gap-4 animate-fade-in py-2 w-full">
                                {historyIndex > 0 ? (
                                    <Button
                                        size="default"
                                        variant="outline"
                                        onClick={handlePreviousQuestion}
                                        className="w-auto h-11 rounded-full shrink-0 px-3 sm:px-4"
                                    >
                                        <ArrowLeft className="w-4 h-4 sm:mr-2" />
                                        <span className="hidden sm:inline">Questão Anterior</span>
                                    </Button>
                                ) : (
                                    <div className="hidden sm:block sm:w-[150px] shrink-0" />
                                )}

                                {isQuestionAnswered && (
                                    <div className="flex-1 flex justify-center w-full pb-1 lg:pb-0 relative z-10">
                                        <MetacognitiveFeedback onFeedback={handleSRSFeedback} isLoggedIn={!!user} />
                                    </div>
                                )}

                                <Button
                                    size="default"
                                    variant={isQuestionAnswered ? "default" : "secondary"}
                                    onClick={handleNextClick}
                                    disabled={loadingMore}
                                    className="w-auto h-11 rounded-full shrink-0 shadow-sm px-3 sm:px-4"
                                >
                                    {loadingMore ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin sm:mr-2" />
                                            <span className="hidden sm:inline">Carregando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="hidden sm:inline sm:mr-2">{isQuestionAnswered ? "Próxima Questão" : "Pular Questão"}</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
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
                            <AdBanner variant="sidebar" slotId="8374377363" />
                        </div>
                    </aside>
                )}
            </div>

            {/* Ad Modal */}
            <AdModal
                isOpen={showAdModal}
                onClose={handleAdClose}
                isLoginCTA={(userType === 'guest' && isFirstGuestInterstitial) || testAd === 'cta'}
            />
        </div>
    );
}
