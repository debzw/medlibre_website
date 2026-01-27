import { Brain, Repeat, Zap } from 'lucide-react';

export function MethodologySection() {
    return (
        <section className="py-24 bg-muted/30">
            <div className="container mx-auto px-4">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Neurociência da Aprendizagem</h2>
                    <p className="text-lg text-muted-foreground">
                        Nossa plataforma é construída sobre os pilares da ciência cognitiva moderna.
                        Substituímos o consumo passivo de conteúdo por processos que garantem a consolidação da memória.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
                    <div className="bg-card p-8 rounded-2xl border shadow-sm hover:shadow-md transition-all">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-6">
                            <Repeat className="w-6 h-6 text-amber-500" />
                        </div>
                        <h3 className="text-2xl font-bold mb-4">Sistemas de Repetição Inteligente</h3>
                        <p className="text-muted-foreground leading-relaxed mb-6">
                            Utilizamos algoritmos de repetição espaçada (SRS) para combater a Curva do Esquecimento.
                            O sistema identifica os temas que exigem reforço e os reapresenta em intervalos otimizados para a memória de longo prazo.
                        </p>
                        <div className="bg-muted p-4 rounded-lg text-sm">
                            <strong>Eficiência:</strong> Otimize seu tempo focando exatamente no que o seu cérebro está prestes a esquecer.
                        </div>
                    </div>

                    <div className="bg-card p-8 rounded-2xl border shadow-sm hover:shadow-md transition-all">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-6">
                            <Zap className="w-6 h-6 text-amber-500" />
                        </div>
                        <h3 className="text-2xl font-bold mb-4">Recuperação Ativa (Active Recall)</h3>
                        <p className="text-muted-foreground leading-relaxed mb-6">
                            Estudar por questões não é apenas praticar; é uma intervenção cognitiva.
                            Ao recuperar a informação ativamente, você fortalece as conexões neurais de forma muito mais profunda do que pela leitura passiva.
                        </p>
                        <div className="bg-muted p-4 rounded-lg text-sm">
                            <strong>Resultado:</strong> Segurança absoluta na tomada de decisão durante a prova.
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
