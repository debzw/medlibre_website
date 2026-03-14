import type { Metadata } from 'next';
import PricingClient from './PricingClient';

export const metadata: Metadata = {
    title: 'Planos e Preços | Gratuito ou Premium sem Anúncios',
    description: 'Compare os planos do Medlibre: Gratuito com banco de questões diário ou Premium ilimitado sem anúncios. Estude para residência médica sem cursinhos caros de R$ 3.000/mês.',
    keywords: [
        'medlibre premium',
        'banco de questões residência preço',
        'cursinho residência médica alternativa',
        'preparação residência médica gratuita',
        'plataforma residência médica barata',
    ],
    openGraph: {
        title: 'Planos Medlibre | Gratuito ou Premium — Banco de Questões para Residência Médica',
        description: 'Plano gratuito com banco de questões diário ou Premium ilimitado. Sem cursinhos caros. Estude para residência com ciência.',
        type: 'website',
        url: 'https://medlibre.com.br/pricing',
        siteName: 'Medlibre',
        locale: 'pt_BR',
        images: [
            {
                url: '/logo.png',
                width: 1200,
                height: 630,
                alt: 'Medlibre - Planos e Preços',
            },
        ],
    },
    alternates: {
        canonical: 'https://medlibre.com.br/pricing',
    },
};

export default function PricingPage() {
    return <PricingClient />;
}
