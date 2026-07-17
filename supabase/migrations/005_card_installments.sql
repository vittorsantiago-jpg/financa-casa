-- =============================================================================
-- MIGRATION 005 — Compras Parceladas no Cartão
-- Suporta parcelas com valores variáveis (primeira diferente, juros por parcela)
-- e exibição do número da parcela na fatura (ex: "Zara 3/12")
-- =============================================================================

-- Plano de parcelamento (a compra em si)
CREATE TABLE IF NOT EXISTS public.card_installment_plans (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id       UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  card_id            UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  description        TEXT NOT NULL,
  category           TEXT NOT NULL DEFAULT 'roupas',
  split_type         TEXT NOT NULL DEFAULT 'half' CHECK (split_type IN ('half', 'specific')),
  split_member       TEXT,
  total_installments INTEGER NOT NULL CHECK (total_installments > 0),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Parcelas individuais (uma por mês, com valor próprio)
CREATE TABLE IF NOT EXISTS public.card_installments (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id        UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  plan_id             UUID NOT NULL REFERENCES public.card_installment_plans(id) ON DELETE CASCADE,
  card_id             UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  installment_number  INTEGER NOT NULL CHECK (installment_number > 0),
  total_installments  INTEGER NOT NULL,
  amount              DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  month               SMALLINT NOT NULL CHECK (month BETWEEN 0 AND 11),
  year                SMALLINT NOT NULL CHECK (year >= 2020),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inst_plans_household
  ON public.card_installment_plans(household_id, card_id);

CREATE INDEX IF NOT EXISTS idx_installments_household_period
  ON public.card_installments(household_id, year, month);

CREATE INDEX IF NOT EXISTS idx_installments_plan
  ON public.card_installments(plan_id);

-- RLS — card_installment_plans
ALTER TABLE public.card_installment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inst_plans_select" ON public.card_installment_plans FOR SELECT   USING (public.user_in_household(household_id));
CREATE POLICY "inst_plans_insert" ON public.card_installment_plans FOR INSERT   WITH CHECK (public.user_in_household(household_id));
CREATE POLICY "inst_plans_update" ON public.card_installment_plans FOR UPDATE   USING (public.user_in_household(household_id));
CREATE POLICY "inst_plans_delete" ON public.card_installment_plans FOR DELETE   USING (public.user_in_household(household_id));

-- RLS — card_installments
ALTER TABLE public.card_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "installments_select" ON public.card_installments FOR SELECT   USING (public.user_in_household(household_id));
CREATE POLICY "installments_insert" ON public.card_installments FOR INSERT   WITH CHECK (public.user_in_household(household_id));
CREATE POLICY "installments_update" ON public.card_installments FOR UPDATE   USING (public.user_in_household(household_id));
CREATE POLICY "installments_delete" ON public.card_installments FOR DELETE   USING (public.user_in_household(household_id));
