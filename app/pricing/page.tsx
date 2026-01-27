import type { Metadata } from 'next';
import PricingClient from './PricingClient';

export const metadata: Metadata = {
    title: 'Planos e Preços | Gratuito ou Premium sem Anúncios',
    description: 'Compare os planos do medlibre: Gratuito com 20 questões/dia ou Premium ilimitado sem anúncios. Estude para residência médica sem cursinhos caros de R$ 3.000/mês.',
};

export default function PricingPage() {
    return <PricingClient />;
}
