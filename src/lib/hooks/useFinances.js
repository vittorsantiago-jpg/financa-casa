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
