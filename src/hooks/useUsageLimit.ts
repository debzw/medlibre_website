import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserProfile, GuestUsage, UserType } from '@/types/database';
import { LIMIT_CONFIG } from '@/config/devMode';

const GUEST_STORAGE_KEY = 'medlibre_guest_usage';

export function useUsageLimit(
  userProfile: UserProfile | null,
  isAuthenticated: boolean
) {
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const [pdfsUsed, setPdfsUsed] = useState(0);
  const [userType, setUserType] = useState<UserType>('guest');
  const [loading, setLoading] = useState(true);
  const [isFirstGuestInterstitial, setIsFirstGuestInterstitial] = useState(false);

  useEffect(() => {
    initializeUsage();
  }, [userProfile, isAuthenticated]);

  const initializeUsage = async () => {
    setLoading(true);

    if (isAuthenticated && userProfile) {
      // Logged in user
      setUserType(userProfile.tier as UserType);

      // Fetch authoritative count from the server (now derived from events)
      try {
        const { data: serverCount, error } = await supabase.rpc('increment_daily_usage');
        if (!error && typeof serverCount === 'number') {
          setQuestionsUsed(serverCount);
        } else {
          // Fallback to profile if RPC fails
          setQuestionsUsed(userProfile.questions_answered_today || 0);
        }
      } catch (err) {
        setQuestionsUsed(userProfile.questions_answered_today || 0);
      }

      setPdfsUsed(userProfile.pdfs_exported_today || 0);
    } else {
      // Guest user
      setUserType('guest');
      const guestUsage = getGuestUsage();
      setQuestionsUsed(guestUsage.questionsAnswered);
      setPdfsUsed(0);

      // Check if CTA ad for guest was already shown
      const ctaShown = localStorage.getItem('medlibre_interstitial_cta_shown');
      setIsFirstGuestInterstitial(!ctaShown);
    }

    setLoading(false);
  };

  const getGuestUsage = (): GuestUsage => {
    try {
      const stored = localStorage.getItem(GUEST_STORAGE_KEY);
      if (stored) {
        const usage: GuestUsage = JSON.parse(stored);
        const today = new Date().toISOString().split('T')[0];

        // Reset if it's a new day
        if (usage.lastResetDate !== today) {
          const newUsage: GuestUsage = {
            questionsAnswered: 0,
            lastResetDate: today,
          };
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(newUsage));
          return newUsage;
        }
        return usage;
      }
    } catch (err) {
      console.error('Error reading guest usage:', err);
    }

    const newUsage: GuestUsage = {
      questionsAnswered: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
    };
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(newUsage));
    return newUsage;
  };

  /**
   * Increment the daily usage counter.
   * @param serverCount - When provided (from the `record_answer` RPC response),
   *   use it directly instead of making an extra round-trip to `increment_daily_usage`.
   *   This eliminates the N+1 RPC call after every question answer.
   */
  const incrementUsage = useCallback(async (serverCount?: number) => {
    if (isAuthenticated && userProfile) {
      try {
        // Fast path: server already returned the authoritative count via record_answer
        if (typeof serverCount === 'number') {
          setQuestionsUsed(serverCount);
          return;
        }

        // Fallback: call increment_daily_usage (now a lightweight SELECT from user_daily_stats)
        const { data: newCount, error } = await supabase.rpc('increment_daily_usage');

        if (error) {
          console.error('Error reading daily usage:', error);
          return;
        }

        if (typeof newCount === 'number') {
          setQuestionsUsed(newCount);
        }
      } catch (err) {
        console.error('Unexpected error in incrementUsage:', err);
      }
    } else {
      // Update localStorage for guests
      const newCount = questionsUsed + 1;
      setQuestionsUsed(newCount);
      const today = new Date().toISOString().split('T')[0];
      const newUsage: GuestUsage = {
        questionsAnswered: newCount,
        lastResetDate: today,
      };
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(newUsage));
    }
  }, [questionsUsed, isAuthenticated, userProfile]);

  const incrementPdfUsage = useCallback(async () => {
    if (isAuthenticated && userProfile) {
      try {
        const { data: newCount, error } = await supabase.rpc('increment_pdf_usage');

        if (error) {
          console.error('Error incrementing PDF usage:', error);
          return;
        }

        if (typeof newCount === 'number') {
          setPdfsUsed(newCount);
        }
      } catch (err) {
        console.error('Unexpected error incrementing PDF usage:', err);
      }
    }
  }, [isAuthenticated, userProfile]);

  const getLimit = (): number => {
    const config = LIMIT_CONFIG[userType];
    if (!config.enabled) return Infinity;
    return config.limit;
  };

  const canAnswerMore = (): boolean => {
    const config = LIMIT_CONFIG[userType];
    if (!config.enabled) return true;
    return questionsUsed < config.limit;
  };

  const getRemainingQuestions = (): number => {
    const config = LIMIT_CONFIG[userType];
    if (!config.enabled) return Infinity;
    return Math.max(0, config.limit - questionsUsed);
  };

  const getPdfLimit = (): number => {
    const config = LIMIT_CONFIG[userType];
    if (!config.pdf_enabled) return Infinity;
    return config.pdf_limit || 0;
  };

  const canExportPdf = (): boolean => {
    const config = LIMIT_CONFIG[userType];
    if (!config.pdf_enabled) return true;
    return pdfsUsed < (config.pdf_limit || 0);
  };

  const getRemainingPdfs = (): number => {
    const config = LIMIT_CONFIG[userType];
    if (!config.pdf_enabled) return Infinity;
    return Math.max(0, (config.pdf_limit || 0) - pdfsUsed);
  };

  const markInterstitialAsShown = useCallback(() => {
    if (userType === 'guest' && isFirstGuestInterstitial) {
      setIsFirstGuestInterstitial(false);
      localStorage.setItem('medlibre_interstitial_cta_shown', 'true');
    }
  }, [userType, isFirstGuestInterstitial]);

  const resetGuestUsage = useCallback(() => {
    if (userType === 'guest') {
      const today = new Date().toISOString().split('T')[0];
      const newUsage: GuestUsage = {
        questionsAnswered: 0,
        lastResetDate: today,
      };
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(newUsage));
      localStorage.removeItem('medlibre_interstitial_cta_shown');
      setQuestionsUsed(0);
      setIsFirstGuestInterstitial(true);
      console.log('Guest usage reset successfully.');
    }
  }, [userType]);

  return {
    questionsUsed,
    pdfsUsed,
    userType,
    loading,
    incrementUsage,
    incrementPdfUsage,
    canAnswerMore,
    canExportPdf,
    getRemainingQuestions,
    getRemainingPdfs,
    getLimit,
    getPdfLimit,
    isFirstGuestInterstitial,
    markInterstitialAsShown,
    resetGuestUsage,
  };
}
