import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export function CTASection() {
    return (
        <section className="py-24 border-t bg-gradient-to-b from-background to-amber-500/5">
            <div className="container mx-auto px-4 text-center">
                <h2 className="text-4xl md:text-5xl font-black mb-6">
                    Pronto para sua aprovação?
                </h2>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                    Junte-se a milhares de estudantes que estão revolucionando sua forma de estudar.
                    Comece gratuitamente hoje mesmo.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href="/auth">
                        <Button size="lg" className="h-14 px-8 text-lg btn-amber rounded-full">
                            <Sparkles className="w-5 h-5 mr-2" />
                            Começar Agora Grátis
                        </Button>
                    </Link>
                    <Link href="/about">
                        <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full">
                            Saber mais sobre o método
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
