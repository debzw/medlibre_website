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
      if (!user) return [];

      // Use localStorage in DEV_MODE
      if (DEV_MODE) {
        return getLocalHistory();
      }

      const { data, error } = await supabase
        .from('user_question_history')
        .select('*')
        .eq('user_id', user.id)
        .order('answered_at', { ascending: false });

      if (error) {
        console.error('Error fetching history:', error);
        return [];
      }

      return data as QuestionHistoryEntry[];
    },
    enabled: !!user,
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

      let historyData: any[] = [];

      if (DEV_MODE) {
        // Use local history with cached question data
        const localHistory = getLocalHistory();
        const questionsCache = getQuestionsCache();

        historyData = localHistory.map(entry => ({
          ...entry,
          questions: {
            // Map campo_medico to output_grande_area for consistency
            output_grande_area: entry.campo_medico || questionsCache[entry.question_id]?.campo_medico || 'Desconhecido',
            banca: entry.banca || questionsCache[entry.question_id]?.banca || 'Desconhecida',
          },
        }));
      } else {
        // Get history with question details from database
        let query = supabase
          .from('user_question_history')
          .select(`
            *,
            questions (
              output_grande_area,
              banca
            )
          `)
          .eq('user_id', user.id);

        // Apply time filters for database query if needed, 
        // but fetching all and filtering in memory might be easier for consistency with dev mode 
        // and since dataset isn't huge yet. 
        // However, for correctness let's fetch all and filter in memory to match Dev mode logic below.

        const { data, error } = await query;

        if (error || !data) {
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

        historyData = data;
      }

      // Apply time filtering
      if (timeFilter !== 'all') {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        historyData = historyData.filter(entry => {
          const entryDate = new Date(entry.answered_at);

          if (timeFilter === 'today') {
            return entryDate >= startOfDay;
          } else if (timeFilter === 'week') {
            const startOfWeek = new Date(startOfDay);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Start of week (Sunday)
            return entryDate >= startOfWeek;
          } else if (timeFilter === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return entryDate >= startOfMonth;
          }
          return true;
        });
      }

      const totalAttempts = historyData.length;
      const uniqueQuestions = new Set(historyData.map((h: any) => h.question_id)).size;

      const totalAnswered = uniqueQuestions;
      const totalCorrect = historyData.filter(h => h.is_correct).length;
      const totalIncorrect = totalAttempts - totalCorrect;
      const accuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;

      // Calculate time stats
      const timesSpent = historyData
        .map(h => h.time_spent_seconds)
        .filter((t): t is number => t !== null && t > 0);
      const totalTimeSeconds = timesSpent.reduce((sum, t) => sum + t, 0);
      const averageTimeSeconds = timesSpent.length > 0 ? totalTimeSeconds / timesSpent.length : 0;

      // Group by field
      const byField: Record<string, { correct: number; total: number; avgTime: number; totalTime: number }> = {};
      const byBanca: Record<string, { correct: number; total: number; avgTime: number; totalTime: number }> = {};

      historyData.forEach((entry: any) => {
        const field = entry.questions?.output_grande_area || 'Desconhecido';
        const banca = entry.questions?.banca || 'Desconhecida';
        const timeSpent = entry.time_spent_seconds || 0;

        if (!byField[field]) byField[field] = { correct: 0, total: 0, avgTime: 0, totalTime: 0 };
        byField[field].total++;
        byField[field].totalTime += timeSpent;
        if (entry.is_correct) byField[field].correct++;

        if (!byBanca[banca]) byBanca[banca] = { correct: 0, total: 0, avgTime: 0, totalTime: 0 };
        byBanca[banca].total++;
        byBanca[banca].totalTime += timeSpent;
        if (entry.is_correct) byBanca[banca].correct++;
      });

      // Calculate averages
      Object.values(byField).forEach(data => {
        data.avgTime = data.total > 0 ? Math.round(data.totalTime / data.total) : 0;
      });
      Object.values(byBanca).forEach(data => {
        data.avgTime = data.total > 0 ? Math.round(data.totalTime / data.total) : 0;
      });

      // Recent activity (last 7 days)
      const recentActivity: { date: string; count: number }[] = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = historyData.filter(h =>
          h.answered_at.startsWith(dateStr)
        ).length;
        recentActivity.push({ date: dateStr, count });
      }

      // Calculate Streak
      let streakDays = 0;
      const activityDates = new Set(
        historyData.map(h => h.answered_at.split('T')[0])
      );

      const sortedDates = Array.from(activityDates).sort().reverse();
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (activityDates.has(todayStr) || activityDates.has(yesterdayStr)) {
        let currentDate = activityDates.has(todayStr) ? new Date() : yesterday;
        while (true) {
          const checkStr = currentDate.toISOString().split('T')[0];
          if (activityDates.has(checkStr)) {
            streakDays++;
            currentDate.setDate(currentDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      return {
        totalAnswered,
        totalCorrect,
        totalIncorrect,
        accuracy,
        averageTimeSeconds: Math.round(averageTimeSeconds),
        totalTimeSeconds,
        byField,
        byBanca,
        recentActivity,
        streakDays,
      };
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
      if (!user) return null;

      // Cache question metadata
      if (campo_medico && banca) {
        updateQuestionsCache(questionId, campo_medico, banca);
      }

      if (DEV_MODE) {
        // Use localStorage in DEV_MODE
        const localHistory = getLocalHistory();

        // Always create a new entry
        const newEntry: QuestionHistoryEntry = {
          id: crypto.randomUUID(),
          user_id: user.id,
          question_id: questionId,
          selected_answer: selectedAnswer,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
          time_spent_seconds: timeSpentSeconds ?? null,
          campo_medico,
          banca,
        };

        localHistory.unshift(newEntry);
        saveLocalHistory(localHistory);
        return newEntry;
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
