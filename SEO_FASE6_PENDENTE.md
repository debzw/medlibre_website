# SEO MedLibre — Fase 6: Melhorias Pendentes

> **Status:** Fases 1–5 concluídas. Este documento registra o que falta implementar.
> **Data:** 2026-03-14

---

## ✅ Fases 1–5 Concluídas

| # | Tarefa | Arquivo(s) |
|---|--------|-----------|
| 1.1 | Blog posts convertidos para Server Component + `generateMetadata` | `app/blog/[slug]/page.tsx` |
| 1.2 | Blog index convertido para Server Component + `metadata` | `app/blog/page.tsx` |
| 1.3 | `generateStaticParams` adicionado para pre-render | `app/blog/[slug]/page.tsx` |
| 1.4 | `public/sitemap.xml` estático deletado (conflito resolvido) | — |
| 1.5 | `public/robots.txt` redundante deletado | — |
| 1.6 | Sitemap atualizado: todos os posts + /privacy + /termos, sem /auth | `app/sitemap.ts` |
| 2.1 | JSON-LD `Organization` + `WebSite` + `WebPage` na homepage | `app/page.tsx` |
| 2.2 | JSON-LD `BlogPosting` + `BreadcrumbList` em cada post | `app/blog/[slug]/page.tsx` |
| 2.3 | JSON-LD `FAQPage` na página SAC (habilita "People Also Ask") | `app/sac/page.tsx` |
| 3.1 | Metadata (noindex) adicionado a /privacy | `app/privacy/page.tsx` |
| 3.2 | Metadata (noindex) adicionado a /termos | `app/termos/page.tsx` |
| 3.3 | OG tags + keywords completos em /pricing | `app/pricing/page.tsx` |
| 3.4 | OG tags + keywords completos em /sac | `app/sac/page.tsx` |
| 4.1 | H1 semanticamente oculto (`sr-only`) na homepage | `app/page.tsx` |
| 4.2 | CTAs da homepage convertidos para `<Link href>` (rastreáveis pelo Google) | `app/LandingPageClient.tsx` |
| 4.3 | 3 novos posts SEO criados: "banco-de-questoes-residencia-gratis", "como-estudar-para-residencia-medica", "questoes-residencia-usp-unifesp-enare" | `app/blog/_data/posts.ts` |
| 4.4 | Internal linking: posts linkam para `/app` e entre si | `app/blog/_data/posts.ts` |
| 5.1 | `public/ads.txt` verificado ✅ (linha correta: `pub-3534264996279802`) | `public/ads.txt` |

---

## 🔲 Fase 6 — Melhorias Técnicas Pendentes

### 6.1 — OG Image Dinâmica por Post de Blog

**Prioridade:** Alta (impacta CTR no WhatsApp/LinkedIn quando artigos são compartilhados)

**O que fazer:**
1. Instalar `@vercel/og`: `npm install @vercel/og`
2. Criar `app/og/route.tsx` com `ImageResponse` do Vercel OG
3. Gerar imagem 1200×630 dinamicamente com título do post, logo Medlibre e cor de fundo
4. Atualizar `generateMetadata` em `app/blog/[slug]/page.tsx` para apontar `og:image` para `/og?title=...`

**Exemplo de rota:**
```typescript
// app/og/route.tsx
import { ImageResponse } from 'next/og';
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') ?? 'Medlibre';
  return new ImageResponse(<div ...>{title}</div>, { width: 1200, height: 630 });
}
```

**Impacto esperado:** +15-25% CTR em compartilhamentos sociais → mais tráfego orgânico indireto.

---

### 6.2 — Canonical URLs Explícitas em Todas as Páginas

**Prioridade:** Média

**Status atual:** `/` e `/blog/*` já têm `alternates.canonical`. Faltam:
- `app/about/page.tsx` — adicionar `alternates: { canonical: 'https://medlibre.com.br/about' }`
- Verificar se `/app` (rota protegida) tem `robots: { index: false }` explícito

**O que fazer:**
```typescript
// Em cada page.tsx público:
export const metadata: Metadata = {
  // ...
  alternates: { canonical: 'https://medlibre.com.br/[rota]' },
};
```

---

### 6.3 — Core Web Vitals: Auditoria e Otimização

**Prioridade:** Alta (afeta ranking diretamente desde 2021)

**Ferramentas:**
- PageSpeed Insights: `https://pagespeed.web.dev/` — testar `/`, `/blog/a-ciencia-do-aprendizado`, `/app`
- Lighthouse no Chrome DevTools — modo mobile

**Metas:**
- LCP (Largest Contentful Paint): < 2.5s
- INP (Interaction to Next Paint): < 200ms
- CLS (Cumulative Layout Shift): < 0.1

**Áreas de atenção:**
- Logo SVG na homepage: verificar se carrega sem layout shift
- AdBanner (AdSense): anúncios com tamanho fixo e reservado para evitar CLS
- Fonts: Inter já usa `next/font` (correto) — sem ação necessária

---

### 6.4 — Schema `SoftwareApplication` para o Banco de Questões

**Prioridade:** Média (melhora E-E-A-T e rich snippets)

**O que fazer:** Adicionar em `app/page.tsx` um schema de `SoftwareApplication`:
```json
{
  "@type": "SoftwareApplication",
  "name": "Medlibre",
  "applicationCategory": "EducationalApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "BRL"
  },
  "description": "Banco de questões gratuito para residência médica com repetição espaçada FSRS",
  "url": "https://medlibre.com.br/app"
}
```
Isso pode habilitar rich snippet de "app gratuito" nos resultados de busca.

---

### 6.5 — Estratégia de Link Building (Off-page)

**Prioridade:** Alta para rankeamento competitivo

**O que fazer (não é código — é estratégia de marketing):**
1. **Fóruns médicos:** Publicar artigos do blog em grupos de Facebook de medicina, Reddit r/medicina, fóruns CMDE
2. **Parceria com blogs médicos:** Guest posts em blogs de medicina com link para o Medlibre
3. **Social proof:** Incentivar alunos aprovados a mencionar o Medlibre em LinkedIn e Twitter
4. **Wikipedia/Wikidata:** Se possível, adicionar referência ao Medlibre em artigos sobre residência médica
5. **Diretórios educacionais:** Cadastrar em listas de "plataformas de estudo gratuitas para medicina"

**Por que é crítico:** Google usa PageRank (links externos) como sinal de autoridade. Para derrotar Medcel e QConcursos, o Medlibre precisa de links de qualidade de sites de medicina.

---

### 6.6 — Monitoramento via Google Search Console

**Prioridade:** Urgente (deve ser feito agora, após deploy)

**Passos:**
1. Acessar `https://search.google.com/search-console/`
2. Verificar propriedade `medlibre.com.br` (se ainda não feito)
3. Submeter sitemap: `https://medlibre.com.br/sitemap.xml`
4. Usar "URL Inspection" para solicitar indexação de:
   - `https://medlibre.com.br/blog/banco-de-questoes-residencia-gratis`
   - `https://medlibre.com.br/blog/como-estudar-para-residencia-medica`
   - `https://medlibre.com.br/blog/questoes-residencia-usp-unifesp-enare`
5. Monitorar semanalmente: impressões, cliques, posição média para as keywords-alvo

---

### 6.7 — Verificação do Rich Results Test

**Prioridade:** Média (validação pós-deploy)

**Ferramentas:**
- Rich Results Test: `https://search.google.com/test/rich-results`
- Testar URLs:
  - Homepage → deve mostrar `Organization` e `WebSite`
  - `/blog/a-ciencia-do-aprendizado` → deve mostrar `BlogPosting` e `BreadcrumbList`
  - `/sac` → deve mostrar `FAQPage` (habilitando "People Also Ask")

---

## 📊 Keywords a Monitorar no Search Console

| Keyword | Volume Est. | Concorrência | Página-alvo |
|---------|-------------|--------------|------------|
| banco de questoes residencia gratis | Alto | Alta | `/` e `/blog/banco-de-questoes-residencia-gratis` |
| banco de questoes residencia medica | Alto | Alta | `/blog/banco-de-questoes-residencia-gratis` |
| estudo residencia medica | Médio | Alta | `/blog/como-estudar-para-residencia-medica` |
| como estudar residencia medica | Médio | Média | `/blog/como-estudar-para-residencia-medica` |
| questoes USP residencia | Médio | Média | `/blog/questoes-residencia-usp-unifesp-enare` |
| questoes UNIFESP residencia | Médio | Média | `/blog/questoes-residencia-usp-unifesp-enare` |
| questoes ENARE | Médio | Baixa | `/blog/questoes-residencia-usp-unifesp-enare` |
| repetição espaçada medicina | Baixo | Baixa | `/blog/arquitetura-da-retencao-srs` |
| active recall residencia | Baixo | Baixa | `/blog/active-recall-tecnica-definitiva` |

---

## 📋 Checklist de Verificação Pós-Deploy

- [ ] `https://medlibre.com.br/sitemap.xml` → lista todos os 6 posts do blog
- [ ] `https://medlibre.com.br/robots.txt` → gerado pelo Next.js (não arquivo estático)
- [ ] `https://medlibre.com.br/blog/a-ciencia-do-aprendizado` → `<title>` correto no HTML
- [ ] `https://medlibre.com.br/blog/banco-de-questoes-residencia-gratis` → acessível
- [ ] Rich Results Test na homepage → `Organization` + `WebSite` detectados
- [ ] Rich Results Test em post do blog → `BlogPosting` detectado
- [ ] Rich Results Test em `/sac` → `FAQPage` detectado
- [ ] `https://medlibre.com.br/ads.txt` → `pub-3534264996279802` visível
- [ ] PageSpeed Insights mobile ≥ 85 na homepage
- [ ] Google Search Console: sitemap submetido
- [ ] Search Console: indexação solicitada para os 3 novos posts
