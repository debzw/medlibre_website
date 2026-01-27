import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
    {
        question: 'O medlibre é realmente gratuito?',
        answer: 'Sim! Nossa missão é democratizar o acesso. Temos um plano gratuito generoso que permite estudar todos os dias. O plano Premium é para quem quer funcionalidades ilimitadas e apoiar o projeto.',
    },
    {
        question: 'As questões são comentadas?',
        answer: 'Sim, a grande maioria das questões possui gabarito comentado e explicações detalhadas sobre as alternativas corretas e incorretas.',
    },
    {
        question: 'Quais bancas estão disponíveis?',
        answer: 'Cobre as principais bancas do país, incluindo ENARE, USP-SP, UNIFESP, SUS-SP, UERJ, AMRIGS, entre outras. A base é atualizada constantemente.',
    },
    {
        question: 'Como funciona a Repetição Espaçada?',
        answer: 'O sistema analisa seus erros e acertos. Se você erra uma questão, ela reaparecerá em breve. Se acerta, ela demorará mais para aparecer. Isso otimiza seu tempo de estudo focando no que você realmente precisa.',
    },
];

export function FAQSection() {
    return (
        <section className="py-24 bg-muted/30">
            <div className="container mx-auto px-4 max-w-3xl">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Perguntas Frequentes</h2>
                    <p className="text-lg text-muted-foreground">
                        Tire suas dúvidas sobre a plataforma.
                    </p>
                </div>

                <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, index) => (
                        <AccordionItem key={index} value={`item-${index}`}>
                            <AccordionTrigger className="text-left text-lg font-medium">
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground leading-relaxed text-base">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </section>
    );
}
