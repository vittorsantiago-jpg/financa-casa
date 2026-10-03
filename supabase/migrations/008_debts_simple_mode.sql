-- =============================================================================
-- MIGRATION 008 — Dívidas: permitir "Modo Simples" (sem taxa de juros)
-- Os campos interest_rate, rate_type e amortization_type passam a ser opcionais,
-- permitindo cadastrar dívidas sem informar o sistema de amortização.
-- =============================================================================

ALTER TABLE public.debts
  ALTER COLUMN interest_rate     DROP NOT NULL,
  ALTER COLUMN rate_type         DROP NOT NULL,
  ALTER COLUMN amortization_type DROP NOT NULL;
