# Sistema de Tiers - MedLibre

Este documento descreve as permissões, limites e funcionalidades de cada categoria de usuário na plataforma MedLibre.

## Visão Geral

O MedLibre utiliza um modelo **Freemium** para equilibrar acessibilidade com sustentabilidade. O sistema é regido pelas configurações em [`src/config/devMode.ts`](file:///c:/Users/debor/OneDrive/Documentos/GitHub/medresidency-prep/src/config/devMode.ts).

---

## 1. Guest (Visitante / Não Logado)
*O usuário que acessa a landing page sem criar uma conta.*

| Categoria | Detalhes |
| :--- | :--- |
| **Limite Diário** | **5 questões** |
| **Anúncios** | **Habilitados** (Laterais E Intersticiais entre questões) |
| **Persistência** | Salvo apenas no `localStorage` do navegador |

### ✅ O que é permitido:
- Responder até 5 questões aleatórias.
- Visualizar gabarito e explicações básicas.

### ❌ O que não é permitido:
- Acessar o **Modo Estudo Direcionado**.
- Responder mais de 5 questões por dia.

---

## 2. Free (Usuário Logado)
*O usuário que criou uma conta gratuita.*

| Categoria | Detalhes |
| :--- | :--- |
| **Limite Diário** | **20 questões** |
| **Anúncios** | **Habilitados (Apenas Laterais)**. Sem anúncios entre questões. |
| **Persistência** | Banco de dados (Supabase) |

### ✅ O que é permitido:
- 20 questões por dia.
- **Sem anúncios entre as questões** (Experiência de resolução fluida).
- Acesso completo ao **Modo Estudo Direcionado**.
- Estatísticas básicas.

---

## 3. Premium (Usuário Pago)
*O usuário com assinatura ativa.*

| Categoria | Detalhes |
| :--- | :--- |
| **Limite Diário** | **Ilimitado** |
| **Anúncios** | **Totalmente Desativados** (Sem laterais, sem intersticiais) |
| **Benefícios** | Experiência Premium completa |

### ✅ O que é exclusivo Premium:
- **Exportação de PDF**.
- **Zero Ads**: Experiência 100% limpa.
- **Questões Ilimitadas**.

---

## Tabela Comparativa

| Funcionalidade | Guest | Logado (Free) | Premium (Paid) |
| :--- | :---: | :---: | :---: |
| Questões por Dia | 5 | 20 | ∞ |
| Ads Intersticiais | Sim | Não | Não |
| Ads Laterais | Sim | Sim | Não |
| Estudo Direcionado | Não | Sim | Sim |
| Estatísticas | Redireciona Planos | Sim | Sim |
| Ocultar Respondidas | Redireciona Planos | Sim | Sim |
| Exportar PDF | Bloqueado (Redireciona) | Bloqueado (Redireciona) | Sim |
| Histórico Salvo | Não | Sim | Sim |
| Exportar PDF | Não | Não | Sim |

---

> [!NOTE]
> Para testar estas categorias no ambiente de desenvolvimento, consulte o [Testing Guide](file:///C:/Users/debor/.gemini/antigravity/brain/3b654f34-9071-4419-987e-d8afb6c9ec93/testing_guide.md).
