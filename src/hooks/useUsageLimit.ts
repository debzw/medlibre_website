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
  const [userType, setUserType] = useState<UserType>('guest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeUsage();
  }, [userProfile, isAuthenticated]);

  const initializeUsage = async () => {
    setLoading(true);

    if (isAuthenticated && userProfile) {
      // Logged in user
      setUserType(userProfile.tier as UserType);
      
      // Check if we need to reset daily count
      const today = new Date().toISOString().split('T')[0];
      if (userProfile.last_reset_date !== today) {
        // Reset counter for new day
        await supabase
          .from('user_profiles')
          .update({
            questions_answered_today: 0,
            last_reset_date: today,
          })
          .eq('id', userProfile.id);
        setQuestionsUsed(0);
      } else {
        setQuestionsUsed(userProfile.questions_answered_today);
      }
    } else {
      // Guest user
      setUserType('guest');
      const guestUsage = getGuestUsage();
      setQuestionsUsed(guestUsage.questionsAnswered);
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

  const incrementUsage = useCallback(async () => {
    const newCount = questionsUsed + 1;
    setQuestionsUsed(newCount);

    if (isAuthenticated && userProfile) {
      // Update in database for logged in users
      await supabase
        .from('user_profiles')
        .update({
          questions_answered_today: newCount,
        })
        .eq('id', userProfile.id);
    } else {
      // Update localStorage for guests
      const today = new Date().toISOString().split('T')[0];
      const newUsage: GuestUsage = {
        questionsAnswered: newCount,
        lastResetDate: today,
      };
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(newUsage));
    }
  }, [questionsUsed, isAuthenticated, userProfile]);

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

  return {
    questionsUsed,
    userType,
    loading,
    incrementUsage,
    canAnswerMore,
    getRemainingQuestions,
    getLimit,
  };
}
