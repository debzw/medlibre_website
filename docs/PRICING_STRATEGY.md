# Medlibre — Estratégia de Preços e Análise de Mercado

> Documento interno. Atualizado em março de 2026.

---

## 1. Estrutura de Preços Definida

| Plano | Preço | Total Anual | Desconto |
|---|---|---|---|
| **Mensal** | R$ 59,90/mês | R$ 718,80 | — |
| **Anual (Promoção)** | R$ 39,90 × 12 | R$ 478,80 | **33% off** |

### Regras de apresentação

- Sempre exibir R$ 59,90 riscado ao lado de R$ 39,90 no plano anual (âncora visual)
- Framing: "R$ 39,90/mês" — nunca "R$ 478,80/ano" (equivalente mensal converte melhor)
- Nomear o plano anual: **"Anual — Acesso Completo"**
- Nomear o plano mensal: **"Mensal — Sem Compromisso"**

---

## 2. Tiers do Produto

| | Visitante | Explorador | Premium |
|---|---|---|---|
| **Preço** | Grátis | Grátis | R$59,90/mês ou R$39,90×12 |
| Questões/dia | 5 | 20 | **Ilimitado** |
| Anúncios | Intersticial + Lateral | Lateral apenas | **Nenhum** |
| SRS (FSRS v4.5) | Não | Sim | Sim |
| Estatísticas | Básico | Completo | Completo |
| Modo Simulado | Não | Não | Sim |
| PDF Export | Não | Não | Sim (20/dia) |
| Suporte prioritário | Não | Não | Sim |

### Filosofia dos tiers

- **Visitante** → funil de aquisição via SEO/tráfego direto
- **Explorador** → motor de retenção e formação de hábito; NÃO cortar features — precisa ser genuinamente útil
- **Premium** → receita; o plano anual é o produto real a ser convertido

---

## 3. Calendário de Promoções

| Promoção | Desconto | Gatilho | Duração |
|---|---|---|---|
| **Fundadores** | 65% off anual → R$ 249/ano | Beta exit / lançamento | 30 dias, 500 vagas |
| **Early Adopter** | 50% off anual → R$ 349/ano | Campanha pós-fundadores | 60 dias |
| **Preço padrão** | 33% off anual → R$ 39,90×12 | Permanente | Indefinido |
| **Black November** | 40% off mensal | Novembro | 7–14 dias |
| **Véspera de Prova** (ENARE Jan/Fev) | 20% off mensal | Época de provas | 2 semanas |
| **Indicação** | 1 mês grátis por indicado pagante | Programa de referral | Sempre ativo |
| **Estudante verificado** | 15% off | Verificação de matrícula | Sempre ativo |

> **Regra:** nunca descontar abaixo de R$ 249/ano. Abaixo disso, desvaloriza o produto e atrai usuários com alta propensão ao churn.

---

## 4. Análise Competitiva

### Mapa de posicionamento

```
                    PREÇO ALTO
                        │
    MedGrupo            │          Medway
    (R$20-33k/ano)      │          (R$9.5-27k/ano)
                        │
    MedCof      Aristo  │
    (R$10-28k)          │
─────────────────────────────────────── QUALIDADE DO ALGORITMO
  PASSIVO/SEM           │              ALTO/ATIVO
    Estratégia MED      │
    (R$3.5k/ano)        │
                        │
    SanarFlix   MedQ    │
    (R$599/ano)(R$1.2k) │  ← Medlibre Premium →
                        │   (R$479/ano)
    Medeor              │
    (R$359/ano)         │
─────────────────────────────────────── PREÇO
                   GRATUITO
    Medlibre Free
    (20q/dia + ads)
```

### Tabela comparativa

| Concorrente | Preço/Ano | Algoritmo SRS | Tier Gratuito | Ponto Fraco |
|---|---|---|---|---|
| Medeor | R$ 359 | Nenhum | Trial 7 dias | Sem SRS, UX básico |
| SanarFlix | R$ 599 | Básico | Não | Vídeo-centrado, sem FSRS |
| MedQ | R$ 1.187 | Não confirmado | Não | Sem tier gratuito, caro |
| Estratégia MED | R$ 3.498 | Nenhum | Não | Passivo, sem SRS |
| Medcel/Afya | R$ 2k–18k | Nenhum | Não | Modelo ultrapassado, caro |
| Medway | R$ 9,5k–27,6k | Nenhum | Não | Foco em OSCE, ultra-premium |
| MedCof | R$ 10k–28,5k | Nenhum | Não | Extensivo completo |
| **MedLibre** | **R$ 0 + R$ 479/ano** | **FSRS v4.5 + LECTOR** | **Sim (20q/dia)** | Banco menor, marca nova |

### Vantagens competitivas reais

1. **Único com FSRS v4.5** — concorrentes usam SM-2 ou nenhum algoritmo
2. **Sistema LECTOR** — mitigação de interferência semântica (conceito patenteável)
3. **Tier gratuito genuinamente útil** — 20 questões/dia remove barreiras de entrada
4. **Zero conteúdo passivo** — diferenciação ideológica com a cultura de medicina baseada em evidências
5. **Preço disruptivo** — 60% mais barato que MedQ, 87% mais barato que Estratégia MED

---

## 5. Mercado Endereçável

| Métrica | Valor | Fonte |
|---|---|---|
| Candidatos ENARE 2025 | 138.974 (+56% YoY) | Agência Brasil, ago/2025 |
| Candidatos residência médica/ano (estimativa) | ~87.000 | ENARE 2025 |
| Vagas de residência disponíveis | ~16.189–54.402 | Estratégia MED, 2025 |
| Razão candidatos/vaga (ENARE) | ~12,4:1 | ENARE 2025 |
| Receita Afya (segmento educação continuada) | R$ 3,3B (2024) | Afya IR |
| Receita MedCof (referência) | R$ 22M com 11.500 alunos | Exame, 2022 |

### TAM / SAM / SOM

| | Valor | Base de cálculo |
|---|---|---|
| **TAM** | R$ 1,5B–2,8B/ano | 87k candidatos × gasto médio vitalício em preparação |
| **SAM** | R$ 312M–624M/ano | Segmento bancos de questões standalone; 30–40% dos candidatos × R$ 600–3.500/ano |
| **SOM Y1–Y3** | R$ 1,5M–12M/ano | 0,5–4% de participação no SAM — realista para entrada freemium disruptiva |

---

## 6. Economia Unitária

| Métrica | Conservador | Base | Otimista |
|---|---|---|---|
| ARPU anual (mix mensal+anual) | R$ 480 | R$ 540 | R$ 600 |
| Custo infra/usuário/ano | R$ 30 | R$ 20 | R$ 15 |
| Manutenção de conteúdo/usuário/ano | R$ 20 | R$ 15 | R$ 10 |
| **Margem Bruta** | **77%** | **90%** | **93%** |
| Ciclo médio de estudo (anos) | 1,5 | 2 | 2,5 |
| **LTV** | R$ 720 | R$ 1.080 | R$ 1.500 |
| CAC alvo (orgânico + referral) | R$ 30 | R$ 20 | R$ 10 |
| **LTV:CAC** | **24:1** | **54:1** | **150:1** |

---

## 7. Projeção de Receita

### Conservador
| Ano | Usuários Gratuitos | Usuários Pagos | Conversão | ARR |
|---|---|---|---|---|
| Y1 | 5.000 | 200 | 4% | R$ 96K |
| Y2 | 20.000 | 1.000 | 5% | R$ 480K |
| Y3 | 50.000 | 3.500 | 7% | R$ 1,7M |

### Base
| Ano | Usuários Gratuitos | Usuários Pagos | Conversão | ARR |
|---|---|---|---|---|
| Y1 | 10.000 | 500 | 5% | R$ 240K |
| Y2 | 40.000 | 2.800 | 7% | R$ 1,3M |
| Y3 | 100.000 | 9.000 | 9% | R$ 4,3M |

### Otimista
| Ano | Usuários Gratuitos | Usuários Pagos | Conversão | ARR |
|---|---|---|---|---|
| Y1 | 20.000 | 1.200 | 6% | R$ 576K |
| Y2 | 80.000 | 7.200 | 9% | R$ 3,5M |
| Y3 | 200.000 | 24.000 | 12% | R$ 11,5M |

> Referência: MedCof atingiu R$22M ARR com 11.500 alunos a ~R$1.900/ano médio. Medlibre a R$479/ano precisa de ~46.000 pagantes para equivalência — factível no cenário otimista Y3–Y4.

---

## 8. Próximos Passos de Implementação

### Imediatos (pré-lançamento pago)

- [ ] Integrar Stripe (mensal + anual)
- [ ] Atualizar página `/pricing` com nova estrutura de preços
- [ ] Criar modal de conversão na tela "Limite Atingido" com oferta Fundadores + countdown
- [ ] Configurar webhook Stripe → Supabase para atualização de tier em tempo real

### Lançamento

- [ ] Campanha "Fundadores" (R$249/ano, 500 vagas, 30 dias) via email list + Instagram
- [ ] A/B test: plano anual como default vs. mensal como default na `/pricing`
- [ ] Ativar programa de indicação (1 mês grátis por indicado pagante)

### Curto prazo (1–3 meses)

- [ ] Implementar "Modo Simulado" (feature exclusiva Premium)
- [ ] Heatmap de performance por especialidade (feature exclusiva Premium)
- [ ] Rastrear funil de conversão: cadastro → primeira sessão → dia 7 → limite atingido → upgrade

### Médio prazo (6–12 meses)

- [ ] Lançar tier **Premium+** com mentoria em grupo mensal (R$699/ano)
- [ ] Piloto B2B: escolas médicas e grupos hospitalares (R$15–30/aluno/ano × centenas)
- [ ] Revisão de preço: +R$60/ano a cada 10.000 usuários pagantes (grandfathering para ativos)

---

## 9. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Banco de questões percebido como pequeno | Alta (fase inicial) | Alto | Comunicar qualidade > quantidade; FSRS reduz questões necessárias |
| Concorrente lança tier gratuito | Média | Alto | Aprofundar LECTOR + SRS; marca e comunidade são diferenciais duradouros |
| Afya/Medcel copia algoritmo | Baixa | Médio | Velocidade de iteração; comunidade; custo de migração para usuários ativos |
| Churn alto no mensal | Alta | Médio | Empurrar conversão anual agressivamente desde o início |
| Resistência a pagar após beta grátis | Alta | Alto | Campanha Fundadores cria FOMO e senso de reciprocidade |

---

*Documento preparado com base em pesquisa de mercado (março 2026) e análise competitiva dos principais players do mercado de preparação para residência médica no Brasil.*
