import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DEV_MODE } from '@/hooks/useAuth';

const LOCAL_HISTORY_KEY = 'medlibre_question_history';
const LOCAL_QUESTIONS_CACHE_KEY = 'medlibre_questions_cache';

import { Question, FilterOptions, QuestionHistoryEntry } from '@/types/database';

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

// Legacy type kept for any remaining references during migration
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

// ─── FSRS v4 ──────────────────────────────────────────────────────────────────

// 5-level cognitive effort scale:
// 0 = Apagão (complete blackout) → FSRS Again
// 1 = Muito difícil              → FSRS Hard
// 2 = Com esforço                → FSRS Hard
// 3 = Bom                        → FSRS Good
// 4 = Instantâneo (instant)      → FSRS Easy
export type ConfidenceLevel = 0 | 1 | 2 | 3 | 4;

// Map confidence (0-4) → FSRS rating (1=Again, 2=Hard, 3=Good, 4=Easy)
const CONFIDENCE_TO_RATING: Record<ConfidenceLevel, 1 | 2 | 3 | 4> = {
  0: 1,
  1: 2,
  2: 2,
  3: 3,
  4: 4,
};

// FSRS-4.5 default weights (open-spaced-repetition/fsrs4anki, 2024)
const FSRS_W = [
  0.40255,  // W[0]  S₀(Again)
  1.18385,  // W[1]  S₀(Hard)
  3.17365,  // W[2]  S₀(Good)
  15.6945,  // W[3]  S₀(Easy)
  7.1949,   // W[4]  D₀ intercept
  0.5345,   // W[5]  D₀ exponent
  1.4604,   // W[6]  D update Δ per rating
  0.0046,   // W[7]  D mean-reversion rate
  1.54575,  // W[8]  Recall S: growth coefficient
  0.1192,   // W[9]  Recall S: S exponent
  1.01925,  // W[10] Recall S: R exponent
  1.9395,   // W[11] Forget S: coefficient
  0.11,     // W[12] Forget S: D exponent
  0.29605,  // W[13] Forget S: (S+1) exponent
  2.2698,   // W[14] Forget S: R exponent
  0.2315,   // W[15] Hard penalty   (< 1 → reduces stability vs Good)
  2.9898,   // W[16] Easy bonus     (> 1 → increases stability vs Good)
];

interface FSRSState {
  stability: number | null;
  difficulty: number | null;
  interval: number;
  lastReviewed: string;
  streak: number;
}

interface FSRSResult {
  stability: number;
  difficulty: number;
  interval: number;
  next_review: string;
  last_reviewed: string;
  ease_factor: number;    // legacy field kept at 2.5 (not used by FSRS)
  streak: number;
  last_confidence: number;
}

function applyFSRS4(state: FSRSState, confidence: ConfidenceLevel): FSRSResult {
  const rating = CONFIDENCE_TO_RATING[confidence];
  const W = FSRS_W;
  const now = new Date();

  // ── First review (no prior FSRS data) ──────────────────────────────────────
  if (state.stability === null || state.difficulty === null) {
    const S0 = W[rating - 1];
    const D0 = Math.min(10, Math.max(1, W[4] - Math.exp(W[5] * (rating - 1)) + 1));
    const interval = Math.max(1, Math.round(S0));
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + interval);
    return {
      stability: parseFloat(S0.toFixed(4)),
      difficulty: parseFloat(D0.toFixed(4)),
      interval,
      next_review: nextReview.toISOString(),
      last_reviewed: now.toISOString(),
      ease_factor: 2.5,
      streak: rating >= 3 ? 1 : 0,
      last_confidence: confidence,
    };
  }

  // ── Subsequent review ───────────────────────────────────────────────────────
  const S = state.stability;
  const D = state.difficulty;
  const t = Math.max(0, (now.getTime() - new Date(state.lastReviewed).getTime()) / 86400000);

  // Retrievability: R = 0.9^(t/S)
  const R = Math.pow(0.9, t / S);

  let newS: number;

  if (rating === 1) {
    // Forgot — forget stability formula:
    // S_f = W[11] * D^(-W[12]) * ((S+1)^W[13] - 1) * exp(W[14]*(1-R))
    newS = W[11]
      * Math.pow(D, -W[12])
      * (Math.pow(S + 1, W[13]) - 1)
      * Math.exp(W[14] * (1 - R));
  } else {
    // Recalled — recall stability formula:
    // S_r = S * (exp(W[8]*(11-D)*S^(-W[9])*(exp(W[10]*(1-R))-1)) + 1) * penalty * bonus
    const hardPenalty = rating === 2 ? W[15] : 1.0;
    const easyBonus   = rating === 4 ? W[16] : 1.0;
    newS = S
      * (Math.exp(W[8] * (11 - D) * Math.pow(S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1)) + 1)
      * hardPenalty
      * easyBonus;
  }

  // Clamp stability: min 0.1 days, max 100 years
  newS = Math.min(36500, Math.max(0.1, newS));

  // Difficulty update with mean reversion toward D₀(Again) = W[4]
  // D' = D + W[6]*(3 - rating)  [raw delta]
  // D' = W[7]*W[4] + (1-W[7])*D'  [mean reversion, W[7]=0.0046 is very small]
  const D_raw = D + W[6] * (3 - rating);
  const newD = Math.min(10, Math.max(1, W[7] * W[4] + (1 - W[7]) * D_raw));

  const interval = Math.max(1, Math.round(newS));
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    stability: parseFloat(newS.toFixed(4)),
    difficulty: parseFloat(newD.toFixed(4)),
    interval,
    next_review: nextReview.toISOString(),
    last_reviewed: now.toISOString(),
    ease_factor: 2.5,
    streak: rating >= 3 ? state.streak + 1 : 0,
    last_confidence: confidence,
  };
}

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

      // Fetch only necessary fields for "isAnswered" / "getQuestionAttempts" checks
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
    // 30s cache: prevents refetch-storms on tab-focus / component-remount.
    // History is updated via cache invalidation in onSuccess, not re-fetched continuously.
    staleTime: 30_000,
    gcTime:    300_000,
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
      idempotencyKey,
      sourceBucket = 'unknown',
      sessionId,
    }: {
      questionId: string;
      selectedAnswer: number;
      isCorrect: boolean;
      timeSpentSeconds?: number;
      campo_medico?: string;
      banca?: string;
      /** Client-generated UUID — prevents duplicate rows on retries / double-clicks */
      idempotencyKey: string;
      /** Which algorithm bucket served this question: 'srs'|'weak_theme'|'discovery'|'general'|'cold_start'|'manual'|'unknown' */
      sourceBucket?: string;
      /** Study session UUID — links this answer to a study_sessions row */
      sessionId?: string;
    }) => {
      // Always cache question metadata locally for offline-style use
      if (campo_medico && banca) {
        updateQuestionsCache(questionId, campo_medico, banca);
      }

      const newLocalEntry: QuestionHistoryEntry = {
        id: idempotencyKey,
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
        return { localEntry: newLocalEntry, today_count: null, was_duplicate: false };
      }

      // ── Atomic RPC: single transaction, idempotent via ON CONFLICT DO NOTHING ──
      // record_answer handles the INSERT + trigger-maintained user_daily_stats update.
      const { data, error } = await supabase
        .rpc('record_answer', {
          p_question_id:     questionId,
          p_selected_answer: selectedAnswer,
          p_is_correct:      isCorrect,
          p_time_spent:      timeSpentSeconds ?? null,
          p_idempotency_key: idempotencyKey,
          p_source_bucket:   sourceBucket,
          p_session_id:      sessionId ?? null,
        });

      if (error) {
        console.error('Error saving answer via record_answer RPC:',
          error.message, '| code:', error.code, '| hint:', error.hint);
        throw error;
      }

      // data = { was_duplicate: boolean, today_count: number }
      return data as { was_duplicate: boolean; today_count: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionHistory', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['userStats', user?.id] });
    },
  });

  const saveSRSFeedbackMutation = useMutation({
    mutationFn: async ({
      questionId,
      confidence,
    }: {
      questionId: string;
      confidence: ConfidenceLevel;
    }) => {
      if (!user || DEV_MODE) return;

      const { data: existing } = await supabase
        .from('user_spaced_repetition')
        .select('stability, difficulty, interval, streak, last_reviewed')
        .eq('user_id', user.id)
        .eq('question_id', questionId)
        .maybeSingle();

      const state: FSRSState = {
        stability:    existing?.stability    ?? null,
        difficulty:   existing?.difficulty   ?? null,
        interval:     existing?.interval     ?? 0,
        lastReviewed: existing?.last_reviewed ?? new Date().toISOString(),
        streak:       existing?.streak       ?? 0,
      };

      const updates = applyFSRS4(state, confidence);

      const { error } = await supabase
        .from('user_spaced_repetition')
        .upsert(
          { user_id: user.id, question_id: questionId, ...updates },
          { onConflict: 'user_id,question_id' }
        );

      if (error) throw error;
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
    saveSRSFeedback: saveSRSFeedbackMutation.mutateAsync,
    isQuestionAnswered,
    getQuestionAttempts,
  };
}
