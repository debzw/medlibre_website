-- Add theme_preference column to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN theme_preference text DEFAULT 'dark';