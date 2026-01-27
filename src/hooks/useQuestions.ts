import { useState, useEffect } from 'react';
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
}

export function useQuestions(filters: UseQuestionsOptions = {}) {
  const { user } = useAuthContext();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, [filters.banca, filters.ano, filters.campo_medico, filters.especialidade, filters.tema, filters.search, filters.hideAnswered, user?.id]);

  const fetchQuestions = async () => {
    setLoading(true);
    setError(null);

    try {
      const hasFilters =
        (filters.banca && filters.banca !== 'all') ||
        (filters.ano && filters.ano !== 0) ||
        (filters.campo_medico && filters.campo_medico !== 'all') ||
        (filters.especialidade && filters.especialidade !== 'all') ||
        (filters.tema && filters.tema !== 'all') ||
        (filters.search && filters.search.trim().length > 0);

      let data: any[] | null = null;
      let fetchError: any = null;

      // Use RPC if user is logged in (Intelligent SRS-based Fetching)
      // EXCEPT when using text search, which is better handled by standard query for now
      const canUseRPC = user && !(filters.search && filters.search.trim().length > 0);

      if (canUseRPC) {
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
        data = rpcData;
        fetchError = rpcError;
      } else {
        // Fallback for guests OR text search
        let query = supabase.from('questions').select('*');

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
          query = query.eq('output_especialidade', filters.especialidade);
        }
        if (filters.tema && filters.tema !== 'all') {
          query = query.eq('output_tema', filters.tema);
        }

        if (filters.search && filters.search.trim().length > 0) {
          query = query.textSearch('enunciado', filters.search, {
            type: 'websearch',
            config: 'portuguese'
          });
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
        // Parse opcoes from JSONB and map campo_medico
        const parsedQuestions = (data || []).map(q => {
          let parsedOpcoes = typeof q.opcoes === 'string' ? JSON.parse(q.opcoes) : q.opcoes;

          // Ensure opcoes is an array of strings
          if (Array.isArray(parsedOpcoes)) {
            parsedOpcoes = parsedOpcoes.map((opt: any) =>
              typeof opt === 'object' && opt !== null && 'texto' in opt ? opt.texto : opt
            );
          } else {
            parsedOpcoes = [];
          }

          return {
            ...q,
            opcoes: parsedOpcoes,
            campo_medico: q.output_grande_area || q.especialidade || 'Geral',
          };
        }) as Question[];
        setQuestions(parsedQuestions);
      }
    } catch (err) {
      setError('Erro ao carregar questões');
    } finally {
      setLoading(false);
    }
  };

  return { questions, loading, error, refetch: fetchQuestions };
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
        .select('banca, ano, output_grande_area');

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
