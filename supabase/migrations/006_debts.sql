-- =============================================================================
-- MIGRATION 006 — Dívidas
-- Suporta: cartão rotativo, empréstimos (Price/SAC), financiamentos (Price/SAC)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.debts (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id        UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  debt_type           TEXT NOT NULL CHECK (debt_type IN ('credit_card','loan','financing')),
  creditor            TEXT,
  member_name         TEXT NOT NULL,          -- quem é o responsável
  split_type          TEXT NOT NULL DEFAULT 'half' CHECK (split_type IN ('half','specific')),

  -- Valores
  original_amount     DECIMAL(12,2) NOT NULL, -- valor original da dívida
  current_balance     DECIMAL(12,2) NOT NULL, -- saldo devedor atual

  -- Juros
  interest_rate       DECIMAL(8,4)  NOT NULL, -- taxa informada
  rate_type           TEXT NOT NULL DEFAULT 'monthly' CHECK (rate_type IN ('monthly','annual')),

  -- Amortização
  amortization_type   TEXT NOT NULL DEFAULT 'price'
                      CHECK (amortization_type IN ('price','sac','revolving')),

  -- Prazo
  total_installments  INTEGER,                -- null para rotativo
  paid_installments   INTEGER DEFAULT 0,
  start_date          DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Parcela mensal esperada (calculada e armazenada para uso no orçamento)
  monthly_payment     DECIMAL(12,2),

  active              BOOLEAN DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id        UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  debt_id             UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  payment_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  month               SMALLINT NOT NULL CHECK (month BETWEEN 0 AND 11),
  year                SMALLINT NOT NULL CHECK (year >= 2020),

  total_paid          DECIMAL(12,2) NOT NULL,
  interest_portion    DECIMAL(12,2) NOT NULL DEFAULT 0,
  principal_portion   DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_before      DECIMAL(12,2) NOT NULL,
  balance_after       DECIMAL(12,2) NOT NULL,

  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_debts_household      ON public.debts(household_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt   ON public.debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_period ON public.debt_payments(household_id, year, month);

-- RLS — debts
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debts_select" ON public.debts FOR SELECT   USING (public.user_in_household(household_id));
CREATE POLICY "debts_insert" ON public.debts FOR INSERT   WITH CHECK (public.user_in_household(household_id));
CREATE POLICY "debts_update" ON public.debts FOR UPDATE   USING (public.user_in_household(household_id));
CREATE POLICY "debts_delete" ON public.debts FOR DELETE   USING (public.user_in_household(household_id));

-- RLS — debt_payments
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debt_pay_select" ON public.debt_payments FOR SELECT   USING (public.user_in_household(household_id));
CREATE POLICY "debt_pay_insert" ON public.debt_payments FOR INSERT   WITH CHECK (public.user_in_household(household_id));
CREATE POLICY "debt_pay_update" ON public.debt_payments FOR UPDATE   USING (public.user_in_household(household_id));
CREATE POLICY "debt_pay_delete" ON public.debt_payments FOR DELETE   USING (public.user_in_household(household_id));
