# Profile Completion Onboarding Design

## Understanding Summary

- **What:** Progressive "complete your profile" UX with a red dot badge on the avatar
- **Why:** Collect user population data for product/analytics decisions
- **Who:** New users post-email-confirmation; existing users with incomplete profiles
- **UX:** Non-blocking — dismissible modal, no hard gate
- **Storage:** All 7 fields already exist in `user_profiles` — no migrations needed

## Fields

| Field | Editable | Source |
|---|---|---|
| `full_name` | Yes | Pre-filled from OAuth |
| `email` | No (read-only) | Managed by Supabase Auth |
| `locale` | Yes | Pre-filled from OAuth; Select: `pt-BR`, `en-US`, `es` |
| `university` | Yes | Select from `src/data/colleges.ts` |
| `age` | Yes | Number input, range 18–80 |
| `graduation_year` | Yes | Select, range 1980–2030 |
| `preferred_banca` | Yes | Select from distinct `banca` values in questions |

## Assumptions

- Completeness derived client-side: any of the 6 editable fields being null = incomplete
- Single persistent red dot — no reminder cadence, no dismissible banner
- On save: TanStack Query invalidates profile → dot disappears reactively
- `preferred_banca` options fetched from existing question data

## Components

### Badge — `src/components/Header.tsx`

```ts
const PROFILE_FIELDS = ['full_name', 'locale', 'university', 'age', 'graduation_year', 'preferred_banca'] as const;
const isProfileIncomplete = (profile: UserProfile) =>
  PROFILE_FIELDS.some(f => profile[f] == null || profile[f] === '');
```

Red dot on avatar:
```tsx
<div className="relative cursor-pointer" onClick={() => setProfileOpen(true)}>
  <Avatar ... />
  {isProfileIncomplete(profile) && (
    <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
  )}
</div>
```

### Form Modal — `src/components/modals/ProfileCompletionModal.tsx`

- Uses existing `Dialog` (Radix UI)
- Pre-fills all fields from current profile on open
- Single "Salvar" button → `supabase.from('user_profiles').update(...)`
- Dismissible via × or outside click

### Persistence

```ts
const updateProfile = async (data: Partial<UserProfile>) => {
  const { error } = await supabase
    .from('user_profiles')
    .update(data)
    .eq('id', user.id);
  if (error) throw error;
  queryClient.invalidateQueries(['profile']);
};
```

## Decision Log

| Decision | Alternatives | Reason |
|---|---|---|
| Derive completeness client-side | `profile_complete` DB column | No migration, stays in sync automatically |
| Red dot on avatar only | Banner + dot | Minimal, non-intrusive |
| Dialog modal | Separate page, drawer | Consistent with `ReportDialog`, `BetaWelcomeModal` |
| `email` read-only | Editable | Email is owned by Supabase Auth |
| `university` from `colleges.ts` | Free text | Data already exists in the project |
