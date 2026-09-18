# Nexus Development Roadmap

## Summary

Nexus is a single-company web dashboard for admins to configure employees to run Claude Managed Agents and save agent outputs as Google Docs, Google Sheets, or PDFs.

Current repo state: Orion is a clean Next.js `16.2.10` starter with React `19`, Tailwind v4, strict TypeScript, and only the default `app/page.tsx` UI. There is no shadcn setup, Supabase integration, Claude Managed Agents harness, Pipedream integration, app routing, or database schema yet.

Baseline checks passed before roadmap creation:

* `npm run lint`
* `npx tsc --noEmit`

Build Nexus in phased stops:

1. Foundation and app shell
2. Admin configuration
3. Google Drive and knowledge
4. Missions and agent runs
5. Usage, profile, and production hardening

## Phase 1: Foundation and App Shell

* Install shadcn/base-nova components, Supabase clients, Anthropic SDK, and core UI dependencies.
* Replace the starter screen with authenticated route groups, Supabase email/password auth, admin/user RBAC, protected `proxy.ts`, and the screenshot-matching sidebar/dashboard shell.
* Deliver placeholder dashboard routes for Missions, Usage, Agents, Company, Users, Integrations, and Settings.
* Follow Next.js 16 App Router conventions: dynamic route `params` are promises, and auth protection should use `proxy.ts` rather than old middleware naming.
* Follow base-nova conventions from the detailed plan: use `SidebarMenuButton` `render` prop, and use link classes instead of unsupported `Button asChild`.

## Phase 2: Admin Configuration

* Add Supabase schema for `profiles`, `company\_settings`, and `agents`.
* Build admin agent CRUD with Claude Managed Agents dual-write, including name, description, model, system prompt, and prompt preview.
* Add company context editing and AI-assisted system prompt generation using saved company context.
* Build user listing and agent assignment so admins can define each employee's "My Squad."
* Enforce route-handler and server-action authorization directly, not only through the dashboard shell.

## Phase 3: Google Drive and Knowledge

* Add org-level Google Drive OAuth through Pipedream on the Integrations page.
* Store only org connection IDs and Drive file metadata, not file contents.
* Build the agent knowledge picker from Drive files and save selected files per agent.
* Add server-side file extraction for Google Docs, Google Sheets, DOCX, PDF, TXT, and CSV so knowledge can be mounted into Claude sessions as readable text.
* Show a clear disconnected state when Drive has not yet been connected.

## Phase 4: Missions and Agent Runs

* Build the Missions Kanban from the screenshots: queued, in progress, completed, plus New Mission/Edit Mission dialogs.
* Let users select an assigned agent, write a brief, toggle web search, and choose Google Doc, Google Sheet, or PDF output.
* Run missions through Claude Managed Agents Sessions using the saved Claude agent, shared runtime environment, company context, user custom instructions, and pinned knowledge files.
* Save output links back to missions; keep text output internally as a fallback if Drive file creation fails.
* Keep session IDs for inspection and record failed runs without losing the original mission brief.

## Phase 5: Usage, Profile, and Production Hardening

* Add usage event tracking for prompt generation and mission runs, including token counts and estimated cost.
* Build admin/user-aware Usage, profile Settings, avatar upload, and final sidebar data wiring.
* Harden auth checks inside route handlers and server actions.
* Verify no secrets reach the client bundle.
* Prepare Vercel/Supabase deployment docs.
* Perform full visual QA against the supplied screenshots and regression-test core flows.

## Key Interfaces

* Main data model: `profiles`, `company\_settings`, `agents`, `agent\_knowledge`, `user\_agents`, `missions`, and `usage\_events`.
* Roles: `admin` can configure the company, agents, users, integrations, and usage; `user` can run assigned agents and manage personal instructions.
* Mission output choices: Google Doc, Google Sheet, PDF.
* Mission output storage: `output\_url` plus `output\_text` fallback.
* Google Drive auth: company-level Pipedream connection, not per employee.
* Claude execution: Managed Agents Sessions, not direct chat completions.

## Test Plan

* Each phase ends with `npm run lint`, `npx tsc --noEmit`, and a browser smoke test.
* Auth tests: register/login/logout, protected route redirects, admin/user route separation.
* Admin tests: create/edit/archive agent, generate prompt, save company context, assign/remove agents from users.
* Integration tests: connect/disconnect Drive, list Drive files, save agent knowledge, extract supported file types.
* Mission tests: create/edit mission, run queued mission, prevent rerun of non-queued mission, verify Doc/Sheet/PDF output links, verify knowledge and personal instructions are included.
* Usage tests: mission and prompt generation events record tokens/cost, admins see all events, users see only their own.

## Assumptions

* Single tenant means no organizations table and no `organization\_id` columns.
* Supabase email/password auth is enough for v1.
* Google Drive is connected once at the company level by an admin, not per employee.
* Mission runs can be synchronous for v1, with async/background execution deferred until needed.
* The supplied screenshots define the target UI style.
* The detailed enterprise plan is implementation reference, but this roadmap intentionally compresses it into five build phases.

