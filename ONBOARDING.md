# Dream Tracker - Project Instructions

## What is this?
A personal development app where users define **Dreams** (life visions), break them into **Goals**, attach daily **Habits**, and earn **Rewards** via a CS:GO-style roulette animation when habits are completed. Originally built on Replit with Express.js + Neon PostgreSQL, now migrated to Supabase + Vercel.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: Supabase (Auth, PostgreSQL, Storage) - NO Express server
- **Routing**: wouter (lightweight, NOT react-router)
- **State**: TanStack React Query v5 + Supabase client calls (NO Drizzle ORM)
- **Forms**: react-hook-form + zod
- **Hosting**: Vercel (web), future: Capacitor (Android/iOS)
- **Image search**: Unsplash API (direct client-side calls)

## Key Architecture Decisions
- **No backend server** - all DB calls go directly from React to Supabase via `@supabase/supabase-js`
- **Row Level Security (RLS)** - every table has RLS policies so users only see their own data
- **snake_case columns** - DB columns are snake_case, TypeScript types match exactly (no camelCase conversion)
- **Auth trick**: Username-only registration - `@dreamtracker.app` is auto-appended to create email for Supabase Auth
- **Supabase free tier**: Project auto-pauses after 7 days inactivity, must be resumed manually at supabase.com

## Data Model (Supabase PostgreSQL)
```
dreams (id, user_id, name, image, positive_motivation, negative_motivation, progress, created_at)
  |
  +-- goals (id, dream_id, parent_goal_id, name, image, progress, final_count, unit, created_at)
        |  parent_goal_id -> self-referencing for subgoals
        |
        +-- habits (id, user_id, goal_id, name, unit, frequency, target_value, current_value, color, 
        |           positive_motivation, negative_motivation, image, created_at)
        |     |
        |     +-- habit_progress (id, habit_id, user_id, date, value)
        |
        +-- rewards (id, user_id, habit_chances, name, image, available, created_at)
                    habit_chances = JSON string mapping habit IDs to roulette chances
```

## Project Structure
```
src/
  App.tsx                          # Router (wouter Switch/Route/ProtectedRoute)
  index.css                        # Tailwind + CSS custom properties (CRITICAL - all colors defined here)
  pages/
    auth-page.tsx                  # Login/Register with custom tab switcher
    home-page.tsx                  # Dashboard
    dreams-page.tsx                # Dreams CRUD
    goals-page.tsx                 # Goals CRUD  
    habits-page.tsx                # Habits with 30-day progress grid (~550 lines)
    rewards-page.tsx               # Rewards CRUD with preset rewards (~400 lines)
    stash-page.tsx                 # Won rewards collection
  components/
    layouts/main-layout.tsx        # Sidebar navigation layout
    habits/habit-form.tsx          # Habit create/edit form (~580 lines)
    images/image-gallery.tsx       # Unsplash search + Supabase Storage upload
    ui/                            # shadcn/ui components (40+ files)
  hooks/
    use-auth.tsx                   # Supabase Auth context (login, register, logout, user state)
    use-toast.ts                   # Toast notifications
    use-mobile.tsx                 # Mobile breakpoint detection
  lib/
    supabase.ts                    # Supabase client init
    queryClient.ts                 # TanStack Query client
    protected-route.tsx            # Auth-guarded route wrapper
    utils.ts                       # cn() classname merge utility
shared/
  schema.ts                        # TypeScript types (Dream, Goal, Habit, HabitProgress, Reward)
```

## Environment Variables (.env.local)
```
VITE_SUPABASE_URL=https://cqhggjhidxmtmnunhzjx.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase anon key>
VITE_UNSPLASH_ACCESS_KEY=<unsplash key>
```

## Supabase Storage
- Bucket: `images` (public read, authenticated write)
- Used for: dream/goal/habit/reward images uploaded via Unsplash gallery

## Key Behaviors
1. **Reward Roulette**: When a user meets their daily habit target_value, a CS:GO case-opening animation plays, spinning through rewards and landing on one. The reward's `available` count increments.
2. **30-day Habit Grid**: Each habit shows a grid of the last 30 days. Clicking a day cell lets users input their progress value for that date (upsert to habit_progress).
3. **Image Gallery**: Users search Unsplash, select an image, it gets uploaded to Supabase Storage, and the public URL is saved to the record.
4. **Habit Chances**: Each reward has a `habit_chances` JSON field mapping habit IDs to percentage chances of winning that reward in the roulette.

## Common Patterns
- **Data fetching**: `useQuery` with async function calling `supabase.from('table').select()...`
- **Mutations**: `useMutation` with `supabase.from('table').insert/update/delete()` + `queryClient.invalidateQueries()`
- **Auth guard**: `ProtectedRoute` component checks auth state, redirects to `/auth` if not logged in
- **User filtering**: RLS handles it automatically, but queries still filter by `user_id` for clarity

## Current Status (May 2025)
- [x] Auth (login/register) working
- [x] Dreams CRUD
- [x] Goals CRUD (with subgoals)
- [x] Habits CRUD with 30-day progress tracking
- [x] Rewards CRUD with preset rewards
- [x] Image gallery (Unsplash + Supabase Storage)
- [x] Reward roulette animation
- [x] UI polish (overlay fix, CSS variables, select cleanup)
- [ ] Deploy to Vercel
- [ ] Dashboard redesign (show today's habits for quick entry)
- [ ] Mobile hamburger menu (Android-style)
- [ ] Progress cascade (Habit completion -> Goal -> Dream progress)
- [ ] Push notifications with motivational images
- [ ] Calendar integration
- [ ] Android app via Capacitor
- [ ] Android home screen widget for habits
- [ ] AI body transformation image generator (motivational)

## GitHub
- Repo: https://github.com/BalharZ/Dream_tracker
- Branch: main

## Gotchas
- **CSS variables are critical**: If `src/index.css` loses the `:root` block, ALL backgrounds become transparent (shadcn/ui uses `hsl(var(--background))` etc.)
- **wouter, not react-router**: Use `<Route path="...">` and `<Switch>`, NOT `<Routes>` or `<BrowserRouter>`
- **No dark mode**: Only light theme CSS variables are defined
- **Supabase pause**: Free tier pauses after 7 days. If app shows connection errors, resume project at supabase.com/dashboard
- **form_input browser tool**: React hook form doesn't detect values set via DOM manipulation - use Supabase client directly for testing
- **User language**: The app owner communicates in Czech
