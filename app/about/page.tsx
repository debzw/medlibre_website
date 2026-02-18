import type { Metadata } from 'next';
import { MethodologySection } from '@/components/landing/MethodologySection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { CTASection } from '@/components/landing/CTASection';


export const metadata: Metadata = {
    title: 'Sobre o Medlibre | Ciência e Liberdade na Medicina',
    description: 'O Medlibre é a revolução científica na preparação para residência médica. Estude com repetição espaçada e recuperação ativa em uma plataforma gratuita e sem anúncios entre questões.',
    keywords: ['sobre Medlibre', 'metodologia estudo médico', 'preparação residência gratuita', 'ciência cognitiva medicina'],
    openGraph: {
        title: 'Sobre o Medlibre | A Ciência por trás da Sua Aprovação',
        description: 'Conheça o banco de questões que está mudando as regras do jogo. Sem vídeo-aulas passivas, focado em resultados.',
        images: [{ url: '/logo.png' }],
    }
};

export default function AboutPage() {
    return (
        <main className="flex-1">
            {/* Hero / Intro Section */}
            <div className="container mx-auto px-4 py-24 pb-12">
                <div className="max-w-4xl mx-auto text-center space-y-6">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
                        A Ciência por trás da <span className="text-amber-500">Aprovação</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        O fim da era das vídeo-aulas.
                        <br />
                        Prepare-se com métodos baseados em evidências.
                    </p>
                </div>
            </div>

            {/* Main Content Sections */}
            <MethodologySection />

            <FeaturesSection />

            {/* Mission Section (Manifesto style) */}
            <section className="py-24 bg-muted/30">
                <div className="container mx-auto px-4">
                    <div className="max-w-3xl mx-auto space-y-12">
                        <div className="prose prose-lg dark:prose-invert mx-auto">
                            <h2 className="text-center text-4xl font-black mb-12">Nosso Manifesto</h2>
                            <div className="space-y-6 text-lg leading-relaxed text-muted-foreground">
                                <p>
                                    O medlibre nasceu de uma indignação: o mercado de educação médica tornou-se uma indústria de "cursinhos"
                                    que cobram fortunas por um modelo de ensino já ultrapassado.
                                </p>
                                <p>
                                    Assistir vídeo-aulas é confortável, mas ineficaz. A ciência cognitiva é clara:
                                    o aprendizado real acontece , como a <strong>Recuperação Ativa</strong> e a
                                    <strong> Repetição Espaçada</strong>.
                                </p>
                                <p className="text-xl font-medium text-foreground text-center py-8 border-y border-border/50">
                                    "Nossa missão é devolver o tempo ao estudante e o dinheiro ao médico.
                                    Educação de alta performance deve ser acessível e gratuita."
                                </p>
                                <p>
                                    Não vendemos esperança. Entregamos uma ferramenta de precisão para que você
                                    alcance sua vaga na residência sem se tornar refém de mensalidades altas.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <FAQSection />

            <CTASection />
        </main>
    );
}
