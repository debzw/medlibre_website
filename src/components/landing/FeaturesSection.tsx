import { ShieldCheck, BarChart2, Layout, GraduationCap } from 'lucide-react';

const features = [
    {
        title: 'Curadoria Especializada',
        description: 'Questões rigorosamente revisadas, resolvidas e categorizadas por quem entende de prova.',
        icon: ShieldCheck,
    },
    {
        title: 'Inteligência de Dados',
        description: 'Identifique seus pontos cegos com análise estatística de alta precisão.',
        icon: BarChart2,
    },
    {
        title: 'Foco de Performance',
        description: 'Sem distrações. Uma interface limpa projetada para manter você em estado de flow.',
        icon: Layout,
    },
    {
        title: 'Principais Instituições',
        description: 'Cobertura completa: USP, UNIFESP, ENARE, SUS-SP, UERJ e as maiores bancas do país.',
        icon: GraduationCap,
    },
];

export function FeaturesSection() {
    return (
        <section className="py-24 bg-background">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">A Plataforma Definitiva</h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Desenvolvida por médicos para quem busca a máxima eficiência no estudo para residência.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {features.map((feature, index) => (
                        <div key={index} className="flex gap-6 p-6 rounded-2xl bg-card border hover:border-amber-500/50 transition-colors group">
                            <div className="shrink-0">
                                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                                    <feature.icon className="w-6 h-6 text-amber-500" />
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold text-xl mb-2">{feature.title}</h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
