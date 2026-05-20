# Dream Tracker - Project Instructions

> **Language note**: The app UI is in English. Communicate with the owner in Czech.

## What is this?
Personal development app: **Dreams** (life visions) → **Goals** → **Habits** (daily tracking) → **Rewards** (CS:GO-style roulette on habit completion). Migrated from Express.js + Neon to Supabase + Vercel.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Supabase (Auth, PostgreSQL, Storage) — NO server
- **Routing**: wouter (NOT react-router)
- **State**: TanStack React Query v5 + direct Supabase calls
- **Forms**: react-hook-form + zod
- **Hosting**: Vercel → https://dream-tracker-ochre.vercel.app
- **Images**: Unsplash API (client-side) → Supabase Storage upload

## Architecture
- All DB calls: React → Supabase JS client (no backend)
- RLS on every table (user_id isolation)
- snake_case DB columns = TypeScript types
- Auth: username-only registration (`@dreamtracker.app` auto-appended for Supabase email auth)
- Supabase free tier auto-pauses after 7 days inactivity

## Data Model
```
dreams (id, user_id, name, image, positive_motivation, negative_motivation, progress, created_at)
  └── goals (id, dream_id, parent_goal_id, name, image, progress, final_count, unit, created_at)
        ├── habits (id, user_id, goal_id, name, unit, frequency, target_value, current_value, color,
        │           positive_motivation, negative_motivation, image, created_at)
        │     └── habit_progress (id, habit_id, user_id, date, value)
        └── rewards (id, user_id, habit_chances, name, image, available, created_at)
                    habit_chances = JSON: { habitId: chancePercent }
```

## Project Structure
```
src/
  App.tsx                       # wouter Switch/Route/ProtectedRoute
  index.css                     # Tailwind + :root CSS vars (CRITICAL)
  pages/
    auth-page.tsx               # Login/Register (custom tab switcher)
    home-page.tsx               # Dashboard
    dreams-page.tsx             # Dreams CRUD
    goals-page.tsx              # Goals CRUD (subgoals via parent_goal_id)
    habits-page.tsx             # 30-day progress grid (~550 lines)
    rewards-page.tsx            # Rewards + preset rewards (~400 lines)
    stash-page.tsx              # Won rewards collection
  components/
    layouts/main-layout.tsx     # Sidebar navigation
    habits/habit-form.tsx       # Habit form (~580 lines)
    images/image-gallery.tsx    # Unsplash + Storage upload
    ui/                         # shadcn/ui (40+ components)
  hooks/
    use-auth.tsx                # Auth context
    use-toast.ts                # Toasts
    use-mobile.tsx              # Mobile breakpoint
  lib/
    supabase.ts                 # Client init
    queryClient.ts              # React Query client
    protected-route.tsx         # Auth guard
    utils.ts                    # cn() utility
shared/
  schema.ts                     # TypeScript types
```

## Key Behaviors
1. **Reward Roulette**: Meeting daily habit target → CS:GO case animation → reward `available` count++
2. **30-day Grid**: Clickable day cells, upsert to habit_progress
3. **Image Gallery**: Unsplash search → upload to Supabase Storage → save public URL
4. **Habit Chances**: reward.habit_chances JSON maps habit IDs to win percentages
5. **No reward**: App has built-in "No reward" option — remaining % goes there automatically

## Status (May 2025)
### Done
- [x] Auth, Dreams/Goals/Habits/Rewards CRUD
- [x] 30-day habit tracking grid
- [x] Reward roulette animation
- [x] Image gallery (Unsplash + Storage)
- [x] Deployed to Vercel
- [x] Demo data (Fit Body dream, 30h training goal, Workout habit, 3 rewards)
- [x] Mobile layout: hamburger menu, fix overlapping header
- [x] Mobile: Rewards buttons stack vertically
- [x] Mobile: Habits sticky name column + scrollable date grid
- [x] Email-based auth (replaced username trick, backward compat for old accounts)
- [x] Demo data auto-seed on registration (src/lib/seed-demo-data.ts)

### TODO
- [ ] Dashboard: show today's habits for quick entry (must trigger reward animation)
- [ ] Onboarding wizard: guided tour on demo data, then "Delete demo data" button
  - Future: add `is_demo` boolean column to dreams/goals/habits/rewards tables
  - Button deletes only rows where is_demo=true, then hides itself
- [ ] Google SSO login
- [ ] Persistent session (auto-login)
- [ ] Progress cascade: Habit → Goal → Dream
- [ ] i18n (multi-language support)
- [ ] Push notifications with motivational images
- [ ] Calendar integration
- [ ] Android via Capacitor
- [ ] Android home screen habits widget
- [ ] AI body transformation image generator

## GitHub
Repo: https://github.com/BalharZ/Dream_tracker (main branch)

## Gotchas
- **CSS vars in index.css**: If `:root` block is lost, all backgrounds go transparent
- **wouter**: Use `<Route>` + `<Switch>`, NOT react-router's `<Routes>`/`<BrowserRouter>`
- **No dark mode** (only light theme vars defined)
- **Supabase pause**: Resume at supabase.com/dashboard if connection errors appear
- **Demo user**: demo / demo123456 (email: demo@dreamtracker.app)
