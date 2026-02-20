import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DEV_MODE } from '@/hooks/useAuth';

const LOCAL_HISTORY_KEY = 'medlibre_question_history';
const LOCAL_QUESTIONS_CACHE_KEY = 'medlibre_questions_cache';

export interface QuestionHistoryEntry {
  id: string;
  user_id: string;
  question_id: string;
  selected_answer: number;
  is_correct: boolean;
  answered_at: string;
  time_spent_seconds: number | null;
  // Cached question data for local storage mode
  campo_medico?: string;
  banca?: string;
}

export interface UserStats {
  totalAnswered: number;
  totalCorrect: number;
  totalIncorrect: number;
  accuracy: number;
  averageTimeSeconds: number;
  totalTimeSeconds: number;
  byField: Record<string, { correct: number; total: number; avgTime: number }>;
  byBanca: Record<string, { correct: number; total: number; avgTime: number }>;
  recentActivity: { date: string; count: number }[];
  streakDays: number;
}

// Helper functions for local storage
const getLocalHistory = (): QuestionHistoryEntry[] => {
  try {
    const stored = localStorage.getItem(LOCAL_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveLocalHistory = (history: QuestionHistoryEntry[]) => {
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));
};

// Cache question metadata locally
const getQuestionsCache = (): Record<string, { campo_medico: string; banca: string }> => {
  try {
    const stored = localStorage.getItem(LOCAL_QUESTIONS_CACHE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const updateQuestionsCache = (questionId: string, campo_medico: string, banca: string) => {
  const cache = getQuestionsCache();
  cache[questionId] = { campo_medico, banca };
  localStorage.setItem(LOCAL_QUESTIONS_CACHE_KEY, JSON.stringify(cache));
};

export type TimeFilter = 'today' | 'week' | 'month' | 'all';

export function useQuestionHistory(timeFilter: TimeFilter = 'all') {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['questionHistory', user?.id],
    queryFn: async () => {
      const localHistory = getLocalHistory();

      if (!user) {
        return localHistory;
      }

      if (DEV_MODE) {
        return localHistory;
      }

      // Optimization: Fetch only necessary fields for "isAnswered" checks
      // We don't need the full question join here anymore
      const { data, error } = await supabase
        .from('user_question_history')
        .select('id, user_id, question_id, is_correct, selected_answer, answered_at, time_spent_seconds')
        .eq('user_id', user.id)
        .order('answered_at', { ascending: false });

      if (error) {
        console.error('Error fetching history:', error);
        return [];
      }

      return data as QuestionHistoryEntry[];
    },
    enabled: !!user,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: stats } = useQuery({
    queryKey: ['userStats', user?.id, timeFilter],
    queryFn: async (): Promise<UserStats> => {
      if (!user) {
        return {
          totalAnswered: 0,
          totalCorrect: 0,
          totalIncorrect: 0,
          accuracy: 0,
          averageTimeSeconds: 0,
          totalTimeSeconds: 0,
          byField: {},
          byBanca: {},
          recentActivity: [],
          streakDays: 0,
        };
      }

      if (DEV_MODE) {
        // ... (Keep existing DEV_MODE logic if preferred, or mock RPC response)
        // For brevity reusing existing logic or simplified logic for dev
        return {
          totalAnswered: 0,
          totalCorrect: 0,
          totalIncorrect: 0,
          accuracy: 0,
          averageTimeSeconds: 0,
          totalTimeSeconds: 0,
          byField: {},
          byBanca: {},
          recentActivity: [],
          streakDays: 0,
        };
      }

      const { data, error } = await supabase
        .rpc('get_user_stats', {
          p_user_id: user.id,
          p_time_filter: timeFilter
        });

      if (error) {
        console.error('Error fetching stats:', error);
        throw error;
      }

      return data as unknown as UserStats;
    },
    enabled: !!user,
  });

  const saveAnswerMutation = useMutation({
    mutationFn: async ({
      questionId,
      selectedAnswer,
      isCorrect,
      timeSpentSeconds,
      campo_medico,
      banca,
    }: {
      questionId: string;
      selectedAnswer: number;
      isCorrect: boolean;
      timeSpentSeconds?: number;
      campo_medico?: string;
      banca?: string;
    }) => {
      // Always cache question metadata
      if (campo_medico && banca) {
        updateQuestionsCache(questionId, campo_medico, banca);
      }

      const newLocalEntry: QuestionHistoryEntry = {
        id: crypto.randomUUID(),
        user_id: user?.id || 'guest',
        question_id: questionId,
        selected_answer: selectedAnswer,
        is_correct: isCorrect,
        answered_at: new Date().toISOString(),
        time_spent_seconds: timeSpentSeconds ?? null,
        campo_medico,
        banca,
      };

      if (!user || DEV_MODE) {
        const localHistory = getLocalHistory();
        localHistory.unshift(newLocalEntry);
        saveLocalHistory(localHistory);
        return newLocalEntry;
      }

      // Always insert new record (allow multiple attempts)
      const { data, error } = await supabase
        .from('user_question_history')
        .insert({
          user_id: user.id,
          question_id: questionId,
          selected_answer: selectedAnswer,
          is_correct: isCorrect,
          time_spent_seconds: timeSpentSeconds ?? null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving answer:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionHistory', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['userStats', user?.id] });
    },
  });

  const isQuestionAnswered = useCallback((questionId: string): boolean => {
    return history.some(h => h.question_id === questionId);
  }, [history]);

  const getQuestionAttempts = useCallback((questionId: string): QuestionHistoryEntry[] => {
    return history.filter(h => h.question_id === questionId);
  }, [history]);

  return {
    history,
    stats: stats ?? {
      totalAnswered: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      accuracy: 0,
      averageTimeSeconds: 0,
      totalTimeSeconds: 0,
      byField: {},
      byBanca: {},
      recentActivity: [],
      streakDays: 0,
    },
    isLoading,
    saveAnswer: saveAnswerMutation.mutateAsync,
    isQuestionAnswered,
    getQuestionAttempts,
  };
}
