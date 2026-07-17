"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook genérico para dados do Supabase com real-time.
 * Busca dados, escuta mudanças em tempo real e expõe CRUD.
 */
function useTable(table, householdId, options = {}) {
  const [data, setData]     = useState([]);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);
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
    const channel = supabase.channel(`${table}_${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` }, fetch)
      .subscribe();
    return () => supabase.removeChannel(channel);
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

  const upsert = async (row, conflictColumn) => {
    const { data: d, error: e } = await supabase.from(table)
      .upsert({ ...row, household_id: householdId }, { onConflict: conflictColumn })
      .select().single();
    if (!e && d) setData(p => { const idx = p.findIndex(r => r.id === d.id); return idx >= 0 ? p.map(r => r.id === d.id ? d : r) : [...p, d]; });
    return { data: d, error: e };
  };

  return { data, loading, error, refetch: fetch, insert, update, remove, upsert };
}

// ─── Hooks específicos ────────────────────────────────────────────────────────

export function useFixedBills(householdId) {
  return useTable("fixed_bills", householdId, { order: "created_at", asc: true });
}

export function useExpenses(householdId) {
  return useTable("expenses", householdId, { order: "expense_date", asc: false });
}

export function useCreditCards(householdId) {
  return useTable("credit_cards", householdId, { order: "created_at", asc: true });
}

export function useCardTransactions(householdId) {
  return useTable("card_transactions", householdId, { order: "transaction_date", asc: false });
}

export function useSavingsGoals(householdId) {
  return useTable("savings_goals", householdId, { order: "created_at", asc: true });
}

/**
 * Salários têm lógica especial (upsert por membro+mês+ano)
 */
export function useSalaries(householdId) {
  const base = useTable("salaries", householdId, { order: "year", asc: false });

  const saveSalary = async (memberName, amount, month, year) => {
    return base.upsert(
      { member_name: memberName, amount, month, year },
      "household_id,member_name,month,year"
    );
  };

  // Agrupa por mês/ano para facilitar o uso: { '2025-6': { vittor: 5000, hemerson: 4000 } }
  const byPeriod = {};
  base.data.forEach(s => {
    const key = `${s.year}-${s.month}`;
    if (!byPeriod[key]) byPeriod[key] = {};
    byPeriod[key][s.member_name.toLowerCase()] = Number(s.amount);
  });

  return { ...base, byPeriod, saveSalary };
}

/**
 * Informações da casa (membros, invite code)
 */
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
      setHousehold(hh);
      setMembers(mem || []);
      setLoad(false);
    })();
  }, [householdId]);

  return { household, members, loading };
}
