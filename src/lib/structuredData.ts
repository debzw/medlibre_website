export const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "medlibre",
    "description": "Plataforma gratuita de preparação para residência médica",
    "url": "https://medlibre.com.br",
    "logo": "https://medlibre.com.br/logo.png",
    "sameAs": [
        "https://twitter.com/medlibre_",
        "https://instagram.com/medlibre"
    ],
    "contactPoint": {
        "@type": "ContactPoint",
        "email": "institucional@medlibre.com.br",
        "contactType": "Customer Support"
    }
};

export const webApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "medlibre",
    "applicationCategory": "EducationalApplication",
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "BRL"
    },
    "operatingSystem": "Web Browser"
};

export const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": "O medlibre é realmente gratuito?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Sim! O medlibre oferece acesso gratuito com 20 questões por dia no plano gratuito e 5 questões no modo visitante. Temos também uma opção premium ilimitada."
            }
        },
        {
            "@type": "Question",
            "name": "Como funciona o algoritmo de repetição espaçada?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Utilizamos algoritmos baseados na Curva do Esquecimento de Ebbinghaus. O sistema identifica temas que você errou ou teve dificuldade e as reapresenta em intervalos calculados."
            }
        },
        {
            "@type": "Question",
            "name": "Quais bancas estão disponíveis?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Contamos com questões de instituições como USP, UNIFESP, ENARE, SUS-SP, UERJ e muitas outras."
            }
        }
    ]
};
