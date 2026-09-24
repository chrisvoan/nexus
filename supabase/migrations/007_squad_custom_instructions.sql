-- Nexus: employees edit their own custom instructions for each squad agent.
-- Apply after 006_missions.sql.

-- Row access: only your own assignments.
create policy "Users update their own custom instructions"
  on public.user_agents for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Column access: custom_instructions is the only column anyone updates, so
-- the policy above can't be used to move an assignment to another agent.
-- Admins assign with insert … on conflict do nothing, which needs no update.
revoke update on public.user_agents from authenticated;
grant update (custom_instructions) on public.user_agents to authenticated;

alter table public.user_agents
  add constraint user_agents_custom_instructions_length
  check (char_length(custom_instructions) <= 5000);
