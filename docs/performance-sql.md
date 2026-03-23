# Diretrizes de Performance SQL — MedLibre

Resultado final de referência: `search_questions_expand` passou de **1779ms → 1053ms → 195ms** usando as técnicas abaixo.

---

## 1. Índices

### Regra geral
Todo JOIN deve ter um índice na coluna usada como condição. Sem isso, o planner faz Sequential Scan na tabela inteira.

### Tipos por caso de uso

| Caso de uso | Tipo de índice | Exemplo |
|---|---|---|
| Igualdade exata (`=`) | B-Tree (padrão) | `idx_decs_clean_term_btree` |
| Hierarquia ltree (`<@`, `@>`) | GiST | `idx_decs_tree_paths_gist` |
| Full-Text Search (`@@`) | GIN | `idx_questions_enunciado_fts` |
| Similaridade fuzzy (`similarity()`) | GIN com `gin_trgm_ops` | `idx_decs_clean_term_trgm` |
| FK em junction tables | B-Tree | `idx_question_decs_decs_id`, `idx_question_decs_question_id` |

### Sempre criar para junction tables
```sql
-- question_decs é usada em todo JOIN hierárquico — ambas as colunas precisam de índice
CREATE INDEX IF NOT EXISTS idx_question_decs_decs_id   ON public.question_decs (decs_id);
CREATE INDEX IF NOT EXISTS idx_question_decs_question_id ON public.question_decs (question_id);
ANALYZE public.question_decs;
```

### Rodar `ANALYZE` após criar índices
O planner só usa estatísticas atualizadas. Após inserção em lote ou criação de índice: `ANALYZE <tabela>;`

---

## 2. CTEs: `AS MATERIALIZED` vs inline

### Quando usar `AS MATERIALIZED`
- CTE referenciada **mais de uma vez** na query — sem `MATERIALIZED`, o planner pode re-executar
- CTE que produz **poucas linhas** mas é cara de computar (ex: cálculo de paths ancestrais)
- CTE usada como ponto de corte com `LIMIT` cedo

```sql
-- ancestor_info: 1-2 linhas, computada uma única vez, referenciada depois em new_zone_decs
ancestor_info AS MATERIALIZED (
  SELECT
    subpath(tree_path, 0, nlevel(tree_path) - p_expansion_level)     AS anc_path,
    subpath(tree_path, 0, nlevel(tree_path) - p_expansion_level + 1) AS prev_anc_path
  FROM public.decs_tree_paths
  WHERE decs_id = p_decs_id
    AND nlevel(tree_path) > p_expansion_level
)
```

### Não usar `MATERIALIZED` quando
- CTE simples com filtros que o planner pode empurrar (push-down)
- Query já é rápida e o overhead de materializar não compensa

---

## 3. Anti-join: `AND NOT (<@)` vs `EXCEPT` vs `NOT EXISTS`

Este foi o maior ganho de performance neste projeto. As três formas têm complexidade muito diferente.

### `NOT EXISTS` (correlated subquery) — Evitar
Avalia a subquery para **cada linha** da query externa. O(N²).

```sql
-- RUIM: 1779ms no benchmark
WHERE NOT EXISTS (
  SELECT 1 FROM decs_tree_paths cp2
  JOIN ... WHERE cp2.decs_id = qd.decs_id
)
```

### `EXCEPT` (set difference) — Melhor, mas faz 2 scans
Executa duas varreduras GiST separadas e constrói duas hash tables para o set difference. O(N_scan1 + N_scan2 + hash_build).

```sql
-- MÉDIO: 1053ms no benchmark — dois GiST scans + hash build
SELECT dtp.decs_id FROM ancestor_info ai
JOIN decs_tree_paths dtp ON dtp.tree_path <@ ai.anc_path
EXCEPT
SELECT dtp2.decs_id FROM ancestor_info ai2
JOIN decs_tree_paths dtp2 ON dtp2.tree_path <@ ai2.prev_anc_path
```

### `AND NOT (col <@ expr)` — Ótimo: 1 scan com filtro por linha
Uma única varredura GiST. Para cada linha retornada pelo índice, avalia o filtro `NOT (<@)` em O(profundidade_árvore). Sem segundo scan, sem hash build.

```sql
-- ÓTIMO: 195ms no benchmark — um único GiST scan
new_zone_decs AS MATERIALIZED (
  SELECT DISTINCT dtp.decs_id
  FROM ancestor_info ai
  JOIN public.decs_tree_paths dtp
    ON dtp.tree_path <@ ai.anc_path         -- inclui descendentes do ancestral
   AND NOT (dtp.tree_path <@ ai.prev_anc_path)  -- exclui descendentes da zona anterior
)
```

**Regra:** sempre que precisar de "A mas não B" em ltree, use um único JOIN com `<@ A AND NOT (<@ B)` em vez de dois JOINs com EXCEPT.

---

## 4. LIMIT cedo (early termination)

Colocar `LIMIT` no CTE intermediário antes do JOIN final reduz drasticamente o trabalho feito nas etapas seguintes.

```sql
-- Limita a materialização a p_limit*5 linhas — suficiente para paginação
expansion_zone AS MATERIALIZED (
  SELECT DISTINCT qd.question_id
  FROM new_zone_decs nz
  JOIN public.question_decs qd ON qd.decs_id = nz.decs_id
  LIMIT p_limit * 5   -- <-- para de buscar após 100 (para p_limit=20)
)
```

Por quê 5×? Garante margem para filtros de `WHERE` subsequentes (banca, ano, anomalia) sem precisar percorrer o universo inteiro.

---

## 5. Separar subqueries caras do `json_build_object` final

Subqueries correlacionadas dentro de `json_build_object` são executadas para cada linha do resultado. Se a subquery é cara, ela multiplica o custo.

```sql
-- RUIM: subquery correlacionada executada N vezes dentro do JSON
json_build_object(
  'expansion_label', (
    SELECT dt.term FROM ancestor_info ai
    JOIN decs_tree_paths dtp ON dtp.tree_path = ai.anc_path
    JOIN decs_terms dt ON dt.id = dtp.decs_id LIMIT 1
  )
)

-- ÓTIMO: computar antes, na DECLARE, usando busca por igualdade exata
SELECT dt.term INTO v_expansion_label
FROM public.decs_tree_paths src
JOIN public.decs_tree_paths dtp
  ON dtp.tree_path = subpath(src.tree_path, 0, nlevel(src.tree_path) - p_expansion_level)
JOIN public.decs_terms dt ON dt.id = dtp.decs_id
WHERE src.decs_id = p_decs_id LIMIT 1;
-- depois usar v_expansion_label no json_build_object
```

---

## 6. Keyset pagination (cursor-based)

Nunca usar `OFFSET` para paginação em tabelas grandes. O OFFSET percorre todas as linhas anteriores.

Usar `(score, id) < (last_score, last_id)` como cursor:

```sql
AND (
  p_last_score IS NULL OR p_last_id IS NULL
  OR (s.score, q.id::text) < (p_last_score, p_last_id::text)
)
ORDER BY score DESC, id DESC
LIMIT p_limit
```

O cursor é retornado na resposta:
```sql
'next_cursor', CASE
  WHEN count(*) = p_limit THEN json_build_object(
    'last_score', min(r.score),
    'last_id',    (array_agg(r.id ORDER BY r.score DESC, r.id DESC))[p_limit]
  )
  ELSE NULL
END
```

---

## 7. `LEFT JOIN` para filtros opcionais (hideAnswered)

Nunca usar `NOT IN (SELECT ...)` para listas que podem ser grandes. O planner materializa a lista inteira.

```sql
-- RUIM: NOT IN materializa todos os IDs respondidos
WHERE q.id NOT IN (SELECT question_id FROM user_question_history WHERE user_id = $1)

-- ÓTIMO: LEFT JOIN + IS NULL
LEFT JOIN public.user_question_history uqh
  ON uqh.question_id = q.id AND uqh.user_id = p_user_id AND p_user_id IS NOT NULL
WHERE
  (NOT p_hide_answered OR p_user_id IS NULL OR uqh.id IS NULL)
```

---

## 8. Como diagnosticar queries lentas

Sempre rodar `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` no Supabase SQL Editor:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT search_questions_expand('<uuid_do_decs_id>', 1);
```

### O que procurar no output

| Sinal de problema | Causa provável | Fix |
|---|---|---|
| `Seq Scan` em tabela grande | Índice ausente ou não usado | Criar índice; verificar tipo correto (GiST/GIN/B-Tree) |
| `Hash Join` com `Batches > 1` | Hash table muito grande para `work_mem` | `SET work_mem = '64MB'` ou reduzir LIMIT intermediário |
| `rows=X loops=Y` com Y alto | Loop nested / subquery correlacionada | Reescrever com JOIN; usar MATERIALIZED |
| `Buffers: read=N` muito alto | Cold cache (primeira execução) | Rodar 2x; segunda execução mostra `shared hit` |
| Dois `Index Scan` em `decs_tree_paths` | EXCEPT ou NOT EXISTS com dois joins | Usar `AND NOT (<@)` no mesmo JOIN |

### Benchmarks de referência (produção)

| Função | Técnica | Tempo |
|---|---|---|
| `search_questions_expand` v1 | NOT EXISTS correlated | 1779ms |
| `search_questions_expand` v2 | EXCEPT + 2 GiST scans | 1053ms |
| `search_questions_expand` v3 | AND NOT (<@) single scan | **195ms** |

---

## 9. Padrão de RPC no frontend (TypeScript)

Para não bloquear o usuário enquanto queries estão rodando, usar dois estados separados:

```typescript
const [loadingMore, setLoadingMore] = useState(false);    // bloqueia botão
const [isPrefetching, setIsPrefetching] = useState(false); // silencioso, não bloqueia

// Pre-fetch quando restam N questões no batch atual
useEffect(() => {
  if (remaining === 2 && !isPrefetching && !loadingMore) {
    expandSearch({ silent: true }); // não bloqueia UI
  }
}, [currentQuestionId, questions.length]);
```

Usar `useRef` para evitar stale closures em callbacks assíncronos:

```typescript
const searchMetaRef = useRef(searchMeta);
useEffect(() => { searchMetaRef.current = searchMeta; }, [searchMeta]);

// Dentro de callbacks/expandSearch:
const meta = searchMetaRef.current; // sempre o valor atual
```
