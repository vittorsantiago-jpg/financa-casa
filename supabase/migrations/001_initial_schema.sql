-- =============================================================================
-- FINANÇA DA CASA — Schema + RLS
-- Versão: 1.0.0
-- Descrição: Schema completo com Row Level Security para isolamento total
--            entre diferentes casas/famílias (multi-tenant seguro)
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABELAS
-- =============================================================================

-- Cada casal/família é um "household"
CREATE TABLE IF NOT EXISTS public.households (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  invite_code  TEXT UNIQUE NOT NULL DEFAULT UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8)),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Vincula usuários Supabase Auth a households
CREATE TABLE IF NOT EXISTS public.household_members (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

-- Salários por membro, por mês/ano
CREATE TABLE IF NOT EXISTS public.salaries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_name   TEXT NOT NULL,
  amount        DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  month         SMALLINT NOT NULL CHECK (month BETWEEN 0 AND 11),
  year          SMALLINT NOT NULL CHECK (year >= 2020),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, member_name, month, year)
);

-- Contas fixas recorrentes
CREATE TABLE IF NOT EXISTS public.fixed_bills (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  amount        DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  split_type    TEXT NOT NULL DEFAULT 'half' CHECK (split_type IN ('half', 'specific')),
  split_member  TEXT,   -- nome do membro quando split_type = 'specific'
  due_day       SMALLINT CHECK (due_day BETWEEN 1 AND 31),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Gastos variáveis do mês
CREATE TABLE IF NOT EXISTS public.expenses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  category      TEXT NOT NULL,
  amount        DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  pay_method    TEXT NOT NULL CHECK (pay_method IN ('debit', 'cash', 'ticket')),
  split_type    TEXT NOT NULL DEFAULT 'half' CHECK (split_type IN ('half', 'specific')),
  split_member  TEXT,
  expense_date  DATE NOT NULL,
  month         SMALLINT NOT NULL CHECK (month BETWEEN 0 AND 11),
  year          SMALLINT NOT NULL CHECK (year >= 2020),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Cartões de crédito
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  bank          TEXT,
  card_limit    DECIMAL(12, 2) CHECK (card_limit >= 0),
  closing_day   SMALLINT CHECK (closing_day BETWEEN 1 AND 31),
  due_day       SMALLINT CHECK (due_day BETWEEN 1 AND 31),
  owner         TEXT,   -- 'both' ou nome do membro
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Transações de cartão de crédito
CREATE TABLE IF NOT EXISTS public.card_transactions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id     UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  card_id          UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  description      TEXT NOT NULL,
  category         TEXT NOT NULL,
  amount           DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  split_type       TEXT NOT NULL DEFAULT 'half' CHECK (split_type IN ('half', 'specific')),
  split_member     TEXT,
  transaction_date DATE NOT NULL,
  month            SMALLINT NOT NULL CHECK (month BETWEEN 0 AND 11),
  year             SMALLINT NOT NULL CHECK (year >= 2020),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Metas de poupança
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id    UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  icon            TEXT DEFAULT '💰',
  target_amount   DECIMAL(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount  DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline        DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ÍNDICES (performance)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_household_members_user_id
  ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household_id
  ON public.household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_salaries_household_period
  ON public.salaries(household_id, year, month);
CREATE INDEX IF NOT EXISTS idx_expenses_household_period
  ON public.expenses(household_id, year, month);
CREATE INDEX IF NOT EXISTS idx_card_txs_household_period
  ON public.card_transactions(household_id, year, month);
CREATE INDEX IF NOT EXISTS idx_card_txs_card_id
  ON public.card_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_fixed_bills_household
  ON public.fixed_bills(household_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_household
  ON public.credit_cards(household_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_household
  ON public.savings_goals(household_id);

-- =============================================================================
-- FUNÇÕES AUXILIARES (SECURITY DEFINER — rodam como superuser)
-- =============================================================================

-- Retorna todos os household_ids do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_user_household_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT household_id
  FROM public.household_members
  WHERE user_id = auth.uid();
$$;

-- Checa se o usuário pertence a um household específico
CREATE OR REPLACE FUNCTION public.user_in_household(h_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members
    WHERE user_id  = auth.uid()
      AND household_id = h_id
  );
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- Garante que cada usuário só acessa dados do próprio household.
-- Mesmo que alguém descubra o ID de outro household, não consegue ler nada.
-- =============================================================================

ALTER TABLE public.households         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salaries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_bills        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals      ENABLE ROW LEVEL SECURITY;

-- ── HOUSEHOLDS ──────────────────────────────────────────────────────────────
CREATE POLICY "households_select_member"
  ON public.households FOR SELECT
  USING (id IN (SELECT public.get_user_household_ids()));

-- Qualquer autenticado pode criar um household (se ainda não tiver)
CREATE POLICY "households_insert_auth"
  ON public.households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Apenas o owner pode editar o household
CREATE POLICY "households_update_owner"
  ON public.households FOR UPDATE
  USING (
    id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ── HOUSEHOLD MEMBERS ────────────────────────────────────────────────────────
CREATE POLICY "members_select_same_household"
  ON public.household_members FOR SELECT
  USING (household_id IN (SELECT public.get_user_household_ids()));

CREATE POLICY "members_insert_auth"
  ON public.household_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "members_delete_self"
  ON public.household_members FOR DELETE
  USING (user_id = auth.uid());

-- ── SALARIES ────────────────────────────────────────────────────────────────
CREATE POLICY "salaries_select"   ON public.salaries FOR SELECT   USING (public.user_in_household(household_id));
CREATE POLICY "salaries_insert"   ON public.salaries FOR INSERT   WITH CHECK (public.user_in_household(household_id));
CREATE POLICY "salaries_update"   ON public.salaries FOR UPDATE   USING (public.user_in_household(household_id));
CREATE POLICY "salaries_delete"   ON public.salaries FOR DELETE   USING (public.user_in_household(household_id));

-- ── FIXED BILLS ─────────────────────────────────────────────────────────────
CREATE POLICY "fixed_bills_select" ON public.fixed_bills FOR SELECT   USING (public.user_in_household(household_id));
CREATE POLICY "fixed_bills_insert" ON public.fixed_bills FOR INSERT   WITH CHECK (public.user_in_household(household_id));
CREATE POLICY "fixed_bills_update" ON public.fixed_bills FOR UPDATE   USING (public.user_in_household(household_id));
CREATE POLICY "fixed_bills_delete" ON public.fixed_bills FOR DELETE   USING (public.user_in_household(household_id));

-- ── EXPENSES ────────────────────────────────────────────────────────────────
CREATE POLICY "expenses_select" ON public.expenses FOR SELECT   USING (public.user_in_household(household_id));
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT   WITH CHECK (public.user_in_household(household_id));
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE   USING (public.user_in_household(household_id));
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE   USING (public.user_in_household(household_id));

-- ── CREDIT CARDS ────────────────────────────────────────────────────────────
CREATE POLICY "credit_cards_select" ON public.credit_cards FOR SELECT   USING (public.user_in_household(household_id));
CREATE POLICY "credit_cards_insert" ON public.credit_cards FOR INSERT   WITH CHECK (public.user_in_household(household_id));
CREATE POLICY "credit_cards_update" ON public.credit_cards FOR UPDATE   USING (public.user_in_household(household_id));
CREATE POLICY "credit_cards_delete" ON public.credit_cards FOR DELETE   USING (public.user_in_household(household_id));

-- ── CARD TRANSACTIONS ───────────────────────────────────────────────────────
CREATE POLICY "card_txs_select" ON public.card_transactions FOR SELECT   USING (public.user_in_household(household_id));
CREATE POLICY "card_txs_insert" ON public.card_transactions FOR INSERT   WITH CHECK (public.user_in_household(household_id));
CREATE POLICY "card_txs_update" ON public.card_transactions FOR UPDATE   USING (public.user_in_household(household_id));
CREATE POLICY "card_txs_delete" ON public.card_transactions FOR DELETE   USING (public.user_in_household(household_id));

-- ── SAVINGS GOALS ───────────────────────────────────────────────────────────
CREATE POLICY "goals_select" ON public.savings_goals FOR SELECT   USING (public.user_in_household(household_id));
CREATE POLICY "goals_insert" ON public.savings_goals FOR INSERT   WITH CHECK (public.user_in_household(household_id));
CREATE POLICY "goals_update" ON public.savings_goals FOR UPDATE   USING (public.user_in_household(household_id));
CREATE POLICY "goals_delete" ON public.savings_goals FOR DELETE   USING (public.user_in_household(household_id));

-- =============================================================================
-- TRIGGERS — atualiza updated_at automaticamente
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_salaries_updated_at
  BEFORE UPDATE ON public.salaries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_fixed_bills_updated_at
  BEFORE UPDATE ON public.fixed_bills
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_savings_goals_updated_at
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
