# Enterprise AI Agent Platform — Implementation Plan

> **Simplified Nexus roadmap:** See the newly added "Nexus — Internal-Pilot Development Roadmap" section at the end of this document. It supersedes the phase sequence below for the initial Nexus pilot while retaining the detailed implementation notes as reference.

**Goal:** Build a single-tenant web platform for one company to create, configure, and deploy Claude AI agents — with an admin layer for governance and an end-user missions layer where employees brief an agent and receive a structured output.

**Architecture:** Next.js App Router for SSR/RSC, Supabase for auth + Postgres with Row Level Security, and server-side API routes that proxy all Anthropic and Pipedream API calls so credentials never reach the client.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Tailwind CSS v4, Shadcn UI (base-nova / `@base-ui/react`), Supabase (Auth + Postgres + RLS + Storage), Anthropic SDK, Pipedream SDK (`@pipedream/sdk`), Vercel

> **base-nova breaking changes (read before writing any UI code):**
> - `SidebarMenuButton` uses `render` prop — NOT `asChild`. Use `render={<Link href="..." />}`.
> - `Button asChild` is **not supported**. Use `<Link className={cn(buttonVariants({ variant, size }))}>` instead.
> - Route params in Next.js 16 are `Promise<{ id: string }>` — always `await params` before destructuring.

---

## Phases Overview

| Phase | Name | Outcome |
|-------|------|---------|
| 1 | Foundation | Next.js scaffold, Supabase auth, schema, RBAC, protected layout |
| 2 | Agent Management | Admin CRUD for agents (Supabase + Anthropic dual-write) |
| 2.5 | AI-Assisted Agent Creation | Company context store + "Generate with AI" on agent form |
| 3.5 | Google Drive Integration | Pipedream Connect OAuth for org-level Drive, admin integrations page |
| 4 | Agent Knowledge | Drive file picker + knowledge API; run-time file fetch (mounted as session resources) |
| 5 | Missions & Squad | Admin assigns agents to users; users brief agents via Kanban; runs use Managed Agents **Sessions** (Agent → Environment → Session → event stream) |
| 6 | Usage & Admin | Token cost tracking, admin user management, agent assignment UI |
| 7 | Profile & Company Settings | User profile (display name + avatar), admin company/brand page |

**Each phase ends with a STOP. Do not proceed to the next phase without explicit approval.**

**Phase ordering rationale:** Agent knowledge (Phase 4) must precede Missions (Phase 5) so the mission run route has the knowledge-fetch infrastructure available from day one. Mission runs use the full Managed Agents Sessions API — agents carry the toolset (Phase 2), a shared Environment is created once (Phase 5 setup), and pinned files are mounted into each session container.

---

## Phase 1: Foundation

### Architecture Decisions

1. **Project scaffold** — `create-next-app` with App Router, TypeScript strict mode, Tailwind. Shadcn UI installed via CLI so components live in `components/ui/` and are fully owned.

2. **Supabase auth** — Email/password only. Supabase handles sessions; the Next.js proxy (`proxy.ts`) reads the session cookie and redirects unauthenticated users.

3. **Single-tenant, no organizations table** — There is one company. All data is shared across users of that company. No `organization_id` columns. RLS policies are purely user-based (own data) or role-based (admins see everything).

4. **RBAC** — Two roles stored in a `profiles` table: `admin` and `user`. A Postgres function `get_my_role()` is used in all RLS policies. Admins see and manage all platform data; users see only their own data and permitted agents.

5. **Route layout** — Two route groups: `(auth)` for login/register (no sidebar), `(dashboard)` for all authenticated pages (sidebar). Middleware protects the dashboard group.

6. **Supabase clients** — Three client variants: browser (`createBrowserClient`), server component (`createServerClient` with cookie store), and proxy (`createServerClient` with cookie mutation). Follows the Supabase Next.js SSR pattern exactly.

### Directory Structure

```
orion-course/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    ← role-based redirect
│   │   ├── admin/
│   │   │   ├── agents/                 ← agent CRUD (Phase 2)
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── company/page.tsx        ← brand voice (Phase 7)
│   │   │   ├── integrations/page.tsx   ← org Drive connect (Phase 3.5)
│   │   │   └── users/                  ← user management (Phase 6)
│   │   │       └── [id]/page.tsx
│   │   ├── dashboard/page.tsx          ← profile settings (Phase 7)
│   │   ├── missions/                   ← Kanban mission board (Phase 5)
│   │   │   └── [id]/page.tsx
│   │   └── usage/page.tsx              ← token cost dashboard (Phase 6)
│   ├── actions/auth.ts
│   ├── api/
│   │   ├── admin/
│   │   │   ├── agents/[id]/knowledge/route.ts   ← Phase 4
│   │   │   ├── drive/files/route.ts             ← Phase 4
│   │   │   └── users/[id]/agents/
│   │   │       ├── route.ts                     ← Phase 6
│   │   │       └── [agentId]/route.ts           ← Phase 6
│   │   ├── agents/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   └── generate-prompt/route.ts
│   │   ├── auth/pipedream/route.ts              ← Phase 3.5
│   │   ├── missions/
│   │   │   ├── route.ts                         ← Phase 5
│   │   │   └── [id]/run/route.ts                ← Phase 5
│   │   └── profile/
│   │       ├── route.ts                         ← Phase 7
│   │       └── avatar/route.ts                  ← Phase 7
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                             ← shadcn primitives
│   ├── agents/
│   │   ├── agent-form.tsx
│   │   ├── agent-icon.tsx              ← two-tone role icons (Social/Marketing/Finance + fallback)
│   │   ├── agent-knowledge-editor.tsx  ← Phase 4
│   │   ├── agent-list.tsx
│   │   └── generate-prompt-dialog.tsx
│   ├── auth/auth-form.tsx
│   ├── missions/
│   │   ├── kanban-column.tsx           ← Phase 5
│   │   └── new-mission-dialog.tsx      ← Phase 5
│   ├── nav-icons.tsx                   ← two-tone SVG icons for all sidebar nav items
│   ├── settings/
│   │   ├── agent-environment-card.tsx  ← Phase 5 setup: create/show Anthropic environment
│   │   └── profile-form.tsx            ← Phase 7
│   ├── squad/agent-personalise-drawer.tsx  ← Phase 5
│   └── app-sidebar.tsx
├── lib/
│   ├── anthropic/client.ts
│   ├── drive/
│   │   ├── create-file.ts              ← Phase 5
│   │   └── read-file.ts               ← Phase 4
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── proxy.ts
│   ├── types/database.ts
│   └── usage.ts                       ← Phase 6
├── proxy.ts
└── supabase/migrations/
```

### Task 1.1 — Scaffold Next.js Project

```bash
npx create-next-app@latest . \
  --typescript --tailwind --eslint --app \
  --src-dir=false --import-alias="@/*" --no-git

npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk
npm install -D @types/node

npx shadcn@latest init --defaults
```

> `shadcn@latest` defaults to base-nova (Tailwind v4, `@base-ui/react`). Do not override to the old `default` style.

**Fix the circular font variable in `app/globals.css`:**

```css
/* BEFORE (broken) */
--font-sans: var(--font-sans);

/* AFTER (correct) */
--font-sans: var(--font-geist-sans);
```

**Install required Shadcn components:**

```bash
npx shadcn@latest add button input label card badge avatar dropdown-menu sheet separator skeleton textarea dialog select
npx shadcn@latest add sidebar-04
```

**`.env.local.example`:**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic
ANTHROPIC_API_KEY=your-anthropic-api-key

# Pipedream Connect
PIPEDREAM_PROJECT_ID=proj_xxxxxxxx
PIPEDREAM_CLIENT_ID=your-oauth-client-id
PIPEDREAM_CLIENT_SECRET=your-oauth-client-secret
PIPEDREAM_ENVIRONMENT=development

# App
NEXT_PUBLIC_APP_NAME=Orion
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Task 1.2 — Supabase Clients

**`lib/supabase/client.ts`** — browser client (for client components):

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

**`lib/supabase/server.ts`** — server client (for server components and route handlers):

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch { /* Server Component — mutations handled by proxy */ }
        },
      },
    }
  )
}
```

**`lib/supabase/proxy.ts`** — middleware session refresher:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isDashboardRoute = !isAuthRoute && !pathname.startsWith('/api') && pathname !== '/'

  if (!user && isDashboardRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/missions'
    return NextResponse.redirect(url)
  }
  return supabaseResponse
}
```

**`proxy.ts`** (root, Next.js middleware):

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

### Task 1.3 — Database Migration 001

**`supabase/migrations/001_foundation.sql`:**

```sql
create extension if not exists "uuid-ossp";

create type user_role as enum ('admin', 'user');

create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  role          user_role not null default 'user',
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

create or replace function get_my_role()
returns user_role language sql stable security definer as $$
  select role from profiles where id = auth.uid();
$$;

alter table profiles enable row level security;

create policy "Users can view all profiles"
  on profiles for select to authenticated using (true);

create policy "Users can update their own profile"
  on profiles for update using (id = auth.uid());

create policy "Admins can update any profile"
  on profiles for update using (get_my_role() = 'admin');

create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into profiles (id, role, display_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'user'),
    new.raw_user_meta_data->>'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

> **`avatar_url` is included here.** Including it in the foundation schema is cleaner than adding it in a later migration.
>
> **`set search_path = public`** on `handle_new_user` is required to prevent a Supabase security advisory warning. If you see advisory MFA warnings anyway, see migration 002.

Apply in Supabase SQL Editor. Then create and promote the first admin:

```sql
update profiles set role = 'admin'
where id = (select id from auth.users where email = 'your-admin@email.com');
```

### Task 1.4 — Auth Pages

**`app/actions/auth.ts`** — server actions for login, logout, register. On success, redirect to `/missions`.

**`components/auth/auth-form.tsx`** — shared login/register form using `Card`, `Input`, `Label`, `Button`. Calls `login` or `register` server actions.

**`app/(auth)/login/page.tsx`** and **`app/(auth)/register/page.tsx`** — each renders `<AuthForm mode="login|register" />`.

### Task 1.5 — Dashboard Layout & Sidebar

**`components/app-sidebar.tsx`** — client component using shadcn sidebar-04 (`variant="inset"`). Receives `role`, `displayName`, `avatarUrl`, `email` as props from the server layout.

**Sidebar nav (as-built):**

All nav icons are custom two-tone SVG components from `components/nav-icons.tsx` — no lucide icons:

```typescript
const mainNav = [
  { href: '/missions', label: 'Missions', icon: MissionsIcon },  // indigo bullseye
  { href: '/usage',    label: 'Usage',    icon: UsageIcon },     // blue area chart
]

const adminNav = [
  { href: '/admin/agents',       label: 'Agents',       icon: AgentsIcon },       // purple CPU chip
  { href: '/admin/company',      label: 'Company',      icon: CompanyIcon },      // slate building
  { href: '/admin/users',        label: 'Users',        icon: UsersIcon },        // teal people
  { href: '/admin/integrations', label: 'Integrations', icon: IntegrationsIcon }, // orange nodes
  { href: '/usage',              label: 'Usage',        icon: UsageIcon },
]
```

The footer Settings link uses `SettingsIcon` (slate gear). My Squad entries use `AgentIcon` from `components/agents/agent-icon.tsx`, which maps agent names to role-specific two-tone icons (violet speech bubbles for Social, amber megaphone for Marketing, teal coin for Finance) with a `Bot` fallback for unrecognised roles.

Squad members (from `user_agents`) render between main nav and admin nav in a "My Squad" group. Each entry opens an `AgentPersonaliseDrawer` on click (not a Link — no navigation).

Footer: user avatar + name + role label, Settings link → `/dashboard`, Sign out button.

> **`SidebarMenuButton` pattern:** Always use the `render` prop for links and buttons:
> - Link: `render={<Link href="..." />}`
> - Button: `render={<button type="button" />}` or `render={<button type="submit" />}`

**`app/(dashboard)/layout.tsx`** — server component. Fetches user + profile, passes to `<AppSidebar>`. Wraps in `<SidebarProvider>` + `<SidebarInset>`.

**`app/(dashboard)/page.tsx`** — root redirect: admins → `/admin/agents`, users → `/missions`.

### Phase 1 Testing Checklist

- [ ] `npm run dev` starts without errors
- [ ] `npx tsc --noEmit` passes
- [ ] `/register` creates a `profiles` row with `role = 'user'`
- [ ] Admin redirects to `/admin/agents` on login; user redirects to `/missions`
- [ ] Unauthenticated visit to `/missions` redirects to `/login`
- [ ] Sign out clears session and redirects to `/login`

---

**STOP — Wait for approval before proceeding to Phase 2.**

---

## Phase 2: Agent Management

### Architecture Decisions

1. **Dual-write pattern** — When an admin creates/edits an agent, write to both the Supabase `agents` table and the Claude Managed Agents API (`anthropic.beta.agents.create`/`update`). Supabase is the source of truth; `claude_agent_id` links the two. The Anthropic agent is what mission runs reference when creating a Session (Phase 5).

   **Always include the toolset** on create and update so sessions can read mounted knowledge files, run bash, and search the web:
   ```ts
   tools: [{ type: 'agent_toolset_20260401', default_config: { enabled: true } }]
   ```
   (Agents created before this was added must be re-saved once to backfill the toolset onto their Anthropic agent version.)

2. **Server-side API routes** — All Anthropic API calls happen in `/api/agents/*`. The `ANTHROPIC_API_KEY` never reaches the client.

3. **Admin-only agent routes** — Route handlers verify `role = 'admin'` via a shared `requireAdmin()` helper before any mutation.

### Migration 002 — Fix handle_new_user search_path (if needed)

```sql
-- supabase/migrations/002_fix_handle_new_user_search_path.sql
-- Only needed if 001 did not include "set search_path = public" on handle_new_user.
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into profiles (id, role, display_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'user'),
    new.raw_user_meta_data->>'display_name'
  );
  return new;
end;
$$;
```

### Migration 003 — Agents

```sql
-- supabase/migrations/003_agents.sql

create table agents (
  id                   uuid primary key default uuid_generate_v4(),
  claude_agent_id      text unique,
  name                 text not null,
  description          text,
  system_prompt        text,
  model                text not null default 'claude-sonnet-4-6',
  is_active            boolean not null default true,
  default_output_type  text check (default_output_type in ('doc', 'sheet', 'text')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table agents enable row level security;

create policy "Authenticated users can view active agents"
  on agents for select to authenticated using (is_active = true);

create policy "Admins can insert agents"
  on agents for insert with check (get_my_role() = 'admin');

create policy "Admins can update agents"
  on agents for update using (get_my_role() = 'admin');

create policy "Admins can delete agents"
  on agents for delete using (get_my_role() = 'admin');

create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger agents_updated_at
  before update on agents
  for each row execute procedure update_updated_at_column();
```

> **`default_output_type`:** Informational only — not used to auto-select the mission output type. That is always user-chosen in the New Mission dialog.

### Task 2.1 — Anthropic Client

**`lib/anthropic/client.ts`:**

```typescript
import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      defaultHeaders: { 'anthropic-beta': 'managed-agents-2026-04-01' },
    })
  }
  return client
}
```

### Task 2.2 — Agent API Routes

**`lib/api-helpers.ts`** — shared admin guard:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase: null }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin')
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), supabase: null }

  return { error: null, supabase }
}
```

**`app/api/agents/route.ts`** — `GET` lists all agents (admin only), `POST` creates (dual-writes to Anthropic + Supabase).

**`app/api/agents/[id]/route.ts`** — `PATCH` updates (dual-write), `DELETE` soft-deletes (`is_active = false`) and archives in Anthropic.

### Task 2.3 — Agent Admin UI

**`app/(dashboard)/admin/agents/page.tsx`** — server component fetching agents, rendering `<AgentList>` and a "New Agent" link.

**`app/(dashboard)/admin/agents/[id]/page.tsx`** — server component fetching agent + Drive connection status, rendering `<AgentForm mode="edit">` in a 2-column layout (left: name/description/model/knowledge, right: system prompt with Edit/Preview tabs).

**`components/agents/agent-form.tsx`** — client component. Controls `systemPrompt` state. Includes:
- Name, description (uncontrolled FormData)
- Model `<select>`
- System prompt: controlled `<Textarea>` with Edit/Preview tabs and "Generate with AI" button
- `<AgentKnowledgeEditor agentId driveConnected />` below model (added in Phase 4)

**`components/agents/agent-list.tsx`** — card grid with Edit link and Archive button per agent.

### Phase 2 Testing Checklist

- [ ] "New Agent" creates a row in `agents` with `claude_agent_id` set
- [ ] Edit agent saves to both Supabase and Anthropic API
- [ ] Archive → `is_active = false`, hidden from users
- [ ] Non-admin `POST /api/agents` returns 403
- [ ] `npx tsc --noEmit` passes

---

**STOP — Wait for approval before proceeding to Phase 2.5.**

---

## Phase 2.5: AI-Assisted Agent Creation

### Architecture Decisions

1. **Company context store** — A singleton `company_settings` table holds brand guidelines and tone of voice. Admins paste this once; all prompt generation calls pull from it.

2. **Generate Prompt API** — `POST /api/agents/generate-prompt` (admin-only). Fetches company context, combines with user-supplied role + tasks, calls Claude, returns `{ system_prompt }`.

3. **Controlled system_prompt** — The `system_prompt` textarea is a controlled React state field (not FormData) so the "Generate with AI" callback can populate it.

### Migration 010 — Company Settings

```sql
-- supabase/migrations/010_company_settings.sql

create table company_settings (
  id              uuid primary key default gen_random_uuid(),
  company_context text,
  updated_at      timestamptz not null default now()
);

alter table company_settings enable row level security;

-- Admins can manage all columns
create policy "Admins manage company settings"
  on company_settings for all
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

-- All authenticated users can SELECT (needed for brand context injection in mission runs)
create policy "All users can view company settings"
  on company_settings for select
  to authenticated using (true);

create trigger company_settings_updated_at
  before update on company_settings
  for each row execute procedure update_updated_at_column();

-- Seed singleton row
insert into company_settings (company_context) values (null);
```

### Task 2.5.1 — Company Settings API

**`app/api/settings/company/route.ts`** — `GET` returns `{ company_context }`, `PATCH` updates it. Both admin-only. Uses `.not('id', 'is', null)` to target the singleton row on update.

### Task 2.5.2 — Generate Prompt API

**`app/api/agents/generate-prompt/route.ts`** — requires `role` and `tasks` in body. Fetches company context, injects it verbatim into the meta-prompt (never paraphrased), calls `anthropic.messages.create` with `claude-sonnet-4-6`, returns the system prompt. Records usage fire-and-forget.

### Task 2.5.3 — GeneratePromptDialog

**`components/agents/generate-prompt-dialog.tsx`** — client dialog component. Props: `open`, `onOpenChange`, `onGenerated(systemPrompt)`, `hasCompanyContext`. Shows amber warning when no company context is configured. Resets fields on close.

### Task 2.5.4 — System Prompt Preview

The `AgentForm` system prompt area has Edit / Preview tabs. Preview renders the markdown via `react-markdown`. Install:

```bash
npm install react-markdown @tailwindcss/typography
```

Add to `app/globals.css`:

```css
@plugin "@tailwindcss/typography";
```

### Phase 2.5 Testing Checklist

- [ ] Generate with AI → spinner → system prompt textarea populated
- [ ] Company context injected verbatim into generated prompt
- [ ] Amber warning shown when no company context saved
- [ ] `POST /api/agents/generate-prompt` by non-admin returns 403

---

**STOP — Wait for approval before proceeding to Phase 3.5.**

---

## Phase 3.5: Google Drive Integration (Pipedream)

### Architecture Decisions

1. **Org-level, not per-user** — A single admin connects the company's Google Drive. Credentials are stored on `company_settings`, not `profiles`. All Drive reads (knowledge injection) and writes (output files) use this one connection.

2. **Pipedream Connect** — Handles Google OAuth. Uses the Pipedream SDK for token exchange, account lookup, and API proxying. The SDK client is created server-side only.

3. **Pipedream SDK proxy** — All Google API calls go through `pd.proxy.get()`/`pd.proxy.post()`. This keeps Google tokens in Pipedream; the app never sees them directly. The account is identified by `externalUserId` (the admin's Supabase user ID) and `accountId` (Pipedream account ID, stored in `company_settings`).

4. **Binary downloads** — Passing `headers: { Accept: 'application/octet-stream' }` (or any non-JSON Accept) to `pd.proxy.get()` causes the Pipedream SDK to return a `BinaryResponse` object (with `.arrayBuffer()`) instead of parsing as JSON. This is the mechanism used for `.docx`, `.pdf`, `.txt`, `.csv` downloads (fully implemented in Phase 4).

### New env vars

```env
PIPEDREAM_PROJECT_ID=proj_xxxxxxxx
PIPEDREAM_CLIENT_ID=your-oauth-client-id
PIPEDREAM_CLIENT_SECRET=your-oauth-client-secret
PIPEDREAM_ENVIRONMENT=development
```

### Migration 004 — Pipedream columns on Profiles (legacy)

```sql
-- supabase/migrations/004_google_integration.sql
alter table profiles
  add column if not exists pipedream_vault_id   text,
  add column if not exists pipedream_account_id text;
```

> These columns were added for an earlier per-user Drive model. They are retained in the schema but not used. The org-level columns live on `company_settings` and are added in migration `015`.

### Migration 015 — Org Drive on Company Settings + Agent Knowledge

```sql
-- supabase/migrations/015_org_drive_agent_knowledge.sql

-- Org Drive credentials on company_settings
alter table company_settings
  add column if not exists pipedream_account_id   text,
  add column if not exists pipedream_vault_id     text,
  add column if not exists pipedream_connected_by uuid references auth.users(id) on delete set null;

-- Agent knowledge: admin-pinned Drive files per agent
create table agent_knowledge (
  id             uuid        primary key default gen_random_uuid(),
  agent_id       uuid        not null references agents(id) on delete cascade,
  file_id        text        not null,
  file_name      text        not null,
  file_mime_type text        not null,
  created_at     timestamptz not null default now(),
  unique(agent_id, file_id)
);

alter table agent_knowledge enable row level security;

-- All authenticated users can read (mission runs need this to inject knowledge)
create policy "authenticated_read_agent_knowledge"
  on agent_knowledge for select
  to authenticated using (true);

-- Admins can manage (insert / update / delete)
create policy "admin_manage_agent_knowledge"
  on agent_knowledge for all
  to authenticated
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');
```

> **Why `agent_knowledge` is in this migration:** The table depends on the org Drive connection being in place. Grouping them makes the dependency explicit.

### Pipedream client helper (server-side only)

```typescript
import { PipedreamClient } from '@pipedream/sdk/server'

function makePipedreamClient() {
  return new PipedreamClient({
    projectId: process.env.PIPEDREAM_PROJECT_ID!,
    clientId: process.env.PIPEDREAM_CLIENT_ID!,
    clientSecret: process.env.PIPEDREAM_CLIENT_SECRET!,
    projectEnvironment: (process.env.PIPEDREAM_ENVIRONMENT ?? 'development') as 'development' | 'production',
  })
}
```

Install: `npm install @pipedream/sdk`

### Task 3.5.1 — Pipedream Connect Route

**`app/api/auth/pipedream/route.ts`:**

- `GET` — Creates a Pipedream Connect token and returns a connect URL for the admin to initiate OAuth.
- `POST` — Called after OAuth completes. Calls `pd.getAccounts({ externalUserId, app: 'google_drive' })` to look up the newly created account (Pipedream does NOT deliver `account_id` in the redirect URL), then saves `pipedream_account_id` + `pipedream_connected_by` to `company_settings`.
- `DELETE` — Calls `pd.accounts.delete({ id: accountId, externalUserId })`, nulls out `company_settings` columns.

### Task 3.5.2 — Admin Integrations Page

**`app/(dashboard)/admin/integrations/page.tsx`** — server component. Fetches `company_settings` to determine connection status. Shows a Connect / Disconnect card for Google Drive.

The connect flow uses the Pipedream browser SDK (`createFrontendClient` from `@pipedream/sdk/browser`) with a token callback to initiate the OAuth popup.

### Phase 3.5 Testing Checklist

- [ ] Admin → Integrations → Connect Google Drive → completes OAuth
- [ ] `company_settings.pipedream_account_id` and `pipedream_connected_by` set after connect
- [ ] Disconnect clears those columns and deletes the Pipedream account
- [ ] Non-admin cannot access `/admin/integrations`

---

**STOP — Wait for approval before proceeding to Phase 4.**

---

## Phase 4: Agent Knowledge

> **Run-path note (see Phase 5):** mission runs use Managed Agents Sessions, so pinned files are **mounted into the session container** at run time. Each file is **extracted to plain text server-side** with `readDriveFile()` (Google Doc/Sheet via API, `.docx` via mammoth, `.pdf` via pdf2json, txt/csv as-is) and uploaded to the Files API as a `<name>.txt`, then mounted. The agent reads the `.txt` with its `read` tool. **Why text, not raw bytes:** the container's native `read` tool returns empty for some PDFs and cannot read `.docx` at all — uploading pre-extracted text guarantees every format is accessible. So the `agent_knowledge` table, the admin file-picker, **and** the `mammoth`/`pdf2json` extractors in `readDriveFile` are all live (not legacy).

### Architecture Decisions

1. **No copies in Supabase** — Only the `file_id`, `file_name`, and `file_mime_type` are stored in `agent_knowledge`; the file bytes are fetched fresh from Drive each time a mission runs. This avoids stale copies and keeps storage simple.

2. **Supported formats and their parsers:**

| File type | MIME type | Extraction method |
|-----------|-----------|------------------|
| Google Doc | `application/vnd.google-apps.document` | Google Docs API v1 — body content blocks |
| Google Sheet | `application/vnd.google-apps.spreadsheet` | Google Sheets API — range values |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Pipedream binary download → `mammoth.extractRawText()` |
| `.pdf` | `application/pdf` | Pipedream binary download → `pdf2json` PDFParser |
| `.txt` / `.csv` | `text/plain`, `text/csv` | Pipedream binary download → `Buffer.toString('utf-8')` |
| `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Placeholder — admin prompted to convert to Google Sheet |

3. **Pipedream binary download** — Passing a non-JSON `Accept` header to `pd.proxy.get()` causes the SDK to return a `BinaryResponse` object instead of trying to JSON-parse the response:

```typescript
type BinaryResponse = { arrayBuffer: () => Promise<ArrayBuffer> }

const binary = await pd.proxy.get({
  url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
  externalUserId: userId,
  accountId,
  headers: { Accept: 'application/octet-stream' },  // triggers binary mode
}) as unknown as BinaryResponse

const buffer = Buffer.from(await binary.arrayBuffer())
```

4. **Error resilience** — `readDriveFile()` catches all errors per file and returns a `(Could not read file content: ...)` string rather than throwing, so a single unreadable file doesn't abort the entire mission.

5. **PDF parser choice** — Use `pdf2json`. Do NOT use `pdf-parse` (either v1 or v2): v2 fails in Next.js due to pdfjs worker bundling; v1 has a tokenizer bug with certain PDFs.

### Dependencies to Install

```bash
npm install mammoth pdf2json
```

### Task 4.1 — Drive File Listing API

**`app/api/admin/drive/files/route.ts`** — admin-only. Calls Google Drive `files.list` via Pipedream proxy using org credentials from `company_settings`. Returns files sorted by `modifiedTime desc`. Supports pagination via `nextPageToken` query param.

**File type filter (`q` param):**

```
(mimeType='application/vnd.google-apps.document' or
 mimeType='application/vnd.google-apps.spreadsheet' or
 mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or
 mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or
 mimeType='application/pdf' or
 mimeType='text/plain' or
 mimeType='text/csv') and trashed = false
```

Also pass: `includeItemsFromAllDrives=true`, `supportsAllDrives=true`.

### Task 4.2 — Agent Knowledge API

**`app/api/admin/agents/[id]/knowledge/route.ts`:**

- `GET` — returns `{ files: AgentKnowledgeFile[] }` from `agent_knowledge` table
- `PUT` — replaces all knowledge files for the agent (delete existing + insert new batch). Body: `{ files: [{ file_id, file_name, file_mime_type }] }`

### Task 4.3 — Drive File Reader

**`lib/drive/read-file.ts`** — server-side only. Called at mission run time for each pinned file:

```typescript
export async function readDriveFile({
  fileId, mimeType, userId, accountId
}: { fileId: string; mimeType: string; userId: string; accountId: string }): Promise<string>
```

Implementation by type:

```typescript
// Google Doc
if (mimeType === 'application/vnd.google-apps.document') {
  const doc = await pd.proxy.get({ url: `https://docs.googleapis.com/v1/documents/${fileId}`, ... })
  return extractDocText(doc)  // walks body.content[].paragraph.elements[].textRun.content
}

// Google Sheet
if (mimeType === 'application/vnd.google-apps.spreadsheet') {
  const data = await pd.proxy.get({ url: `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/Sheet1!A1:Z1000`, ... })
  return data.values?.map(row => row.join('\t')).join('\n') ?? '(empty sheet)'
}

// DOCX
if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
  const buffer = await downloadAsBuffer(pd, fileId, userId, accountId)
  const result = await mammoth.extractRawText({ buffer })
  return result.value.trim() || '(empty document)'
}

// PDF — use pdf2json, NOT pdf-parse
if (mimeType === 'application/pdf') {
  const buffer = await downloadAsBuffer(pd, fileId, userId, accountId, 'application/pdf')
  const PDFParser = (await import('pdf2json')).default
  const text = await new Promise<string>((resolve, reject) => {
    const parser = new PDFParser(null, true)
    parser.on('pdfParser_dataReady', () => resolve(parser.getRawTextContent()))
    parser.on('pdfParser_dataError', (e: { parserError: Error } | Error) => {
      reject(e instanceof Error ? e : e.parserError)
    })
    parser.parseBuffer(buffer)
  })
  return text.trim() || '(empty PDF)'
}

// txt / csv
if (mimeType === 'text/plain' || mimeType === 'text/csv') {
  const buffer = await downloadAsBuffer(pd, fileId, userId, accountId, 'text/plain')
  return buffer.toString('utf-8').trim()
}

// xlsx — not parseable, tell admin to convert
if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  return '(Excel file — convert to a native Google Sheet in Drive so its content can be read by the agent)'
}

return `(File type "${mimeType}" is not supported — skipped)`
```

Wrap the entire function body in `try/catch` returning `(Could not read file content: ${e.message})`.

### Task 4.4 — Agent Knowledge Editor

**`components/agents/agent-knowledge-editor.tsx`** — client component rendered in the agent edit page below the Model selector.

Features:
- Loads Drive files from `/api/admin/drive/files` and existing pinned files from `/api/admin/agents/[id]/knowledge` in parallel on mount
- Search input for client-side filtering by filename
- Scrollable list (`max-h-72 overflow-y-auto`) with checkbox per file
- File type icons: Google Doc/DOCX (blue), Sheet/CSV (green), PDF/other (orange)
- Toggle auto-saves via `PUT /api/admin/agents/[id]/knowledge` (optimistic update)
- "Load more" button when `nextPageToken` exists in Drive file list response
- When Drive is not connected: shows a message linking to Admin → Integrations

### Phase 4 Testing Checklist

- [ ] Drive connected → agent edit page shows file picker with Drive files
- [ ] Search filters the file list client-side
- [ ] Checking a file → auto-saves → reloading page shows file still checked
- [ ] Unchecking removes it from `agent_knowledge`
- [ ] Drive not connected → picker shows "Connect Drive under Admin → Integrations"
- [ ] `GET /api/admin/drive/files` by non-admin returns 403
- [ ] `readDriveFile` returns extracted text for: Google Doc, DOCX, PDF, txt
- [ ] `readDriveFile` returns placeholder for xlsx
- [ ] `readDriveFile` returns error string (does not throw) for unreadable files
- [ ] `npx tsc --noEmit` passes

---

**STOP — Wait for approval before proceeding to Phase 5.**

---

## Phase 5: Missions & Squad

### Architecture Decisions

1. **Agent-first workflow** — Users pick an agent from their squad, write a brief, select an output type (Google Doc, Google Sheet), and submit. The platform runs the mission synchronously and delivers the result.

2. **Squad system** — Admins assign agents to users via `user_agents`. The sidebar shows assigned agents as clickable entries that open a personalisation drawer (custom instructions per agent).

3. **Mission run uses the Managed Agents Sessions API** — The run route follows the full **Agent → Environment → Session → event stream** flow (`anthropic.beta.sessions.*`), NOT `messages.create`. Each run creates an inspectable Session in the Console, tied to the agent's `claude_agent_id`, running in the org's shared Environment (`company_settings.anthropic_environment_id`). The agent's system prompt lives on the agent object; per-run context (brand voice, user custom instructions, output format, the brief) is sent as the first `user.message`.

4. **Knowledge mounted as session resources (as text)** — Each pinned `agent_knowledge` file is extracted to plain text with `readDriveFile()`, uploaded to the Files API as `<name>.txt`, and mounted into the session container. The agent reads the `.txt` with its `read` tool. Text (not raw bytes) is used because the container's native `read` returns empty for some PDFs and can't read `.docx`. **The agent must be told the resolved mount paths** — the API re-roots the requested `mount_path` under `/mnt/session/uploads/`, so read the actual paths back from `session.resources[].mount_path` (file resources) and list them in the kickoff message.

5. **Agents carry the toolset** — For a session to read mounted files (and run bash / search the web), the agent must be created/updated with `tools: [{ type: 'agent_toolset_20260401', default_config: { enabled: true } }]` (Phase 2). Agents created before this was added must be re-saved once to backfill the toolset.

6. **Output files** — When `output_type` is `doc`, `sheet`, or `pdf`, the route calls `createDriveFile(content)` which creates the file **and writes the body**: a Doc gets the agent's text via Docs `documents/{id}:batchUpdate` (`insertText` at index 1); a Sheet gets the rows via Sheets `values:batchUpdate` (the agent is told to emit tab-separated values, parsed into a 2D array). **`pdf` is a Google Doc under the hood** — created and populated exactly like `doc`, but its `output_url` points at Drive's export endpoint (`.../document/d/{id}/export?format=pdf`) instead of the edit link, so opening it serves a PDF directly with no separate binary upload step. Body-population failures are non-fatal — the file/URL still returns and `output_text` holds the content as a fallback. Falls back entirely to `output_text` if file creation fails. Sessions are **not archived** after a run, so they remain inspectable in the Console.

7. **No Vaults / no MCP** — Drive stays host-side via Pipedream. Per the docs, Vaults hold only MCP credentials; with no MCP server there are none. Sessions + Environments appear in the Console; Vaults stay empty by design.

8. **Kanban board** — Three columns: QUEUED (`needs_attention`), IN PROGRESS, COMPLETED. Each mission card shows agent name, title, brief preview, Run button (when queued), and output (when completed).

### Migration 008 — User Agents (Squad)

```sql
-- supabase/migrations/008_user_agents.sql

create table user_agents (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles(id) on delete cascade,
  agent_id            uuid not null references agents(id)   on delete cascade,
  custom_instructions text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  unique (user_id, agent_id)
);

alter table user_agents enable row level security;

create policy "Users manage own squad"
  on user_agents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins manage all squad entries"
  on user_agents for all
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');
```

### Migration 009 — Missions

```sql
-- supabase/migrations/009_missions.sql

create type mission_status      as enum ('needs_attention', 'in_progress', 'completed');
create type mission_output_type as enum ('doc', 'sheet', 'text');
-- 'pdf' added later in migration 017

create table missions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  agent_id          uuid not null references agents(id)   on delete cascade,
  title             text not null,
  brief             text not null,
  status            mission_status      not null default 'needs_attention',
  output_type       mission_output_type not null default 'text',
  output_url        text,
  output_text       text,
  anthropic_run_id  text,
  web_search        boolean not null default false,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

alter table missions enable row level security;

create policy "Users manage own missions"
  on missions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins view all missions"
  on missions for select using (get_my_role() = 'admin');

create index missions_user_status_idx on missions (user_id, status, created_at desc);
```

> **`web_search` included from the start** — avoids a later alter-table migration.

### Task 5.1 — Mission API Routes

**`app/api/missions/route.ts`** — `GET` returns current user's missions with agent info joined. `POST` creates a mission (`needs_attention`).

**`app/api/missions/[id]/run/route.ts`** — the core run route (`export const maxDuration = 300`). Full logic:

```
1. Auth check
2. Load mission + agent (eq user_id to enforce ownership); 404 if missing
3. Return 409 if mission.status !== 'needs_attention'
4. Require agent.claude_agent_id (else 400 — "re-save the agent")
5. Load user's custom_instructions from user_agents
6. Load company_settings (brand context, Pipedream creds, anthropic_environment_id)
   + agent_knowledge rows (parallel)
7. Require anthropic_environment_id (else 400 — "create the environment in Integrations")
8. Mark mission in_progress
9. Prepare knowledge resources — for each pinned file:
     text = readDriveFile(...)  → files.upload({ file: toFile(Buffer.from(text), `${name}.txt`, {type:'text/plain'}) })
     → resources.push({ type:'file', file_id, mount_path: '/workspace/knowledge/<name>.txt' })
10. anthropic.beta.sessions.create({ agent: claude_agent_id, environment_id, title, resources })
11. Build the kickoff user.message text (AFTER create — needs resolved paths):
     ## Tone of Voice and Brand   (if company_context)
     ## Additional instructions from this user   (if custom_instructions)
     ## Knowledge files            (resolved session.resources[].mount_path list, if any)
     "Do not use web search…"      (if !mission.web_search)
     [output format instruction]
     ## Task\n\n[mission.brief]
12. Stream-first: stream = sessions.events.stream(session.id); then events.send(user.message)
13. Drain the stream:
      collect agent.message text blocks
      sum span.model_request_end.model_usage (input/output tokens)
      capture session.error
      break on session.status_terminated, or session.status_idle with
        stop_reason.type !== 'requires_action'
14. doc/sheet → createDriveFile via Pipedream → output_url (+ keep text); text → output_text
15. Mark completed; save output_url/output_text + anthropic_run_id = session.id
16. void recordUsage(...) with summed tokens  ← fire-and-forget
17. files.delete() each uploaded original (session keeps its own copies); do NOT archive session
18. On error: mark back to needs_attention, delete uploaded files, return 500
```

**Kickoff message assembly** (agent system prompt lives on the agent object):

```typescript
const parts: string[] = []
if (brandContext) parts.push(`## Tone of Voice and Brand\n\n${brandContext}`)
if (customInstructions) parts.push(`## Additional instructions from this user\n\n${customInstructions}`)
if (mountedNames.length) parts.push(`## Knowledge files\n\nRead these mounted files before responding:\n${mountedNames.map(n => `- ${n}`).join('\n')}`)
if (!mission.web_search) parts.push('Do not use web search for this task.')
parts.push(outputInstruction)
parts.push(`## Task\n\n${mission.brief}`)
const kickoff = parts.join('\n\n')
```

**Session create + drain loop** (docs Patterns 5 & 7 — stream-first, correct idle gate):

```typescript
const session = await anthropic.beta.sessions.create({
  agent: agent.claude_agent_id,          // string shorthand → latest version
  environment_id: environmentId,
  title: mission.title,
  resources,                              // [{ type:'file', file_id, mount_path }]
})

const stream = await anthropic.beta.sessions.events.stream(session.id)
await anthropic.beta.sessions.events.send(session.id, {
  events: [{ type: 'user.message', content: [{ type: 'text', text: kickoff }] }],
})

for await (const event of stream) {
  if (event.type === 'agent.message')
    for (const b of event.content) if (b.type === 'text') textChunks.push(b.text)
  else if (event.type === 'span.model_request_end') {
    inputTokens += event.model_usage.input_tokens
    outputTokens += event.model_usage.output_tokens
  }
  if (event.type === 'session.status_terminated') break
  if (event.type === 'session.status_idle' && event.stop_reason.type !== 'requires_action') break
}
```

> **Web search** is part of `agent_toolset_20260401` (always available). The per-mission `web_search` toggle is honored by steering in the kickoff text ("Do not use web search…") rather than per-session tool overrides.

> **Knowledge prep** uses `readDriveFile()` from `lib/drive/read-file.ts` to extract each file to text, then uploads it as `<name>.txt` and mounts it. The kickoff message lists the **resolved** paths from `session.resources[].mount_path` (the API mounts under `/mnt/session/uploads/...`, not the requested `/workspace/...`).

### Task 5.2 — Drive File Creation

**`lib/drive/create-file.ts`** — `createDriveFile({ type, title, content, userId, accountId })` creates a Google Doc, Sheet, or PDF via the Pipedream proxy, then **writes `content` into the body**. Returns `{ id, url, title }`.

```typescript
// Create:
//   Doc/PDF: POST https://docs.googleapis.com/v1/documents      → { documentId }
//   Sheet:   POST https://sheets.googleapis.com/v4/spreadsheets → { spreadsheetId }
// Populate (non-fatal on error):
//   Doc/PDF: POST .../v1/documents/{id}:batchUpdate
//            body { requests: [{ insertText: { location: { index: 1 }, text: content } }] }
//   Sheet:   POST .../v4/spreadsheets/{id}/values:batchUpdate
//            body { valueInputOption: 'USER_ENTERED', data: [{ range: 'Sheet1!A1', values }] }
//            where `values` is parseSheetRows(content) — split lines, split cells on
//            tab (the agent is instructed to emit TSV), comma fallback.
// URL:   doc:   https://docs.google.com/document/d/{id}/edit
//        sheet: https://docs.google.com/spreadsheets/d/{id}/edit
//        pdf:   https://docs.google.com/document/d/{id}/export?format=pdf
//               (same Google Doc as `doc`, just exported — no separate PDF
//               binary is uploaded to Drive)
```

### Task 5.3 — Squad Sidebar

**`components/squad/agent-personalise-drawer.tsx`** — Sheet component. Shows agent name, description. Textarea for custom instructions. Saves to `PATCH /api/squad` (updates `user_agents.custom_instructions`).

Squad members are fetched in the server layout and passed as props — not fetched client-side.

> **Do NOT auto-seed the squad.** Admins assign agents explicitly via Admin → Users → [user] (Phase 6).

### Task 5.4 — Missions UI

**`app/(dashboard)/missions/page.tsx`** — server component. Fetches missions and squad agents. Renders three Kanban columns and a "+ New Mission" button.

**`components/missions/new-mission-dialog.tsx`** — dialog with:
- Agent `<Select>` (populated from squad)
- Title `<Input>`
- Brief `<Textarea>`
- Web search toggle
- Output format `<Select>`: Google Doc | Google Sheet

**`components/missions/kanban-column.tsx`** — receives column title, status, and missions array. Each mission card shows: agent name (badge), title, brief preview. Queued cards have a Run button that calls `POST /api/missions/[id]/run` and refreshes.

**`app/(dashboard)/missions/[id]/page.tsx`** — detail page with brief card, output card (text preview or Drive link), and run button.

### Phase 5 Testing Checklist

- [ ] Admin assigns at least one agent to a user via Admin → Users (Phase 6 not yet built — do this via Supabase SQL or build a minimal assignment route)
- [ ] User sees "My Squad" in sidebar
- [ ] Clicking a squad member opens personalisation drawer; custom instructions save
- [ ] Create mission → appears in QUEUED column
- [ ] Run with agent that has knowledge files → Claude cites content from those files in its response
- [ ] Run with agent that has no knowledge files → runs normally without injection
- [ ] Text output: `output_text` set; Doc/Sheet: `output_url` set and linked
- [ ] Running a non-queued mission returns 409
- [ ] Web search toggle → mission run includes tool results
- [ ] `npx tsc --noEmit` passes

---

**STOP — Wait for approval before proceeding to Phase 6.**

---

## Phase 6: Usage Tracking & Admin Management

### Architecture Decisions

1. **Usage events** — Every Anthropic call records a `usage_events` row: tokens, cost, user, agent, mission. Written via service role client (bypasses RLS).

2. **Cost computation** — `lib/usage.ts` holds per-model pricing. `recordUsage()` inserts the row, never throws.

3. **Role-aware usage page** — Admins see all events; users see only their own.

4. **Admin agent assignment** — `/admin/users/[id]` shows all agents with toggle buttons to assign/remove from a user's squad.

### Migration 011 — Usage Events

```sql
-- supabase/migrations/011_usage_events.sql

create table usage_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  agent_id        uuid references agents(id) on delete set null,
  mission_id      uuid references missions(id) on delete set null,
  model           text not null,
  input_tokens    int not null default 0,
  output_tokens   int not null default 0,
  cost_usd        numeric(10, 6) not null default 0,
  event_type      text not null check (event_type in ('mission_run', 'prompt_generation')),
  created_at      timestamptz not null default now()
);

alter table usage_events enable row level security;

create policy "Admins view usage events"
  on usage_events for select using (get_my_role() = 'admin');

create index usage_events_user_idx    on usage_events(user_id);
create index usage_events_created_idx on usage_events(created_at desc);
```

```sql
-- supabase/migrations/012_usage_rls_user.sql
create policy "Users view own usage events"
  on usage_events for select using (user_id = auth.uid());
```

```sql
-- supabase/migrations/013_user_agents_admin_policy.sql
-- Adds admin SELECT/INSERT/DELETE policies that were missing from 008.
create policy "Admins view all user_agents"
  on user_agents for select using (get_my_role() = 'admin');
```

### Task 6.1 — Usage Helper

**`lib/usage.ts`:**

```typescript
import { createClient } from '@supabase/supabase-js'

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-8':           { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':         { input:  3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input:  0.80, output:  4.00 },
}
const DEFAULT_PRICING = { input: 3.00, output: 15.00 }

export function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model] ?? DEFAULT_PRICING
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

// Uses service role to bypass RLS — never throws
export async function recordUsage(params: {
  userId: string; agentId?: string; missionId?: string;
  model: string; inputTokens: number; outputTokens: number; eventType: string
}): Promise<void>
```

Call as fire-and-forget: `void recordUsage(...)` — never `await`.

### Task 6.2 — Admin User Management

**`app/(dashboard)/admin/users/page.tsx`** — table of all profiles with a "Manage" link to each.

**`app/(dashboard)/admin/users/[id]/page.tsx`** — fetches target user's profile, all active agents, and existing `user_agents` rows. Renders a list of agents with toggle buttons to assign/remove.

**`app/api/admin/users/[id]/agents/route.ts`** — `POST` upserts a `user_agents` row.

**`app/api/admin/users/[id]/agents/[agentId]/route.ts`** — `DELETE` removes the `user_agents` row.

### Phase 6 Testing Checklist

- [ ] Mission run writes a `usage_events` row with correct token counts and cost
- [ ] `/usage` as admin shows all users' events; as user shows only own events
- [ ] Admin assign/remove agent from user → squad sidebar updates on next page load
- [ ] `npx tsc --noEmit` passes

---

**STOP — Wait for approval before proceeding to Phase 7.**

---

## Phase 7: Profile & Company Settings

### Architecture Decisions

1. **Profile settings** — Display name and avatar upload. Avatar stored in Supabase Storage `avatars` bucket. `profiles.avatar_url` (added in migration 001) stores the public URL. The sidebar picks it up automatically.

2. **Company page** — Admin-only textarea for brand voice / company context. Saves to `company_settings.company_context`. This powers the brand tone injection in every mission run.

> **`avatar_url` is already in the schema** — migration 001 includes it. No additional migration needed.

### Task 7.1 — Profile API

**`app/api/profile/route.ts`** — `PATCH` updates `profiles.display_name` for the authenticated user.

**`app/api/profile/avatar/route.ts`** — `POST` multipart: uploads file to Supabase Storage `avatars/{user.id}/{filename}`, then updates `profiles.avatar_url` with the public URL.

**Supabase Storage setup:**
- Create bucket named `avatars` (public)
- Add Storage policy: authenticated users can insert/update to `{user.id}/**`

### Task 7.2 — Profile Settings Page

**`app/(dashboard)/dashboard/page.tsx`** — available to all authenticated users. Renders `<ProfileForm>`.

**`components/settings/profile-form.tsx`** — display name `<Input>` (`PATCH /api/profile`) + avatar file upload preview + submit (`POST /api/profile/avatar`). On success, router.refresh() so the sidebar re-fetches and shows the updated avatar.

### Task 7.3 — Admin Company Page

**`app/(dashboard)/admin/company/page.tsx`** — admin-only. Shows a `<Textarea>` pre-filled with `company_settings.company_context`. Save button calls `PATCH /api/settings/company`.

### Phase 7 Testing Checklist

- [ ] Profile form: display name saves and shows in sidebar on reload
- [ ] Avatar upload: image appears in sidebar after refresh
- [ ] Company page: brand context saved → next mission run reflects it in system prompt
- [ ] Non-admin visiting `/admin/company` is redirected or shown 403
- [ ] `npx tsc --noEmit` passes

---

## Complete Migration Order

Apply in this exact order in the Supabase SQL Editor:

```
001_foundation.sql
002_fix_handle_new_user_search_path.sql   ← skip if 001 already has set search_path
003_agents.sql
004_google_integration.sql
008_user_agents.sql
009_missions.sql
010_company_settings.sql
011_usage_events.sql
012_usage_rls_user.sql
013_user_agents_admin_policy.sql
015_org_drive_agent_knowledge.sql
016_anthropic_environment.sql
017_mission_output_pdf.sql
```

> Migration numbers 005–007 and 014 are not used. `avatar_url` on `profiles` is defined in `001`. `default_output_type` on `agents` is defined in `003`. No separate migrations are needed for those columns. `016` adds `company_settings.anthropic_environment_id` — the shared Managed Agents runtime Environment ID used by mission Sessions (Phase 5). `017` adds `'pdf'` to the `mission_output_type` enum (`alter type ... add value`).

---

## Deployment Notes

### 1. Vercel

Connect GitHub repo. Set all env vars from `.env.local.example`. The `NEXT_PUBLIC_*` vars are embedded at build time — set them before the first deploy.

### 2. Supabase Production

- Apply all migrations in the order above
- Auth → URL Configuration → add the production Vercel URL
- Storage → create `avatars` bucket (public) with policy: `authenticated` users can insert/update in their own path (`{user.id}/**`)

### 3. First Admin

After deploy, register via `/register`, then:

```sql
update profiles set role = 'admin'
where id = (select id from auth.users where email = 'your@email.com');
```

### 4. Vercel Function Timeout

Mission runs drive a full Managed Agents Session (container provision + agent loop), which is slower than a single completion. Add to `app/api/missions/[id]/run/route.ts`:

```typescript
export const maxDuration = 300
```

> Even at 300s a long agent run can exceed the platform cap. The documented fix is async delivery (webhooks / poll the session), which is **out of scope** for the current synchronous route.

### 4b. Agent runtime environment (one-time, per workspace)

Sessions require a pre-created Environment. After deploy: **Admin → Integrations → "Create agent runtime environment"** (calls `POST /api/admin/environment`, which `anthropic.beta.environments.create({ name:'orion-missions', config:{ type:'cloud', networking:{ type:'unrestricted' } } })` once and stores the ID in `company_settings.anthropic_environment_id`). Existing agents must also be re-saved once so their Anthropic agent version includes `agent_toolset_20260401`.

### 5. Build Verification

```bash
npm run build
# Must pass with zero TypeScript errors

# Confirm secrets never in client bundle:
grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE_KEY\|PIPEDREAM_CLIENT_SECRET" .next/static
# Expected: no output
```

### 6. Pipedream Environment

Set `PIPEDREAM_ENVIRONMENT=production` for the deployed environment. The Pipedream project must have a production environment configured in the Pipedream dashboard.

---

## Nexus — Internal-Pilot Development Roadmap

### Summary

Nexus starts from the default Next.js starter. Build a single-company platform where admins configure Claude Managed Agents, invite and assign employees, and employees run missions that deliver Google Drive artifacts.

### Phase 1 — Foundation and access

- Replace the starter UI with the Nexus Shadcn dashboard shell, responsive sidebar, role-aware routes, and baseline loading/error states.
- Add Supabase auth with admin-only employee invitations; public registration stays disabled.
- Create a single-tenant RLS-backed schema for profiles, company settings, and audit-safe metadata. Keep all Anthropic, Pipedream, and service-role secrets server-only.
- **Exit:** invited employees sign in; admins and employees are correctly restricted.

### Phase 2 — Admin configuration

- Build Company and Agents screens: brand context, manual system-prompt authoring/preview, agent descriptions, and Claude Managed Agent create/update reconciliation.
- Store the Nexus agent record, Anthropic agent ID/version, and a fallback model. Preserve local drafts if remote reconciliation fails.
- Populate the mission model picker from Anthropic's available-models API; employees choose a compatible account-available model per mission through a session-only override.
- **Exit:** an admin can create and edit an agent with its live Claude counterpart.

### Phase 3 — Google Drive and knowledge

- Add org-level Pipedream Connect OAuth and the Integration status screen.
- Create a dedicated `Nexus Outputs` folder in the connected Drive; retain only Drive metadata and references in Nexus.
- Let admins search and pin supported Drive files to agents. Extract source content into temporary text resources only at run time; never retain source-file contents in Supabase.
- **Exit:** an admin can connect Drive, attach knowledge to an agent, and verify read access.

### Phase 4 — End-to-end core mission flow

- Add Admin → Users assignment and employee “My Squad” personalization.
- Implement a Missions board with queued, running, completed, and failed states. Employees select an assigned agent, model, brief, optional web-search permission, and Google Doc output.
- Use a Supabase Basic Queue (`pgmq`) plus Edge Function consumer for durable processing. The worker claims and retries jobs, creates the Managed Agent session, injects company/user/knowledge context, and publishes one idempotent output artifact.
- Store final text, Drive URL, selected model, Anthropic session reference, status, and failure reason—never raw Drive source data or full event streams.
- **Exit:** a permitted employee runs an assigned agent and receives a completed Google Doc in Nexus and Drive.

### Phase 5 — Complete dashboard and reporting

- Add Google Sheet and PDF output modes, output-specific instructions/formatting, result pages, retry controls, and Drive links.
- Add Usage, Settings, and admin user-management screens shown in the reference designs.
- Record run-level token counters and calculated cost using the exact price snapshot in effect at run time. Reconcile organization totals against Anthropic's Usage and Cost Admin API, including server-tool costs; display a pending-reconciliation state until provider data arrives.
- **Exit:** Docs, Sheets, and PDFs work; admins can audit mission usage and reconciled dollar totals.

### Phase 6 — Pilot hardening and launch

- Add automated RLS/authorization, API contract, worker retry/idempotency, Drive, and output-format tests; include live staging smoke tests for a real agent session.
- Add structured privacy-safe logs, queue/job monitoring, rate-limit handling, failure alerts, environment validation, secret rotation guidance, backups, and a pilot support runbook.
- Deploy the web app and Supabase functions, configure the shared Managed Agent environment, Drive OAuth production callback, and the first admin.
- **Exit:** a small internal cohort can complete repeated missions without duplicate outputs, lost jobs, secret exposure, or cross-user access.

### Core interfaces, tests, and defaults

- Core data: `profiles`, `company_settings`, `agents`, `user_agents`, `agent_knowledge`, `missions`, `mission_runs`, `usage_events`, and effective-dated pricing snapshots. Queue payloads contain only `missionRunId`; workers re-load and re-authorize before execution.
- Test invite-only access, RLS, agent sync and model overrides, Drive extraction and temporary-file cleanup, retry idempotency, all output formats, and token/cost reconciliation.
- This roadmap assumes one company-owned Google Drive connection, a dedicated output folder, web search disabled by default, and metadata plus final output retention only. AI prompt generation, schedules, multi-agent orchestration, and full-content compliance archival are post-pilot work.
