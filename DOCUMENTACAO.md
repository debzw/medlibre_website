# Documentação do Sistema MedLibre 🚀

O MedLibre é uma plataforma freemium avançada de preparação para residência médica, projetada para otimizar o estudo através de evidências científicas (Active Recall e Spaced Repetition). Esta documentação detalha cada funcionalidade e o funcionamento lógico do site.

---

## 1. Core Vision (A Visão Central)
O objetivo do MedLibre é ser a alternativa inteligente aos "cursinhos" tradicionais. Enquanto os cursos convencionais focam em estudo passivo (videoaulas intermináveis), o MedLibre foca no **Direcionamento ao Erro** e na **Prática Constante**.

---

## 2. Página Inicial (Landing Page)
A porta de entrada do sistema comunica nossa filosofia e converte usuários.

- **Seção de Metodologia**: Explica o porquê de abandonarmos o estudo passivo. Utiliza ganchos provocativos contra o "Complexo Industrial das Videoaulas".
- **Seção de Funcionalidades**: Demonstra visualmente as ferramentas de SRS (Spaced Repetition System), Analytics e Banco de Questões.
- **FAQ**: Responde dúvidas comuns sobre o modelo freemium, conteúdos e acesso.
- **CTA (Call to Action)**: Focado em facilitar o cadastro rápido para que o aluno comece a praticar imediatamente.

---

## 3. Sistema de Questões (O Coração do Site)
Esta é a ferramenta principal onde o aluno passa a maior parte do tempo.

### 3.1. Questão (QuestionCard)
- **Vignette Clínica**: Apresentação clara e em alto contraste para facilitar a leitura de casos longos.
- **Alternativas Interativas**: Sistema de clique único com feedback visual imediato (Verde para correto, Vermelho para incorreto).
- **Resolução Detalhada**: Após responder, o sistema revela o comentário do professor, explicando não só a correta, mas por que as outras estão erradas (Direcionamento ao erro).

### 3.2. Filtros Avançados (Smart Filters)
O aluno pode personalizar seu treino por:
- **Especialidade**: Pediatria, GO, Clínica Médica, etc.
- **Banca/Instituição**: USP, UNIFESP, SURCE, etc.
- **Ano e Localidade**.
- **Lógica de Filtro**: Os filtros são reativos e permitem combinações complexas para simular provas específicas.

### 3.3. Feedback Metacognitivo
Uma funcionalidade única que pergunta ao aluno: *"Quão certo você estava desta resposta?"* ou *"Qual o nível de dificuldade?"*.
- **Objetivo**: Treinar a percepção do aluno sobre o próprio conhecimento, crucial para o dia da prova.

---

## 4. Dashboard do Aluno (Central de Comando)


---

## 5. Análise de Performance e Evolução
Páginas dedicadas a mergulhar fundo nos dados de estudo.

- **Evolução Temporal**: Gráficos de linha que mostram o crescimento da nota ao longo dos meses.
- **Análise por Tópico**: Identifica cirurgicamente quais subtemas (ex: "Cardiologia > Insuficiência Cardíaca") precisam de mais atenção.
- **Exportação (PDF)**: Capacidade de gerar relatórios de desempenho para acompanhamento externo ou arquivamento.

---

## 6. Lógica de Backend e Monetização
- **Autenticação**: Integrada com **Supabase Auth**, garantindo segurança e persistência de dados.
- **Modelo Freemium**: 
    - **Usuários Gratuitos**: Têm acesso a um número limitado de questões (geralmente as últimas 5 do dia ou limite global) e visualizam anúncios (Google AdSense).
    - **Usuários Premium**: Acesso ilimitado, dashboard avançado, relatórios PDF e experiência sem anúncios.
- **Sistema de Anúncios**: Implementado através do `AdBanner` e `AdModal`, garantindo que a plataforma permaneça sustentável para todos.

---

## 7. Padrões Visuais (Aesthetic)
O MedLibre utiliza uma identidade visual sofisticada:
- **Cores Semânticas**: Gold (Premium/Progresso), Indigo (Foco), Grey (Neutralidade).
- **Tipografia**: `Archivo Black` para títulos impactantes e `Lexend Deca` para legibilidade máxima no corpo do texto.
- **Modo Escuro (Dark Mode)**: Prioritário para reduzir o cansaço visual durante longas sessões de estudo noturno.
