-- Add missing increment_daily_usage RPC function
-- This function handles incrementing the daily question counter and auto-resets when a new day starts

CREATE OR REPLACE FUNCTION public.increment_daily_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_new_count INTEGER;
    v_last_reset DATE;
BEGIN
    -- Get authenticated user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    -- Get current reset date
    SELECT last_reset_date INTO v_last_reset
    FROM public.user_profiles
    WHERE id = v_user_id;
    
    -- Check if we need to reset (new day)
    IF v_last_reset < CURRENT_DATE THEN
        -- Reset counter for new day
        UPDATE public.user_profiles
        SET questions_answered_today = 1,
            last_reset_date = CURRENT_DATE
        WHERE id = v_user_id
        RETURNING questions_answered_today INTO v_new_count;
    ELSE
        -- Increment counter
        UPDATE public.user_profiles
        SET questions_answered_today = questions_answered_today + 1
        WHERE id = v_user_id
        RETURNING questions_answered_today INTO v_new_count;
    END IF;
    
    RETURN v_new_count;
END;
$$;
