"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

function useTable(table, householdId, options = {}) {
  const [data, setData]    = useState([]);
  const [loading, setLoad] = useState(true);
  const [error, setError]  = useState(null);
  const supabase = createClient();

  const fetch = useCallback(async () => {
    if (!householdId) return;
    let q = supabase.from(table).select("*").eq("household_id", householdId);
    if (options.order) q = q.order(options.order, { ascending: options.asc ?? true });
    const { data: rows, error: err } = await q;
    if (err) setError(err.message);
    else setData(rows || []);
    setLoad(false);
  }, [householdId, table]);

  useEffect(() => {
    fetch();
    if (!householdId) return;
    const ch = supabase.channel(`${table}_${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` }, fetch)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [householdId, table, fetch]);

  const insert = async (row) => {
    const { data: d, error: e } = await supabase.from(table).insert({ ...row, household_id: householdId }).select().single();
    if (!e && d) setData(p => [...p, d]);
    return { data: d, error: e };
  };

  const update = async (id, row) => {
    const { data: d, error: e } = await supabase.from(table).update(row).eq("id", id).eq("household_id", householdId).select().single();
    if (!e && d) setData(p => p.map(r => r.id === id ? d : r));
    return { data: d, error: e };
  };

  const remove = async (id) => {
    const { error: e } = await supabase.from(table).delete().eq("id", id).eq("household_id", householdId);
    if (!e) setData(p => p.filter(r => r.id !== id));
    return { error: e };
  };

  return { data, loading, error, refetch: fetch, insert, update, remove };
}

export function useFixedBills(householdId)      { return useTable("fixed_bills",       householdId, { order: "created_at",       asc: true  }); }
export function useExpenses(householdId)         { return useTable("expenses",           householdId, { order: "expense_date",     asc: false }); }
export function useCreditCards(householdId)      { return useTable("credit_cards",       householdId, { order: "created_at",       asc: true  }); }
export function useCardTransactions(householdId) { return useTable("card_transactions",  householdId, { order: "transaction_date", asc: false }); }
export function useSavingsGoals(householdId)     { return useTable("savings_goals",      householdId, { order: "created_at",       asc: true  }); }
/**
 * useIncomeSources — fontes de renda flexíveis.
 *
 * Suporta dois fluxos:
 *   • Autônomo (freelance): cada pagamento recebido é lançado já como 'received'
 *     com received_amount + received_date. expected_amount é opcional.
 *
 *   • CLT múltiplo: cadastra expected_amount + status='pending' no início do mês.
 *     Quando o salário cai, marca como received (ajustando o valor se necessário).
 */
export function useIncomeSources(householdId) {
  const base = useTable("income_sources", householdId, { order: "created_at", asc: false });

  /** Soma do que já foi recebido por um membro em determinado mês/ano */
  const receivedTotal = (memberName, month, year) =>
    base.data
      .filter(s => s.member_name === memberName && s.month === month && s.year === year && s.status === "received")
      .reduce((sum, s) => sum + Number(s.received_amount || 0), 0);

  /** Soma do que ainda está pendente (expected) de um membro */
  const pendingTotal = (memberName, month, year) =>
    base.data
      .filter(s => s.member_name === memberName && s.month === month && s.year === year && s.status === "pending")
      .reduce((sum, s) => sum + Number(s.expected_amount || 0), 0);

  /** Todas as entradas de um membro num período */
  const forMember = (memberName, month, year) =>
    base.data
      .filter(s => s.member_name === memberName && s.month === month && s.year === year)
      .sort((a, b) => (b.received_date || "").localeCompare(a.received_date || ""));

  /** Marca uma entrada CLT como recebida (com valor real e data) */
  const markReceived = (id, receivedAmount, receivedDate) =>
    base.update(id, {
      status:          "received",
      received_amount: Number(receivedAmount),
      received_date:   receivedDate,
    });

  /**
   * Copia as entradas CLT do mês anterior para o mês atual.
   * Poupa o Hemerson de redigitar os 3 empregos todo mês.
   */
  const copyPreviousCLT = async (memberName, month, year) => {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear  = month === 0 ? year - 1 : year;
    const previous  = base.data.filter(
      s => s.member_name === memberName
        && s.month === prevMonth
        && s.year  === prevYear
        && s.source_type === "clt"
    );
    for (const s of previous) {
      await base.insert({
        member_name:     s.member_name,
        source_name:     s.source_name,
        source_type:     "clt",
        expected_amount: s.expected_amount,
        received_amount: null,
        received_date:   null,
        status:          "pending",
        month,
        year,
      });
    }
    return previous.length;
  };

  return { ...base, receivedTotal, pendingTotal, forMember, markReceived, copyPreviousCLT };
}

export function useHousehold(householdId) {
  const supabase = createClient();
  const [household, setHousehold] = useState(null);
  const [members,   setMembers]   = useState([]);
  const [loading,   setLoad]      = useState(true);

  useEffect(() => {
    if (!householdId) return;
    (async () => {
      const [{ data: hh }, { data: mem }] = await Promise.all([
        supabase.from("households").select("*").eq("id", householdId).single(),
        supabase.from("household_members").select("*").eq("household_id", householdId).order("created_at"),
      ]);
      setHousehold(hh); setMembers(mem || []); setLoad(false);
    })();
  }, [householdId]);

  return { household, members, loading };
}

/**
 * useBillPayments — rastreia pagamento de contas do mês.
 * Auto-gera entradas para contas fixas e cartões se ainda não existirem.
 */
export function useBillPayments(householdId) {
  const base = useTable("bill_payments", householdId, { order: "due_day", asc: true });

  /** Entradas de um mês/ano específico */
  const forPeriod = (month, year) =>
    base.data.filter(b => b.month === month && b.year === year);

  /** Marca como pago */
  const markPaid = (id) =>
    base.update(id, { status: "paid", interest_amount: null });

  /** Marca como pago com atraso + juros */
  const markPaidLate = (id, interestAmount) =>
    base.update(id, { status: "paid_late", interest_amount: Number(interestAmount) || 0 });

  /** Volta para pendente */
  const markPending = (id) =>
    base.update(id, { status: "pending", interest_amount: null });

  /**
   * Auto-gera entradas pendentes para fixed_bills e credit_cards
   * que ainda não têm registro no mês. Chame no mount do BillsTab.
   */
  const autoGenerate = async (fixedBills, cards, cardTxs, month, year) => {
    const existing = base.data.filter(b => b.month === month && b.year === year);
    const existingSourceIds = new Set(existing.map(b => b.source_id).filter(Boolean));

    const toCreate = [];

    // Contas fixas ativas
    for (const bill of fixedBills.filter(b => b.active !== false)) {
      if (!existingSourceIds.has(bill.id)) {
        toCreate.push({
          name:        bill.name,
          amount:      bill.amount,
          due_day:     bill.due_day || null,
          status:      "pending",
          source_type: "fixed_bill",
          source_id:   bill.id,
          month, year,
        });
      }
    }

    // Faturas de cartão
    for (const card of cards) {
      if (!existingSourceIds.has(card.id)) {
        const total = cardTxs
          .filter(t => t.card_id === card.id && t.month === month && t.year === year)
          .reduce((s, t) => s + Number(t.amount), 0);
        toCreate.push({
          name:        `${card.name} (Fatura)`,
          amount:      total || null,
          due_day:     card.due_day || null,
          status:      "pending",
          source_type: "credit_card",
          source_id:   card.id,
          month, year,
        });
      }
    }

    for (const entry of toCreate) {
      await base.insert(entry);
    }
  };

  return { ...base, forPeriod, markPaid, markPaidLate, markPending, autoGenerate };
}

/**
 * useCardInstallments — compras parceladas.
 * Usa dois useTable em vez de hooks manuais,
 * evitando closure estale com supabase (causava React error #310).
 */
export function useCardInstallments(householdId) {
  const plansBase = useTable("card_installment_plans", householdId, { order: "created_at", asc: false });
  const instsBase = useTable("card_installments",      householdId, { order: "year",       asc: true  });

  /** Parcelas de um mês/ano, enriquecidas com dados do plano */
  const forMonth = (month, year) =>
    instsBase.data
      .filter(i => i.month === month && i.year === year)
      .map(i => ({ ...i, plan: plansBase.data.find(p => p.id === i.plan_id) || {} }));

  /** Planos que ainda têm parcelas no mês atual ou futuras */
  const activePlans = (month, year) => {
    const ref = year * 12 + month;
    return plansBase.data.filter(p =>
      instsBase.data.some(i => i.plan_id === p.id && (i.year * 12 + i.month) >= ref)
    );
  };

  /** Cria um plano e insere todas as parcelas em batch */
  const createPlan = async ({ card_id, description, category, split_type, split_member, total_installments, first_month, first_year, firstAmount, recurAmount }) => {
    const { data: plan, error: e1 } = await plansBase.insert({
      card_id, description, category, split_type,
      split_member: split_type === "specific" ? split_member : null,
      total_installments,
    });
    if (e1 || !plan) return { error: e1 };

    const rows = [];
    let m = Number(first_month), y = Number(first_year);
    for (let n = 1; n <= total_installments; n++) {
      rows.push({
        household_id: householdId, plan_id: plan.id, card_id,
        installment_number: n, total_installments,
        amount: n === 1 ? Number(firstAmount) : Number(recurAmount || firstAmount),
        month: m, year: y,
      });
      if (m === 11) { m = 0; y++; } else m++;
    }

    const supabase = createClient();
    const { error: e2 } = await supabase.from("card_installments").insert(rows);
    if (e2) return { error: e2 };
    await instsBase.refetch();
    return { data: plan };
  };

  /** Cancela um plano — CASCADE remove as parcelas no banco */
  const cancelPlan = async (planId) => {
    await plansBase.remove(planId);
    await instsBase.refetch();
  };

  return {
    plans:        plansBase,
    installments: instsBase,   // useTable — use .data para acessar o array
    loading:      plansBase.loading || instsBase.loading,
    forMonth,
    activePlans,
    createPlan,
    cancelPlan,
  };
}

// ─── CÁLCULOS DE AMORTIZAÇÃO (funções puras, sem hooks) ──────────────────────

/** Taxa mensal a partir da taxa e tipo informados */
function toMonthlyRate(rate, rateType) {
  if (rateType === "annual") return Math.pow(1 + rate / 100, 1 / 12) - 1;
  return rate / 100;
}

/** Calcula parcela Price (PMT) */
function calcPMT(balance, monthlyRate, n) {
  if (monthlyRate === 0 || !n) return balance / (n || 1);
  return balance * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
}

/** Gera tabela de amortização a partir do saldo atual */
export function generateAmortizationTable(debt) {
  const rate      = toMonthlyRate(debt.interest_rate, debt.rate_type);
  let   balance   = Number(debt.current_balance);
  const remaining = (debt.total_installments || 0) - (debt.paid_installments || 0);
  const rows      = [];

  if (debt.amortization_type === "revolving") {
    // Rotativo: sem prazo fixo — mostra os próximos 12 meses se pagar só o mínimo
    for (let i = 1; i <= 12 && balance > 0.01; i++) {
      const interest  = balance * rate;
      const minPay    = Math.max(interest + 1, Number(debt.monthly_payment || 0));
      const principal = Math.max(0, minPay - interest);
      balance         = Math.max(0, balance - principal);
      rows.push({ n: i, payment: minPay, interest, principal, balance });
    }
    return rows;
  }

  if (debt.amortization_type === "price") {
    const pmt = calcPMT(balance, rate, remaining);
    for (let i = 1; i <= remaining && balance > 0.01; i++) {
      const interest  = balance * rate;
      const principal = Math.max(0, pmt - interest);
      balance         = Math.max(0, balance - principal);
      rows.push({ n: debt.paid_installments + i, payment: pmt, interest, principal, balance });
    }
    return rows;
  }

  if (debt.amortization_type === "sac") {
    const fixedPrincipal = Number(debt.original_amount) / (debt.total_installments || 1);
    for (let i = 1; i <= remaining && balance > 0.01; i++) {
      const interest  = balance * rate;
      const principal = Math.min(fixedPrincipal, balance);
      const payment   = principal + interest;
      balance         = Math.max(0, balance - principal);
      rows.push({ n: debt.paid_installments + i, payment, interest, principal, balance });
    }
    return rows;
  }

  return rows;
}

/**
 * useDebts — dívidas (cartão rotativo, empréstimos, financiamentos).
 * Usa dois useTable para seguir o padrão do restante do arquivo.
 */
export function useDebts(householdId) {
  const debtsBase    = useTable("debts",         householdId, { order: "created_at", asc: false });
  const paymentsBase = useTable("debt_payments",  householdId, { order: "created_at", asc: false });

  /** Total do saldo devedor de todas as dívidas ativas */
  const totalBalance  = debtsBase.data.filter(d=>d.active).reduce((s,d)=>s+Number(d.current_balance),0);
  const totalOriginal = debtsBase.data.reduce((s,d)=>s+Number(d.original_amount),0);
  const totalJurosPaid = paymentsBase.data.reduce((s,p)=>s+Number(p.interest_portion),0);

  /** Parcela mensal total das dívidas ativas de um membro */
  const monthlyCommitment = (memberName, memberA, memberB) =>
    debtsBase.data
      .filter(d => d.active && (d.member_name === memberName || d.member_name === "both"))
      .reduce((s, d) => {
        const pmt = Number(d.monthly_payment || 0);
        if (d.split_type === "half") return s + pmt / 2;
        if (d.member_name === memberName) return s + pmt;
        return s;
      }, 0);

  /**
   * Registra o pagamento de uma parcela.
   * Calcula automaticamente juros e amortização e atualiza o saldo.
   */
  const makePayment = async (debtId, customAmount = null) => {
    const debt = debtsBase.data.find(d => d.id === debtId);
    if (!debt) return { error: "Dívida não encontrada" };

    const rate       = toMonthlyRate(debt.interest_rate, debt.rate_type);
    const interest   = Number(debt.current_balance) * rate;
    const pmt        = customAmount ?? Number(debt.monthly_payment ?? 0);
    const principal  = Math.max(0, pmt - interest);
    const newBalance = Math.max(0, Number(debt.current_balance) - principal);
    const today      = new Date().toISOString().slice(0, 10);

    const { error: e1 } = await paymentsBase.insert({
      debt_id:          debtId,
      payment_date:     today,
      month:            new Date().getMonth(),
      year:             new Date().getFullYear(),
      total_paid:       pmt,
      interest_portion: interest,
      principal_portion: principal,
      balance_before:   debt.current_balance,
      balance_after:    newBalance,
    });
    if (e1) return { error: e1 };

    const newPaid = debt.amortization_type !== "revolving"
      ? (debt.paid_installments || 0) + 1
      : debt.paid_installments;

    await debtsBase.update(debtId, {
      current_balance:   newBalance,
      paid_installments: newPaid,
      active:            newBalance > 0.01,
    });

    return { error: null };
  };

  /** Calcula a próxima parcela esperada (sem modificar o banco) */
  const nextPayment = (debt) => {
    const rate      = toMonthlyRate(debt.interest_rate, debt.rate_type);
    const interest  = Number(debt.current_balance) * rate;
    const remaining = (debt.total_installments || 0) - (debt.paid_installments || 0);

    if (debt.amortization_type === "price") {
      const pmt = calcPMT(Number(debt.current_balance), rate, remaining);
      return { total: pmt, interest, principal: pmt - interest };
    }
    if (debt.amortization_type === "sac") {
      const principal = Number(debt.original_amount) / (debt.total_installments || 1);
      return { total: principal + interest, interest, principal };
    }
    // revolving
    return { total: Number(debt.monthly_payment || interest), interest, principal: Math.max(0, Number(debt.monthly_payment||0) - interest) };
  };

  /** Calcula e armazena o monthly_payment na hora de criar a dívida */
  const computeMonthlyPayment = (formData) => {
    const rate      = toMonthlyRate(Number(formData.interest_rate), formData.rate_type);
    const balance   = Number(formData.current_balance);
    const n         = Number(formData.total_installments) - Number(formData.paid_installments || 0);

    if (formData.amortization_type === "price")    return calcPMT(balance, rate, n);
    if (formData.amortization_type === "sac")      return (Number(formData.original_amount) / Number(formData.total_installments)) + balance * rate;
    if (formData.amortization_type === "revolving") return balance * rate; // mínimo = só juros
    return 0;
  };

  return {
    debts:           debtsBase,
    payments:        paymentsBase,
    loading:         debtsBase.loading || paymentsBase.loading,
    totalBalance,
    totalOriginal,
    totalJurosPaid,
    monthlyCommitment,
    makePayment,
    nextPayment,
    computeMonthlyPayment,
  };
}
