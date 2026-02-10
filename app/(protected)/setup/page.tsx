'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSmartFilters } from '@/hooks/useSmartFilters';
import { ThinkingSearchBar } from '@/components/bridge/ThinkingSearchBar';
import { AliveFilter } from '@/components/bridge/AliveFilter';
import { Button } from '@/components/ui/button';
import { PlayCircle, Target, Loader2, Sparkles, FilterX, MoreVertical, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from '@/components/modals/ReportDialog';
import { useAuthContext } from '@/contexts/AuthContext';
import { ExportPDFModal } from '@/components/modals/ExportPDFModal';
import { generatePDF } from '@/utils/pdfGenerator';
import { fetchQuestionsForExport } from '@/services/questionService';
import { useToast } from '@/components/ui/use-toast';

export default function FocusedSetupPage() {
    const router = useRouter();
    const {
        isLoading,
        aliveOptions,
        selectedBanca,
        setSelectedBanca,
        selectedAno,
        setSelectedAno,
        selectedArea,
        setSelectedArea,
        selectedEspecialidade,
        setSelectedEspecialidade,
        selectedTema,
        setSelectedTema,
        totalFilteredQuestions,
        searchableTerms,
        stats,
        reset,
        searchQuery,
        setSearchQuery
    } = useSmartFilters();

    const { userType, profile } = useAuthContext();
    const { toast } = useToast();
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const isPremium = userType === 'paid';


    const handleStart = () => {
        // Intelligent Enter: If there's a very clear category match, select it instead of raw search
        if (!hasFilters && searchQuery.length >= 3) {
            const allOptions = [
                ...aliveOptions.bancas.map(i => ({ type: 'banca' as const, value: i[0], score: i[2] })),
                ...aliveOptions.areas.map(i => ({ type: 'area' as const, value: i[0], score: i[2] })),
                ...aliveOptions.especialidades.map(i => ({ type: 'especialidade' as const, value: i[0], score: i[2] })),
                ...aliveOptions.temas.map(i => ({ type: 'tema' as const, value: i[0], score: i[2] })),
            ];

            const bestMatch = allOptions
                .filter(opt => opt.score >= 80) // High confidence
                .sort((a, b) => b.score - a.score)[0];

            if (bestMatch) {
                if (bestMatch.type === 'banca') setSelectedBanca(bestMatch.value);
                if (bestMatch.type === 'area') setSelectedArea(bestMatch.value);
                if (bestMatch.type === 'especialidade') setSelectedEspecialidade(bestMatch.value);
                if (bestMatch.type === 'tema') setSelectedTema(bestMatch.value);
                setSearchQuery('');
                return; // Selection will trigger a re-render and user can start then
            }
        }

        const params = new URLSearchParams();
        if (selectedBanca) params.append('banca', selectedBanca);
        if (selectedAno) params.append('ano', selectedAno.toString());
        if (selectedArea) params.append('campo', selectedArea);
        if (selectedEspecialidade) params.append('especialidade', selectedEspecialidade);
        if (selectedTema) params.append('tema', selectedTema);

        if (searchQuery && searchQuery.trim().length > 0) {
            params.append('search', searchQuery);
        }

        router.push(`/app?${params.toString()}`);
    };

    const handleExportRequest = () => {
        if (!isPremium) {
            toast({
                title: "Funcionalidade Premium",
                description: "A exportação de PDF é exclusiva para usuários Premium.",
            });
            router.push('/pricing');
            return;
        }
        setIsExportModalOpen(true);
    };

    const handleConfirmExport = async (count: number) => {
        setIsGeneratingPDF(true);
        try {
            const filters = {
                banca: selectedBanca,
                ano: selectedAno,
                area: selectedArea,
                especialidade: selectedEspecialidade,
                tema: selectedTema
            };

            const questions = await fetchQuestionsForExport(filters, count);

            if (questions.length === 0) {
                toast({
                    title: "Nenhuma questão encontrada",
                    description: "Tente ajustar os filtros.",
                    variant: "destructive"
                });
                setIsExportModalOpen(false);
                return;
            }

            await generatePDF(questions, 'MedLibre-Caderno-Questoes.pdf');

            toast({
                title: "PDF gerado com sucesso!",
                description: "O download deve começar em instantes.",
            });
            setIsExportModalOpen(false);
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao gerar PDF",
                description: "Ocorreu um erro inesperado. Tente novamente.",
                variant: "destructive"
            });
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const hasFilters = !!(selectedBanca || selectedAno || selectedArea || selectedEspecialidade || selectedTema);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const canStart = (totalFilteredQuestions > 0 && hasFilters) || (searchQuery.length > 2);

            if (e.key === 'Enter' && canStart) {
                handleStart();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [totalFilteredQuestions, handleStart, searchQuery, hasFilters]);

    if (isLoading) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground animate-pulse">Sincronizando banco de questões...</p>
            </div>
        );
    }

    return (
        <div className="container max-w-5xl mx-auto px-4 py-20 min-h-[90vh] flex flex-col">
            {/* Header Area */}
            <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
                <div className="absolute right-0 top-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
                                <MoreVertical className="h-5 w-5 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem
                                onClick={() => setIsReportDialogOpen(true)}
                                className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/5"
                            >
                                <Flag className="h-4 w-4" />
                                Reportar erro no setup
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
                    <Target className="w-3 h-3" />
                    MODO FOCADO
                </div>
                <h1 className="text-5xl font-black mb-2 tracking-tight text-foreground leading-[1.15] py-2">
                    O que você quer <span className="text-primary italic">dominar</span> hoje?
                </h1>
            </div>

            <ReportDialog
                isOpen={isReportDialogOpen}
                onClose={() => setIsReportDialogOpen(false)}
                type="bridge"
                targetId="focused_setup_page"
                targetName="Página de Configuração (Modo Focado)"
            />

            {/* Main Filter Section */}
            <div className="flex-1 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 relative z-40">
                <ThinkingSearchBar
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    hasFilters={hasFilters}
                    onReset={reset}
                    aliveOptions={aliveOptions}
                    onIntentDetected={(type, value) => {
                        if (type === 'banca') setSelectedBanca(value);
                        if (type === 'area') setSelectedArea(value);
                        if (type === 'especialidade') setSelectedEspecialidade(value);
                        if (type === 'tema') setSelectedTema(value);
                    }}
                    isPremium={isPremium}
                    totalFilteredQuestions={totalFilteredQuestions}
                    onExport={handleExportRequest}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    <AliveFilter
                        label="Instituição"
                        options={aliveOptions.bancas}
                        selected={selectedBanca}
                        onSelect={setSelectedBanca}
                    />
                    <AliveFilter
                        label="Grande Área"
                        options={aliveOptions.areas}
                        selected={selectedArea}
                        onSelect={setSelectedArea}
                    />
                    <AliveFilter
                        label="Especialidade"
                        options={aliveOptions.especialidades}
                        selected={selectedEspecialidade}
                        onSelect={setSelectedEspecialidade}
                    />
                    <AliveFilter
                        label="Tema"
                        options={aliveOptions.temas}
                        selected={selectedTema}
                        onSelect={setSelectedTema}
                    />
                    <AliveFilter
                        label="Ano"
                        options={aliveOptions.anos}
                        selected={selectedAno}
                        onSelect={setSelectedAno}
                    />
                </div>

                {/* Bottom Action Bar - Now inside the filter block */}
                <div className="flex justify-center pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
                    <Button
                        size="lg"
                        onClick={handleStart}
                        disabled={(totalFilteredQuestions === 0 && searchQuery.length < 3) || (!hasFilters && searchQuery.length < 3)}
                        className="rounded-xl px-10 h-16 text-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        {(searchQuery.length > 2 && totalFilteredQuestions === 0) ? 'Buscar Questão' : 'Começar Agora'}
                    </Button>
                </div>
            </div>

            {/* Background Micro-decoration */}
            <div className="fixed top-1/4 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse" />
            <div className="fixed bottom-1/4 -left-20 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] -z-10" />
            <ExportPDFModal
                open={isExportModalOpen}
                onOpenChange={setIsExportModalOpen}
                totalAvailable={totalFilteredQuestions}
                onConfirm={handleConfirmExport}
                isGenerating={isGeneratingPDF}
            />
        </div>
    );
}
