-- =============================================================================
-- MIGRATION 004 — Painel de Contas a Pagar
-- Rastreia pagamento de contas fixas, faturas de cartão e contas avulsas.
-- Inclui campo de juros para pagamentos em atraso.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bill_payments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  amount        DECIMAL(12, 2),
  due_day       SMALLINT CHECK (due_day BETWEEN 1 AND 31),
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'paid', 'paid_late')),
  interest_amount DECIMAL(12, 2),         -- juros pagos se status = 'paid_late'
  source_type   TEXT NOT NULL DEFAULT 'manual'
                CHECK (source_type IN ('fixed_bill', 'credit_card', 'manual')),
  source_id     UUID,                     -- referência ao fixed_bill ou credit_card
  month         SMALLINT NOT NULL CHECK (month BETWEEN 0 AND 11),
  year          SMALLINT NOT NULL CHECK (year >= 2020),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bill_payments_household_period
  ON public.bill_payments(household_id, year, month);

-- Evita duplicatas de geração automática por mês
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_payments_source_unique
  ON public.bill_payments(household_id, source_id, month, year)
  WHERE source_id IS NOT NULL;

-- RLS
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_payments_select" ON public.bill_payments FOR SELECT   USING (public.user_in_household(household_id));
CREATE POLICY "bill_payments_insert" ON public.bill_payments FOR INSERT   WITH CHECK (public.user_in_household(household_id));
CREATE POLICY "bill_payments_update" ON public.bill_payments FOR UPDATE   USING (public.user_in_household(household_id));
CREATE POLICY "bill_payments_delete" ON public.bill_payments FOR DELETE   USING (public.user_in_household(household_id));
