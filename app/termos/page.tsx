import React from 'react';

export default function TermsOfServicePage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Termos de Uso</h1>
            <p className="text-sm text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

            <div className="space-y-6 text-foreground/90 leading-relaxed">
                <section>
                    <h2 className="text-2xl font-semibold mb-3 text-primary">1. Aceitação dos Termos</h2>
                    <p>
                        Ao acessar e utilizar o MedLibre, você concorda em cumprir e estar vinculado a estes Termos de Uso.
                        Se você não concordar com qualquer parte destes termos, não deverá utilizar nossa plataforma.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3 text-primary">2. Uso da Plataforma</h2>
                    <p className="mb-2">A plataforma MedLibre é destinada ao auxílio no estudo para provas de residência médica. Você se compromete a:</p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Fornecer informações precisas e verídicas no cadastro.</li>
                        <li>Manter a segurança de sua senha e conta.</li>
                        <li>Não utilizar a plataforma para fins ilegais ou não autorizados.</li>
                        <li>Não tentar interferir na integridade ou segurança do sistema.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3 text-primary">3. Propriedade Intelectual</h2>
                    <p>
                        Todo o conteúdo da plataforma, incluindo textos, gráficos, logos, ícones e software, é de propriedade do MedLibre
                        ou de seus licenciadores e está protegido por leis de direitos autorais. O uso da plataforma não concede a você
                        qualquer direito de propriedade sobre o conteúdo acessado.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3 text-primary">4. Limitação de Responsabilidade</h2>
                    <p>
                        O MedLibre fornece ferramentas de estudo, mas não garante a aprovação em exames ou a precisão absoluta de todas
                        as questões, que servem apenas como material de apoio. Não somos responsáveis por decisões clínicas tomadas com base no conteúdo da plataforma.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3 text-primary">5. Modificações nos Termos</h2>
                    <p>
                        Reservamos o direito de modificar estes termos a qualquer momento. Alterações significativas serão comunicadas
                        na plataforma ou por e-mail. O uso continuado após as mudanças constitui sua aceitação dos novos termos.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3 text-primary">6. Rescisão</h2>
                    <p>
                        Podemos suspender ou encerrar seu acesso à plataforma imediatamente, sem aviso prévio, caso você viole estes Termos de Uso.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-3 text-primary">7. Contato</h2>
                    <p>
                        Para dúvidas relacionadas a estes Termos de Uso, entre em contato pelo e-mail:
                        <a href="mailto:institucional@medlibre.com.br" className="text-primary hover:underline ml-1">institucional@medlibre.com.br</a>.
                    </p>
                </section>
            </div>
        </div>
    );
}
