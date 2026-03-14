import type { Metadata } from 'next';
import { FAQSection } from '@/components/landing/FAQSection';

export const metadata: Metadata = {
    title: 'SAC - Perguntas Frequentes | Medlibre',
    description: 'Central de Atendimento e Perguntas Frequentes (FAQ) do Medlibre. Tire suas dúvidas sobre o banco de questões gratuito para residência médica, repetição espaçada e metodologia.',
    keywords: [
        'medlibre suporte',
        'banco de questões residência dúvidas',
        'faq residência médica',
        'perguntas frequentes medlibre',
        'repetição espaçada dúvidas',
    ],
    openGraph: {
        title: 'SAC - Perguntas Frequentes | Medlibre',
        description: 'Tire suas dúvidas sobre o banco de questões gratuito para residência médica do Medlibre.',
        type: 'website',
        url: 'https://medlibre.com.br/sac',
        siteName: 'Medlibre',
        locale: 'pt_BR',
    },
    alternates: {
        canonical: 'https://medlibre.com.br/sac',
    },
};

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'O Medlibre é realmente gratuito?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Sim! Nossa missão é democratizar o acesso. Temos um plano gratuito generoso que permite estudar todos os dias. O plano Premium é para quem quer funcionalidades ilimitadas e apoiar o projeto.',
            },
        },
        {
            '@type': 'Question',
            name: 'As questões são comentadas?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Sim, a grande maioria das questões possui gabarito comentado e explicações detalhadas sobre as alternativas corretas e incorretas.',
            },
        },
        {
            '@type': 'Question',
            name: 'Quais bancas estão disponíveis?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'O Medlibre cobre as principais bancas do país, incluindo UNIFESP, ENARE, USP-SP, SUS-SP, UERJ, AMRIGS, entre outras. A base é atualizada constantemente.',
            },
        },
        {
            '@type': 'Question',
            name: 'Como funciona a Repetição Espaçada?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'O sistema analisa seus erros e acertos. Se você erra uma questão, ela reaparecerá em breve. Se acerta, ela demorará mais para aparecer. Isso otimiza seu tempo de estudo focando no que você realmente precisa.',
            },
        },
    ],
};

export default function SACPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
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
        </>
    );
}
