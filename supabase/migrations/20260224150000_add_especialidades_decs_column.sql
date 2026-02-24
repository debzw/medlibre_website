-- Adiciona coluna especialidades_tags (TEXT[]) à tabela questions
ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS especialidades_tags TEXT[] DEFAULT NULL;

-- Índice GIN para buscas eficientes com = ANY(...) e @>
CREATE INDEX IF NOT EXISTS idx_questions_especialidades_tags
    ON public.questions USING GIN (especialidades_tags);
