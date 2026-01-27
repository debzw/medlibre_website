'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Target } from 'lucide-react';


export default function LandingPageClient() {
    const router = useRouter();

    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            // Allow only letters (a-z, A-Z), Enter, and Space
            const isLetter = /^[a-zA-Z]$/.test(event.key);
            const isEnter = event.key === 'Enter';
            const isSpace = event.key === ' ';

            if (isLetter || isEnter || isSpace) {
                router.push('/app');
            }
        };

        window.addEventListener('keydown', handleKeyPress);

        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [router]);

    return (
        <div className="min-h-screen bg-background relative flex flex-col">
            {/* Background decoration */}
            <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />

            {/* Hero Section - Full Viewport */}
            <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative">
                <div className="max-w-4xl w-full text-center space-y-12 animate-fade-in z-10">
                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-6">
                            <div className="animate-fade-in">
                                <img src="/logo_withname.svg" alt="medlibre" className="h-20 md:h-32 mx-auto dark:hidden" />
                                <img src="/logo_withname_white.svg" alt="medlibre" className="h-20 md:h-32 mx-auto hidden dark:block" />
                            </div>
                        </div>
                        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            Mudando o jogo. <br />
                            O fim da era das vídeo-aulas.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 max-w-xl mx-auto w-full px-4">
                        <Button
                            size="lg"
                            className="h-auto py-8 text-lg flex flex-col gap-3 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-primary/25 border border-primary/20"
                            onClick={() => router.push('/app')}
                        >
                            <Sparkles className="w-8 h-8 mb-1 text-primary-foreground/90" />
                            <div>
                                <span className="font-bold block text-xl">Não pensa, só vai</span>
                                <span className="text-sm font-normal opacity-90">Deixa o algoritmo te levar</span>
                            </div>
                        </Button>

                        <Button
                            size="lg"
                            variant="outline"
                            className="h-auto py-8 text-lg flex flex-col gap-3 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur border-border hover:border-primary/50 hover:bg-primary/5"
                            onClick={() => router.push('/setup')}
                        >
                            <Target className="w-8 h-8 mb-1 text-primary" />
                            <div>
                                <span className="font-bold block text-xl">Modo Focado</span>
                                <span className="text-sm font-normal text-muted-foreground">Escolha temas específicos</span>
                            </div>
                        </Button>
                    </div>

                    <div className="pt-8">
                        <p className="text-sm text-muted-foreground/60">
                            Pressione <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100"><span className="text-xs">Enter</span></kbd> para começar agora
                        </p>
                    </div>
                </div>


            </div>
        </div>
    );
}
