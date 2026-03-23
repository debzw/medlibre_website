import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Question, FilterOptions } from '@/types/database';
import { useAuthContext } from '@/contexts/AuthContext';

interface UseQuestionsOptions {
  banca?: string;
  ano?: number;
  campo_medico?: string;
  especialidade?: string;
  tema?: string;
  search?: string;
  hideAnswered?: boolean;
  status?: 'all_answered' | 'correct' | 'incorrect';
}

export interface SearchMeta {
  layerUsed: number | null;
  correctedTerm: string | null;
  hasMore: boolean;
  /** UUID do termo DeCS encontrado (layers 1/2); null se FTS (layer 3) */
  decsId: string | null;
  /** Nível de expansão hierárquica atual: 0=original, 1=irmãos, 2=tios... */
  expansionLevel: number;
  /** true se há mais níveis hierárquicos disponíveis para expandir */
  canExpand: boolean;
  /** Label do termo DeCS ancestral atual (ex: "Doenças Cardiovasculares") */
  expansionLabel: string | null;
}

function parseQuestions(raw: any[]): Question[] {
  return raw.map(q => {
    let parsedOpcoes = typeof q.opcoes === 'string' ? JSON.parse(q.opcoes) : q.opcoes;

    if (Array.isArray(parsedOpcoes) && parsedOpcoes.length > 0) {
      parsedOpcoes = parsedOpcoes.map((opt: any) =>
        typeof opt === 'object' && opt !== null && 'texto' in opt ? opt.texto : opt
      );
    } else {
      parsedOpcoes = [
        q.alternativa_a,
        q.alternativa_b,
        q.alternativa_c,
        q.alternativa_d,
        q.alternativa_e
      ].filter(Boolean);
    }

    return {
      ...q,
      opcoes: parsedOpcoes,
      campo_medico: q.output_grande_area || q.output_especialidade || 'Geral',
    };
  }) as Question[];
}

export function useQuestions(filters: UseQuestionsOptions = {}) {
  const { user, loading: authLoading } = useAuthContext();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionBuckets, setQuestionBuckets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState<SearchMeta>({
    layerUsed: null,
    correctedTerm: null,
    hasMore: false,
    decsId: null,
    expansionLevel: 0,
    canExpand: false,
    expansionLabel: null,
  });
  const [searchCursor, setSearchCursor] = useState<{ lastScore: number; lastId: string } | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  // Ref para acessar searchMeta atual em callbacks sem stale closure
  const searchMetaRef = useRef(searchMeta);
  useEffect(() => { searchMetaRef.current = searchMeta; }, [searchMeta]);

  const isSearchMode = !!(filters.search && filters.search.trim().length > 0);

  // Track previous authLoading to detect the transition from loading→resolved.
  const prevAuthLoadingRef = useRef(authLoading);

  // Fetch immediately — don't wait for auth to resolve.
  // If auth was loading and just resolved as guest (user=null), skip the refetch
  // since the optimistic guest-path fetch already ran and has the right data.
  // When auth resolves with a real user, re-fetch with the SRS path.
  useEffect(() => {
    const authJustResolvedAsGuest = prevAuthLoadingRef.current === true && !authLoading && !user;
    prevAuthLoadingRef.current = authLoading;

    if (authJustResolvedAsGuest) return;

    setSearchCursor(null);
    setQuestions([]);
    fetchQuestions();
  }, [
    filters.banca,
    filters.ano,
    filters.campo_medico,
    filters.especialidade,
    filters.tema,
    filters.search,
    filters.hideAnswered,
    filters.status,
    user?.id,
    authLoading,
  ]);

  // ─── Search RPC path (funnel: Layer 1 → 2 → 3) ───────────────────────────
  const runSearchRpc = useCallback(async (
    cursor: { lastScore: number; lastId: string } | null,
    append: boolean
  ) => {
    // Guests: collect localStorage IDs for client-side hideAnswered filtering
    const guestExcludeIds: string[] = [];
    if (!user && filters.hideAnswered) {
      try {
        const localHistory = localStorage.getItem('medlibre_question_history');
        if (localHistory) {
          const history = JSON.parse(localHistory);
          guestExcludeIds.push(...history.map((h: any) => h.question_id as string));
        }
      } catch {
        // ignore parse errors
      }
    }

    const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)('search_questions', {
      p_query: filters.search!.trim(),
      p_banca: filters.banca && filters.banca !== 'all' ? filters.banca : null,
      p_ano: filters.ano && filters.ano !== 0 ? filters.ano : null,
      p_campo: filters.campo_medico && filters.campo_medico !== 'all' ? filters.campo_medico : null,
      p_especialidade: filters.especialidade && filters.especialidade !== 'all' ? filters.especialidade : null,
      p_tema: filters.tema && filters.tema !== 'all' ? filters.tema : null,
      p_user_id: user?.id ?? null,
      p_hide_answered: user ? (filters.hideAnswered ?? false) : false,
      p_last_score: cursor?.lastScore ?? null,
      p_last_id: cursor?.lastId ?? null,
      p_limit: 20,
    });

    if (rpcError) throw new Error(rpcError.message);

    const result = rpcResult as {
      results: any[];
      layer_used: number;
      corrected_term: string | null;
      decs_id: string | null;
      next_cursor: { last_score: number; last_id: string } | null;
    };

    let rawResults = result.results || [];

    // Client-side guest hideAnswered filter (no server history available)
    if (guestExcludeIds.length > 0) {
      rawResults = rawResults.filter((q: any) => !guestExcludeIds.includes(q.id));
    }

    const parsed = parseQuestions(rawResults);

    if (append) {
      setQuestions(prev => [...prev, ...parsed]);
    } else {
      setQuestions(parsed);
    }

    const nextCursor = result.next_cursor
      ? { lastScore: result.next_cursor.last_score, lastId: result.next_cursor.last_id }
      : null;

    setSearchCursor(nextCursor);
    // Expansão hierárquica só disponível quando DeCS foi encontrado (layers 1 ou 2)
    const canExpand = !!result.decs_id && result.layer_used !== 3;
    setSearchMeta({
      layerUsed: result.layer_used,
      correctedTerm: result.corrected_term ?? null,
      hasMore: !!nextCursor,
      decsId: result.decs_id ?? null,
      expansionLevel: 0,
      canExpand,
      expansionLabel: null,
    });
  }, [
    filters.search,
    filters.banca,
    filters.ano,
    filters.campo_medico,
    filters.especialidade,
    filters.tema,
    filters.hideAnswered,
    user,
  ]);

  // ─── Primary fetch (resets state) ────────────────────────────────────────
  const fetchQuestions = async () => {
    const _tFetch = performance.now();
    const _fetchPath = user ? 'SRS-RPC' : 'guest';
    console.log(`[PERF] QUESTIONS: fetchQuestions start (path=${_fetchPath}) → ${_tFetch.toFixed(0)}ms`);

    setLoading(true);
    setError(null);

    const MAX_RETRIES = 2;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let attempt = 0;
    while (attempt <= MAX_RETRIES) {
      try {
        if (isSearchMode) {
          await runSearchRpc(null, false);
          break;
        }

        // ── Non-search paths (SRS RPC or fallback query) ──
        let data: any[] | null = null;
        let fetchError: any = null;
        let usedRPC = false;

        // Try SRS RPC if user is logged in and no status filter
        if (user && !filters.status) {
          console.log(`[PERF] QUESTIONS: RPC get_study_session_questions_v2 sent → ${performance.now().toFixed(0)}ms`);
          const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_study_session_questions_v2', {
            p_user_id: user.id,
            p_limit: 20,
            p_hide_answered: filters.hideAnswered || false,
            p_banca: filters.banca !== 'all' ? filters.banca : null,
            p_ano: filters.ano !== 0 ? filters.ano : null,
            p_campo: filters.campo_medico !== 'all' ? filters.campo_medico : null,
            p_especialidade: filters.especialidade !== 'all' ? filters.especialidade : null,
            p_tema: filters.tema !== 'all' ? filters.tema : null
          });

          console.log(`[PERF] QUESTIONS: RPC received → ${performance.now().toFixed(0)}ms | rows=${rpcData?.length ?? 0} | error=${rpcError?.message ?? 'none'}`);
          if (!rpcError) {
            // Build question→bucket map from the extra source_bucket column
            const buckets: Record<string, string> = {};
            (rpcData as any[] || []).forEach((row: any) => {
              buckets[row.id] = row.source_bucket ?? 'unknown';
            });
            setQuestionBuckets(buckets);
            data = rpcData;
            usedRPC = true;
          } else {
            if (rpcError.message.includes('statement timeout') && attempt < MAX_RETRIES) {
              attempt++;
              console.warn(`Timeout detectado. Tentativa ${attempt} de ${MAX_RETRIES}...`);
              await delay(500 * attempt);
              continue;
            }
            console.warn('SRS RPC falhou, usando query simples como fallback:', rpcError.message);
          }
        }

        if (!usedRPC) {
          // ── Path A: status filter (correto/incorreto/todos) ─────────────────
          // Antes: dois queries seriais — buscar IDs do histórico → IN(enorme).
          // Agora: um único RPC com EXISTS JOIN server-side.
          if (filters.status && user) {
            const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
              'get_questions_by_status',
              {
                p_user_id:       user.id,
                p_status:        filters.status,
                p_banca:         filters.banca        !== 'all' ? filters.banca        : null,
                p_ano:           filters.ano           !== 0    ? filters.ano           : null,
                p_campo:         filters.campo_medico !== 'all' ? filters.campo_medico  : null,
                p_especialidade: filters.especialidade !== 'all' ? filters.especialidade : null,
                p_tema:          filters.tema          !== 'all' ? filters.tema          : null,
                p_hide_answered: filters.hideAnswered ?? false,
                p_limit:         50,
              }
            );

            if (rpcError?.message.includes('statement timeout') && attempt < MAX_RETRIES) {
              attempt++;
              console.warn(`Timeout no status RPC. Tentativa ${attempt}...`);
              await delay(800 * attempt);
              continue;
            }

            data = rpcData;
            fetchError = rpcError;
          } else {
            // ── Path B: guest sem status (filtros simples) ───────────────────
            let query = supabase
              .from('questions')
              .select('*')
              .or('tem_anomalia.is.null,tem_anomalia.neq.1');

            if (filters.banca && filters.banca !== 'all') {
              query = query.eq('banca', filters.banca);
            }
            if (filters.ano && filters.ano !== 0) {
              query = query.eq('ano', filters.ano);
            }
            if (filters.campo_medico && filters.campo_medico !== 'all') {
              query = query.eq('output_grande_area', filters.campo_medico);
            }
            if (filters.especialidade && filters.especialidade !== 'all') {
              query = query.contains('especialidades_tags', [filters.especialidade]);
            }
            if (filters.tema && filters.tema !== 'all') {
              query = query.eq('output_tema', filters.tema);
            }

            // Guest hideAnswered: client-side via localStorage (sem user_id)
            if (filters.hideAnswered && !user) {
              const localHistory = localStorage.getItem('medlibre_question_history');
              if (localHistory) {
                try {
                  const history = JSON.parse(localHistory);
                  const ids = history.map((h: any) => h.question_id as string);
                  if (ids.length > 0) {
                    query = query.not('id', 'in', `(${ids.join(',')})`);
                  }
                } catch (e) {
                  console.error('Error parsing local history for filtering:', e);
                }
              }
            }

            const { data: filteredData, error: filteredError } = await query
              .limit(50)
              .order('created_at', { ascending: false });

            if (filteredError?.message.includes('statement timeout') && attempt < MAX_RETRIES) {
              attempt++;
              console.warn(`Timeout detectado no fallback. Tentativa ${attempt} de ${MAX_RETRIES}...`);
              await delay(800 * attempt);
              continue;
            }

            data = filteredData;
            fetchError = filteredError;
          }
        }

        if (fetchError) {
          setError(fetchError.message);
        } else {
          const parsed = parseQuestions(data || []);
          console.log(`[PERF] QUESTIONS: parseQuestions done → ${performance.now().toFixed(0)}ms | count=${parsed.length}`);
          setQuestions(parsed);
          setSearchMeta({ layerUsed: null, correctedTerm: null, hasMore: false });
        }

        break; // Sucesso ou erro definitivo
      } catch (err: any) {
        if (err.message?.includes('statement timeout') && attempt < MAX_RETRIES) {
          attempt++;
          await delay(500 * attempt);
          continue;
        }
        setError('Erro ao carregar questões');
        break;
      }
    }
    console.log(`[PERF] QUESTIONS: loading=false → ${performance.now().toFixed(0)}ms`);
    setLoading(false);
  };

  // ─── Load more (keyset pagination — search mode only) ────────────────────
  const loadMore = useCallback(async () => {
    if (!isSearchMode || !searchMeta.hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      await runSearchRpc(searchCursor, true);
    } catch (err) {
      setError('Erro ao carregar mais questões');
    } finally {
      setLoadingMore(false);
    }
  }, [isSearchMode, searchMeta.hasMore, loadingMore, searchCursor, runSearchRpc]);

  // ─── Expand search hierarchically (DeCS tree climbing) ───────────────────
  // Busca questões no nível hierárquico imediatamente acima do termo atual.
  // Aceita { silent: true } para pre-fetch em background (não bloqueia botão).
  const expandSearch = useCallback(async (opts: { silent?: boolean } = {}) => {
    const meta = searchMetaRef.current;
    if (!meta.decsId || !meta.canExpand) return;
    if (!opts.silent && loadingMore) return;
    if (opts.silent && isPrefetching) return;

    const nextLevel = meta.expansionLevel + 1;
    if (opts.silent) {
      setIsPrefetching(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)(
        'search_questions_expand',
        {
          p_decs_id:        meta.decsId,
          p_expansion_level: nextLevel,
          p_banca:          filters.banca && filters.banca !== 'all' ? filters.banca : null,
          p_ano:            filters.ano && filters.ano !== 0 ? filters.ano : null,
          p_campo:          filters.campo_medico && filters.campo_medico !== 'all' ? filters.campo_medico : null,
          p_especialidade:  filters.especialidade && filters.especialidade !== 'all' ? filters.especialidade : null,
          p_tema:           filters.tema && filters.tema !== 'all' ? filters.tema : null,
          p_user_id:        user?.id ?? null,
          p_hide_answered:  user ? (filters.hideAnswered ?? false) : false,
          p_last_score:     null,
          p_last_id:        null,
          p_limit:          20,
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      const result = rpcResult as {
        results: any[];
        expansion_level: number;
        expansion_label: string | null;
        can_expand_more: boolean;
        next_cursor: { last_score: number; last_id: string } | null;
      };

      const parsed = parseQuestions(result.results || []);
      setQuestions(prev => [...prev, ...parsed]);

      const nextCursor = result.next_cursor
        ? { lastScore: result.next_cursor.last_score, lastId: result.next_cursor.last_id }
        : null;
      setSearchCursor(nextCursor);

      setSearchMeta(prev => ({
        ...prev,
        hasMore: !!nextCursor,
        expansionLevel: nextLevel,
        canExpand: result.can_expand_more,
        expansionLabel: result.expansion_label,
      }));
    } catch {
      if (!opts.silent) setError('Erro ao expandir busca');
    } finally {
      if (opts.silent) {
        setIsPrefetching(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [
    filters.banca,
    filters.ano,
    filters.campo_medico,
    filters.especialidade,
    filters.tema,
    filters.hideAnswered,
    user,
    loadingMore,
    isPrefetching,
  ]);

  return {
    questions,
    questionBuckets,
    loading,
    loadingMore,
    isPrefetching,
    error,
    searchMeta,
    loadMore,
    expandSearch,
    refetch: fetchQuestions,
  };
}

// ── Module-level cache: evita re-fetch entre mounts (dados estáticos por sessão) ──
let filterOptionsCache: FilterOptions | null = null;
let filterOptionsFetching: Promise<FilterOptions> | null = null;

async function fetchFilterOptionsOnce(): Promise<FilterOptions> {
  if (filterOptionsCache) return filterOptionsCache;
  if (filterOptionsFetching) return filterOptionsFetching;

  filterOptionsFetching = (async () => {
    // get_filter_options usa SELECT DISTINCT com índices B-Tree — retorna ~50 valores
    // em vez de todas as linhas da tabela (antes: .select('banca,ano,output_grande_area')
    // retornava 50k+ linhas e deduplicava no cliente).
    const { data, error } = await (supabase.rpc as any)('get_filter_options');
    if (error || !data) return { bancas: [], anos: [], campos: [] };
    const result: FilterOptions = {
      bancas: (data.bancas as string[]) ?? [],
      anos: (data.anos as number[]) ?? [],
      campos: (data.campos as string[]) ?? [],
    };
    filterOptionsCache = result;
    return result;
  })();

  return filterOptionsFetching;
}

export function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptions>({
    bancas: [],
    anos: [],
    campos: [],
  });
  const [loading, setLoading] = useState(!filterOptionsCache);

  useEffect(() => {
    if (filterOptionsCache) {
      setOptions(filterOptionsCache);
      setLoading(false);
      return;
    }
    fetchFilterOptionsOnce()
      .then(setOptions)
      .catch(err => console.error('Error fetching filter options:', err))
      .finally(() => setLoading(false));
  }, []);

  return { options, loading };
}

export function useQuestionById(id: string | null) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase
      .from('questions')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        setQuestion(data && !error ? parseQuestions([data])[0] : null);
        setLoading(false);
      });
  }, [id]);

  return { question, loading };
}
