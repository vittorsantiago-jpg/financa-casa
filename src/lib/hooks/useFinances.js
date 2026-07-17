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
 * useCardInstallments — compras parceladas no cartão.
 * Gerencia planos (a compra) e parcelas individuais (uma por mês).
 * Suporta valores variáveis: primeira parcela diferente das demais.
 */
export function useCardInstallments(householdId) {
  const [plans,        setPlans]   = useState([]);
  const [installments, setInst]    = useState([]);
  const [loading,      setLoading] = useState(true);
  const supabase = createClient();

  const fetchAll = useCallback(async () => {
    if (!householdId) return;
    const [{ data: p }, { data: i }] = await Promise.all([
      supabase.from("card_installment_plans").select("*").eq("household_id", householdId).order("created_at", { ascending: false }),
      supabase.from("card_installments").select("*").eq("household_id", householdId).order("year").order("month").order("installment_number"),
    ]);
    setPlans(p || []);
    setInst(i || []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetchAll();
    if (!householdId) return;
    const ch = supabase.channel(`installments_${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_installment_plans", filter: `household_id=eq.${householdId}` }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_installments",      filter: `household_id=eq.${householdId}` }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [householdId, fetchAll]);

  /** Parcelas de um mês, enriquecidas com dados do plano (split, descrição) */
  const forMonth = (month, year) =>
    installments
      .filter(i => i.month === month && i.year === year)
      .map(i => ({ ...i, plan: plans.find(p => p.id === i.plan_id) || {} }));

  /** Planos que ainda têm parcelas futuras ou do mês atual */
  const activePlans = (month, year) => {
    const ref = year * 12 + month;
    return plans.filter(p =>
      installments.some(i => i.plan_id === p.id && (i.year * 12 + i.month) >= ref)
    );
  };

  /**
   * Cria um plano e gera todas as parcelas.
   * firstAmount  = valor da 1ª parcela
   * recurAmount  = valor das parcelas 2 até N (pode ser igual à 1ª)
   */
  const createPlan = async ({ card_id, description, category, split_type, split_member, total_installments, first_month, first_year, firstAmount, recurAmount }) => {
    const { data: plan, error: e1 } = await supabase
      .from("card_installment_plans")
      .insert({ household_id: householdId, card_id, description, category, split_type, split_member: split_type === "specific" ? split_member : null, total_installments })
      .select().single();
    if (e1) return { error: e1 };

    // Gera registros para cada parcela
    const rows = [];
    let m = first_month, y = first_year;
    for (let n = 1; n <= total_installments; n++) {
      rows.push({
        household_id:       householdId,
        plan_id:            plan.id,
        card_id,
        installment_number: n,
        total_installments,
        amount:             n === 1 ? Number(firstAmount) : Number(recurAmount),
        month:              m,
        year:               y,
      });
      if (m === 11) { m = 0; y++; } else m++;
    }

    const { error: e2 } = await supabase.from("card_installments").insert(rows);
    if (e2) return { error: e2 };
    await fetchAll();
    return { data: plan };
  };

  /** Cancela um plano (remove plano + todas as parcelas via CASCADE) */
  const cancelPlan = async (planId) => {
    await supabase.from("card_installment_plans").delete().eq("id", planId).eq("household_id", householdId);
    await fetchAll();
  };

  return { plans, installments, loading, forMonth, activePlans, createPlan, cancelPlan };
}
