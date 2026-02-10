'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, Crown, User, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PricingClient() {
    const router = useRouter();

    const tiers = [
        {
            name: 'Visitante',
            icon: <User className="w-8 h-8 text-muted-foreground" />,
            description: 'Experimente a plataforma sem compromisso.',
            price: 'Grátis',
            cta: 'Começar Agora',
            onClick: () => router.push('/app'),
            features: [
                { name: '5 questões por dia', included: true },
                { name: 'Gabarito e resoluções', included: true },
                { name: 'Anúncios entre questões', included: false, isNegative: true },
                { name: 'Anúncios laterais', included: false, isNegative: true },
                { name: 'Modo Estudo Direcionado', included: false },
                { name: 'Estatísticas detalhadas', included: false },
                { name: 'Exportar PDF', included: false },
            ],
            highlight: false,
        },
        {
            name: 'Gratuito',
            icon: <UserPlus className="w-8 h-8 text-primary" />,
            description: 'Salve seu progresso e estude com foco.',
            price: 'Grátis',
            cta: 'Criar Conta',
            onClick: () => router.push('/auth'),
            features: [
                { name: '20 questões por dia', included: true },
                { name: 'Gabarito e resoluções', included: true },
                { name: 'Sem anúncios entre questões', included: true },
                { name: 'Modo Estudo Direcionado', included: true },
                { name: 'Estatísticas de desempenho', included: true },
                { name: 'Anúncios laterais', included: false, isNegative: true },
                { name: 'Exportar PDF', included: false },
            ],
            highlight: false,
        },
        {
            name: 'Premium',
            icon: <Crown className="w-8 h-8 text-amber-500" />,
            description: 'A experiência completa e ilimitada.',
            price: 'Grátis por enquanto!',
            cta: 'Assinar Agora',
            onClick: () => {
                console.log('Subscribe to premium');
            },
            features: [
                { name: 'Questões Ilimitadas', included: true },
                { name: 'Gabarito e resoluções', included: true },
                { name: 'Sem anúncios', included: true },
                { name: 'Modo Estudo Direcionado', included: true },
                { name: 'Estatísticas avançadas', included: true },
                { name: 'Exportar PDF', included: true },
                { name: 'Suporte prioritário', included: true },
            ],
            highlight: true,
        },
    ];

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-black mb-4">Escolha seu Plano</h1>
                    <p className="text-xl text-muted-foreground">
                        Comece grátis e faça upgrade quando quiser
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {tiers.map((tier, index) => (
                        <Card
                            key={index}
                            className={cn(
                                'relative overflow-hidden transition-all duration-300',
                                tier.highlight && 'border-primary shadow-lg scale-105'
                            )}
                        >
                            {tier.highlight && (
                                <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold rounded-bl-lg">
                                    POPULAR
                                </div>
                            )}
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-4">
                                    {tier.icon}
                                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                                </div>
                                <p className="text-sm text-muted-foreground">{tier.description}</p>
                                <div className="mt-4">
                                    <span className="text-3xl font-bold">{tier.price}</span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button
                                    onClick={tier.onClick}
                                    className="w-full"
                                    variant={tier.highlight ? 'default' : 'outline'}
                                >
                                    {tier.cta}
                                </Button>
                                <ul className="space-y-2">
                                    {tier.features.map((feature, featureIndex) => (
                                        <li key={featureIndex} className="flex items-center gap-2 text-sm">
                                            {feature.included ? (
                                                <Check className="w-4 h-4 text-green-500 shrink-0" />
                                            ) : (
                                                <X className={cn(
                                                    "w-4 h-4 shrink-0",
                                                    feature.isNegative ? "text-red-500" : "text-muted-foreground"
                                                )} />
                                            )}
                                            <span className={cn(
                                                !feature.included && "text-muted-foreground"
                                            )}>
                                                {feature.name}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <p className="text-sm text-muted-foreground">
                        Todos os planos incluem acesso ao banco de questões das principais bancas (USP, UNIFESP, ENARE)
                    </p>
                </div>
            </div>
        </div>
    );
}
