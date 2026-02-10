import type { Metadata } from 'next';
import { FAQSection } from '@/components/landing/FAQSection';

export const metadata: Metadata = {
    title: 'SAC - Perguntas Frequentes',
    description: 'Central de Atendimento e Perguntas Frequentes (FAQ) do medlibre. Tire suas dúvidas sobre o banco de questões e metodologia.',
};

export default function SACPage() {
    return (
        <div className="min-h-[80vh] flex flex-col items-center py-12">
            <div className="w-full max-w-4xl mx-auto px-4">
                <div className="text-center mb-12 space-y-4">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase">SAC</h1>
                    <p className="text-xl text-muted-foreground">Central de Atendimento e Suporte</p>
                </div>

                <div className="bg-card border border-border/50 rounded-3xl p-2 md:p-8 shadow-sm">
                    <FAQSection />
                </div>

                <div className="mt-12 p-8 bg-secondary/30 rounded-3xl border border-border text-center space-y-4">
                    <h3 className="text-xl font-bold">Ainda tem dúvidas?</h3>
                    <p className="text-muted-foreground">
                        Se você não encontrou o que procurava, nossa equipe está pronta para ajudar.
                    </p>
                    <p className="text-primary font-bold text-lg">institucional@medlibre.com.br</p>
                </div>
            </div>
        </div>
    );
}
