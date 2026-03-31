# Medlibre — Analytics Engine: Implementation Log & Roadmap

## Status

| Phase | DB Migration | Frontend | Status |
|-------|-------------|----------|--------|
| Phase 1 — Integrity | `20260315200000_phase1_analytics_integrity.sql` | hooks + QuestionCard | ✅ Applied |
| Phase 2 — Sessions & Buckets | `20260315210000_phase2_sessions_buckets.sql` | page.tsx session lifecycle | ✅ Applied |
| Phase 3 — Behavioral Intelligence | `20260315220000_phase3_engagement_events.sql` | QuestionCard + page.tsx | 🔲 Planned |
| Phase 4 — Scale & Dashboard | partitioning + materialized views + admin UI | — | 🔲 Future |

---

## Phase 1 — Data Integrity ("Stop the Bleeding")

### Problem Solved
- **Ghost data**: duplicate rows in `user_question_history` from double-clicks and React StrictMode re-renders.
- **Counter drift**: `user_profiles.questions_answered_today` could diverge from the real event count.
- **Refetch storms**: `staleTime: 0` caused full table scans on every tab focus.
- **Timezone drift**: daily counter reset at UTC midnight, not BRT midnight.

### What Was Built

#### DB
- `user_question_history.idempotency_key UUID UNIQUE` — prevents duplicate rows at the DB level (`ON CONFLICT DO NOTHING`).
- `user_daily_stats (user_id, stat_date DATE, total_answered, total_correct, total_time_seconds)` — trigger-maintained daily aggregate in `America/Sao_Paulo` timezone.
- `record_answer` RPC (atomic) — single transaction replaces the old dual-write:
  - INSERT with `ON CONFLICT (idempotency_key) DO NOTHING`
  - Updates `user_profiles.questions_answered_today` for backward compat
  - Returns `{ was_duplicate: boolean, today_count: number }`

#### Frontend

| File | Change |
|------|--------|
| `src/components/QuestionCard.tsx` | `isSavingRef` mutex prevents double-submission before RPC resolves |
| `src/components/QuestionCard.tsx` | `idempotencyKeyRef` — fresh UUID per question view, reset on `question.id` change |
| `src/hooks/useQuestionHistory.ts` | `saveAnswer` calls `record_answer` RPC; uses returned `today_count` to update usage state instantly (no extra round-trip) |
| `src/hooks/useUsageLimit.ts` | `incrementUsage(serverCount?)` — fast path uses server-returned count; falls back to `increment_daily_usage` RPC |
| `src/hooks/useQuestionHistory.ts` | `staleTime: 30_000` (was `0`) — eliminates refetch storm on window focus |
| `src/integrations/supabase/types.ts` | Added `UserDailyStats`, `idempotency_key` on `QuestionHistoryEntry` |

---

## Phase 2 — Study Sessions & Source Buckets

### Problem Solved
- No way to group answers into study sessions → impossible to analyze session-level patterns.
- `get_study_session_questions` didn't expose which algorithm bucket served each question → no way to measure bucket efficacy.

### What Was Built

#### DB

- `study_sessions` table: `(id UUID PK, user_id, started_at, ended_at, last_activity_at, questions_attempted, questions_correct, total_time_seconds, session_type)`. RLS: users own their rows.
- `start_study_session(p_session_id, p_session_type)` — idempotent (`ON CONFLICT DO NOTHING`); auto-closes sessions idle > 30 min.
- `end_study_session(p_session_id, attempted, correct, time)` — writes final stats.
- `get_study_session_questions_v2` — same FSRS/LECTOR logic as v1 but returns `source_bucket TEXT` (`'srs' | 'weak_theme' | 'discovery' | 'general' | 'cold_start'`).
- `user_question_history.session_id UUID FK → study_sessions(id) ON DELETE SET NULL`
- `record_answer` updated: accepts `p_session_id UUID DEFAULT NULL`; updates `study_sessions.last_activity_at` when provided.

#### Frontend

| File | Change |
|------|--------|
| `app/(protected)/app/page.tsx` | `sessionIdRef` — one UUID per component mount (= one study session) |
| `app/(protected)/app/page.tsx` | `useEffect([user?.id])` — calls `start_study_session` on mount, `end_study_session` in cleanup |
| `app/(protected)/app/page.tsx` | `sessionQuestionsAttempted` / `sessionQuestionsCorrect` refs incremented in `handleAnswered` |
| `app/(protected)/app/page.tsx` | `sessionId={user ? sessionIdRef.current : undefined}` passed to `<QuestionCard>` |
| `src/components/QuestionCard.tsx` | `sessionId` prop added; forwarded to `saveAnswer` |
| `src/hooks/useQuestionHistory.ts` | `saveAnswer` accepts `sessionId`; passes as `p_session_id` to `record_answer` |
| `src/hooks/useQuestions.ts` | Uses `get_study_session_questions_v2`; builds `questionBuckets` map from `source_bucket` |
| `src/integrations/supabase/types.ts` | Added `StudySession`, `study_sessions` table, `session_id` on `QuestionHistoryEntry` |

---

## Phase 3 — Behavioral Intelligence (PLANNED)

### Goal
Capture *how* students interact with questions, not just right/wrong results. Enables questions like:
- "What % of students read the explanation after a wrong answer?"
- "Which questions take longest to answer (reading-speed signal)?"
- "Are filter changes correlated with session dropout?"

---

### DB Migration: `20260315220000_phase3_engagement_events.sql`

#### A. Add `time_to_first_click_ms` to `user_question_history`

```sql
ALTER TABLE public.user_question_history
  ADD COLUMN IF NOT EXISTS time_to_first_click_ms INT DEFAULT NULL;
```

> Motivation: `time_spent_seconds` is rounded and coarse. Raw milliseconds distinguish instant recognition (< 500 ms) from deliberate reasoning (> 30 s).

#### B. Update `record_answer` RPC

Add `p_time_to_first_click_ms INT DEFAULT NULL` parameter; insert into the new column.

#### C. Create `engagement_events` table

```sql
CREATE TABLE public.engagement_events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    session_id   UUID        REFERENCES public.study_sessions(id) ON DELETE SET NULL,
    event_type   TEXT        NOT NULL,
    question_id  UUID        REFERENCES public.questions(id) ON DELETE SET NULL,
    metadata     JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_engagement_events_user_created
  ON public.engagement_events (user_id, created_at DESC);
CREATE INDEX idx_engagement_events_type
  ON public.engagement_events (event_type, created_at DESC);

ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;
-- SELECT / INSERT own rows (same RLS pattern as study_sessions)
```

**Event catalogue**

| `event_type` | `metadata` keys | Fired from |
|---|---|---|
| `explanation_viewed` | `{ is_correct: bool }` | `QuestionCard.tsx` (IntersectionObserver, 50% visibility threshold) |
| `filter_changed` | `{ banca, ano, campo, especialidade }` | `app/page.tsx` (skips initial mount) |
| `question_reported` | `{ reason: string }` | `ReportDialog.tsx` (existing flow, add call here) |

#### D. Create `record_engagement_event` RPC

```sql
CREATE OR REPLACE FUNCTION public.record_engagement_event(
    p_event_type  TEXT,
    p_session_id  UUID  DEFAULT NULL,
    p_question_id UUID  DEFAULT NULL,
    p_metadata    JSONB DEFAULT '{}'
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;  -- silent no-op for guests
  INSERT INTO public.engagement_events (user_id, session_id, event_type, question_id, metadata)
  VALUES (auth.uid(), p_session_id, p_event_type, p_question_id, p_metadata);
END; $$;

GRANT EXECUTE ON FUNCTION public.record_engagement_event(TEXT, UUID, UUID, JSONB) TO authenticated;
```

---

### Frontend Changes

#### `src/integrations/supabase/types.ts`
- Add `EngagementEvent` interface
- Add `engagement_events` to `Database.public.Tables`
- Add `time_to_first_click_ms?: number | null` to `QuestionHistoryEntry`

#### `src/components/QuestionCard.tsx` — 2 additions

**1. Capture `time_to_first_click_ms`** at the top of `handleOptionClick`, before any async work:
```typescript
const timeToFirstClickMs = Date.now() - startTimeRef.current;
```
Pass to `saveAnswer` as `timeToFirstClickMs`.

**2. Track `explanation_viewed`** — after answer is shown, observe the explanation div:
```typescript
const explanationRef = useRef<HTMLDivElement>(null);
const hasTrackedExplanationRef = useRef(false);

// Reset on question change
useEffect(() => { hasTrackedExplanationRef.current = false; }, [question.id]);

// Fire once when explanation becomes 50% visible
useEffect(() => {
  if (!showResult || !user || !explanationRef.current) return;
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !hasTrackedExplanationRef.current) {
      hasTrackedExplanationRef.current = true;
      supabase.rpc('record_engagement_event', {
        p_event_type: 'explanation_viewed',
        p_session_id: sessionId ?? null,
        p_question_id: question.id,
        p_metadata: { is_correct: selectedOption === question.resposta_correta },
      });
    }
  }, { threshold: 0.5 });
  observer.observe(explanationRef.current);
  return () => observer.disconnect();
}, [showResult, user]);
```
Attach `ref={explanationRef}` to the explanation container div.

#### `src/hooks/useQuestionHistory.ts`
- Add `timeToFirstClickMs?: number` to `saveAnswer` mutation params
- Pass as `p_time_to_first_click_ms: timeToFirstClickMs ?? null` to `record_answer` RPC

#### `app/(protected)/app/page.tsx`
Add `filter_changed` tracking after the filter state declarations:
```typescript
const isFirstFilterRenderRef = useRef(true);
useEffect(() => {
  if (isFirstFilterRenderRef.current) { isFirstFilterRenderRef.current = false; return; }
  if (!user) return;
  supabase.rpc('record_engagement_event', {
    p_event_type: 'filter_changed',
    p_session_id: sessionIdRef.current,
    p_metadata: { banca: selectedBanca, ano: selectedAno, campo: selectedCampo, especialidade: selectedEspecialidade },
  });
}, [selectedBanca, selectedAno, selectedCampo, selectedEspecialidade]);
```

---

### Files to Create / Modify

| File | Action |
|------|--------|
| `supabase/migrations/20260315220000_phase3_engagement_events.sql` | CREATE |
| `src/integrations/supabase/types.ts` | MODIFY |
| `src/components/QuestionCard.tsx` | MODIFY |
| `src/hooks/useQuestionHistory.ts` | MODIFY |
| `app/(protected)/app/page.tsx` | MODIFY |

### Verification

1. Answer a question → `user_question_history` row has non-null `time_to_first_click_ms`
2. Scroll to explanation → `engagement_events` has `explanation_viewed` row with correct `question_id`
3. Change a filter → `engagement_events` has `filter_changed` row with metadata
4. Guest answers → no rows inserted (RPC silent no-op via `auth.uid() IS NULL` guard)
5. `npx tsc --noEmit` passes with no errors

---

## Phase 4 — Scale Optimization (Future)

- **Partitioning**: Partition `user_question_history` by month — hot partition (current month) stays in memory; cold partitions can be compressed.
- **Materialized views**: Pre-compute expensive aggregations (weekly trends, leaderboards); refresh every 15 min via `pg_cron`.
- **Cold data archival**: Move rows > 90 days to a separate schema.
- **Admin analytics dashboard**:
  - Source bucket performance (accuracy by bucket → FSRS algorithm tuning)
  - Session duration distribution (mobile micro-sessions vs desktop deep-dives)
  - Explanation view rate per question (quality signal → flag questions with low view rate after wrong answer)
  - `time_to_first_click_ms` distribution per question (hard question detector)
