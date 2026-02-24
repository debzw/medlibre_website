import { useState, useEffect, useCallback } from 'react';
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
  const { user } = useAuthContext();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState<SearchMeta>({
    layerUsed: null,
    correctedTerm: null,
    hasMore: false,
  });
  const [searchCursor, setSearchCursor] = useState<{ lastScore: number; lastId: string } | null>(null);

  const isSearchMode = !!(filters.search && filters.search.trim().length > 0);

  // Reset cursor and results whenever filters (including search text) change
  useEffect(() => {
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
    setSearchMeta({
      layerUsed: result.layer_used,
      correctedTerm: result.corrected_term ?? null,
      hasMore: !!nextCursor,
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
    setLoading(true);
    setError(null);

    try {
      if (isSearchMode) {
        await runSearchRpc(null, false);
        return;
      }

      // ── Non-search paths (SRS RPC or fallback query) ──
      let data: any[] | null = null;
      let fetchError: any = null;
      let usedRPC = false;

      // Try SRS RPC if user is logged in and no status filter
      if (user && !filters.status) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_study_session_questions', {
          p_user_id: user.id,
          p_limit: 50,
          p_hide_answered: filters.hideAnswered || false,
          p_banca: filters.banca !== 'all' ? filters.banca : null,
          p_ano: filters.ano !== 0 ? filters.ano : null,
          p_campo: filters.campo_medico !== 'all' ? filters.campo_medico : null,
          p_especialidade: filters.especialidade !== 'all' ? filters.especialidade : null,
          p_tema: filters.tema !== 'all' ? filters.tema : null
        });

        if (!rpcError) {
          data = rpcData;
          usedRPC = true;
        } else {
          console.warn('SRS RPC falhou, usando query simples como fallback:', rpcError.message);
        }
      }

      if (!usedRPC) {
        // Fallback for guests OR status filtering
        let query = supabase
          .from('questions')
          .select('*')
          .or('tem_anomalia.is.null,tem_anomalia.neq.1');

        if (filters.status && user) {
          let historyQuery = supabase
            .from('user_question_history')
            .select('question_id')
            .eq('user_id', user.id);

          if (filters.status === 'correct') {
            historyQuery = historyQuery.eq('is_correct', true);
          } else if (filters.status === 'incorrect') {
            historyQuery = historyQuery.eq('is_correct', false);
          }

          const { data: historyItems, error: historyError } = await historyQuery;

          if (historyError) {
            console.error('Error fetching history for status filter:', historyError);
            data = [];
          } else if (historyItems && historyItems.length > 0) {
            const questionIds = historyItems.map(item => item.question_id);
            query = query.in('id', questionIds);
          } else {
            setQuestions([]);
            setLoading(false);
            return;
          }
        }

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

        if (filters.hideAnswered) {
          if (user) {
            const { data: answeredIds } = await supabase
              .from('user_question_history')
              .select('question_id')
              .eq('user_id', user.id);

            if (answeredIds && answeredIds.length > 0) {
              const ids = answeredIds.map(a => a.question_id);
              query = query.not('id', 'in', `(${ids.join(',')})`);
            }
          } else {
            const localHistory = localStorage.getItem('medlibre_question_history');
            if (localHistory) {
              try {
                const history = JSON.parse(localHistory);
                const ids = history.map((h: any) => h.question_id);
                if (ids.length > 0) {
                  query = query.not('id', 'in', `(${ids.join(',')})`);
                }
              } catch (e) {
                console.error('Error parsing local history for filtering:', e);
              }
            }
          }
        }

        const { data: filteredData, error: filteredError } = await query
          .limit(50)
          .order('created_at', { ascending: false });

        data = filteredData;
        fetchError = filteredError;
      }

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setQuestions(parseQuestions(data || []));
        setSearchMeta({ layerUsed: null, correctedTerm: null, hasMore: false });
      }
    } catch (err) {
      setError('Erro ao carregar questões');
    } finally {
      setLoading(false);
    }
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

  return {
    questions,
    loading,
    loadingMore,
    error,
    searchMeta,
    loadMore,
    refetch: fetchQuestions,
  };
}

export function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptions>({
    bancas: [],
    anos: [],
    campos: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const { data: questions } = await supabase
        .from('questions')
        .select('banca, ano, output_grande_area')
        .or('tem_anomalia.is.null,tem_anomalia.neq.1');

      if (questions) {
        const bancas = [...new Set(questions.map(q => q.banca))].sort();
        const anos = [...new Set(questions.map(q => q.ano))].sort((a, b) => b - a);
        const campos = [...new Set(questions.map(q => q.output_grande_area).filter(Boolean))].sort() as string[];

        setOptions({ bancas, anos, campos });
      }
    } catch (err) {
      console.error('Error fetching filter options:', err);
    } finally {
      setLoading(false);
    }
  };

  return { options, loading };
}
