-- ============================================================
-- Migration: get_decs_suggestions
-- Description:
-- Creates RPC function that returns DeCS term suggestions filtered
-- to only include terms that have questions (direct or ancestral).
-- Replaces the frontend ILIKE query on decs_terms which returned
-- all matching terms regardless of whether they yield any results.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_decs_suggestions(
  p_query TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT array_agg(dt.clean_term ORDER BY similarity(dt.clean_term, lower(p_query)) DESC)
  FROM public.decs_terms dt
  WHERE dt.clean_term ILIKE '%' || p_query || '%'
    AND (
      -- Has direct questions via question_decs
      EXISTS (
        SELECT 1 FROM public.question_decs qd WHERE qd.decs_id = dt.id
      )
      OR
      -- Is an ancestor of a term that has questions
      -- Uses ltree <@ operator: child <@ parent means child is descendant of parent
      EXISTS (
        SELECT 1
        FROM public.decs_tree_paths parent_tp
        JOIN public.decs_tree_paths child_tp
          ON child_tp.tree_path <@ parent_tp.tree_path
         AND child_tp.decs_id != parent_tp.decs_id
        JOIN public.question_decs qd ON qd.decs_id = child_tp.decs_id
        WHERE parent_tp.decs_id = dt.id
      )
    )
  LIMIT p_limit;
$$;
