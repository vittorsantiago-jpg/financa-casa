-- =============================================================================
-- Migration 007: Policy de UPDATE para display_name em household_members
-- Permite que o usuário atualize apenas seu próprio display_name
-- =============================================================================

-- Permite que o usuário atualize seu próprio registro (display_name)
CREATE POLICY "members_update_self"
  ON public.household_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
