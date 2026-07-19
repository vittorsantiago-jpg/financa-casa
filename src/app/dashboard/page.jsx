"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  useFixedBills, useExpenses, useCreditCards,
  useCardTransactions, useSavingsGoals, useIncomeSources,
  useHousehold, useBillPayments, useCardInstallments, useDebts,
  generateAmortizationTable,
} from "@/lib/hooks/useFinances";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, Legend,
} from "recharts";
import AppLock from "@/components/AppLock";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const CATS = {
  moradia:       { label:"Moradia",             icon:"🏠", color:"#6366f1" },
  consumo:       { label:"Contas de Consumo",   icon:"⚡", color:"#f59e0b" },
  mercado:       { label:"Mercado / Aliment.",  icon:"🛒", color:"#10b981" },
  saude:         { label:"Saúde",               icon:"❤️", color:"#ef4444" },
  assinaturas:   { label:"Assinaturas",         icon:"📺", color:"#8b5cf6" },
  transporte:    { label:"Transporte",           icon:"🚗", color:"#3b82f6" },
  educacao:      { label:"Educação",            icon:"📚", color:"#14b8a6" },
  lazer:         { label:"Lazer / Saídas",      icon:"🎉", color:"#ec4899" },
  investimentos: { label:"Investimentos",       icon:"💰", color:"#f97316" },
  roupas:        { label:"Roupas / Compras",    icon:"👕", color:"#94a3b8" },
};

const SPLIT_OPTS = [
  { value:"half",     label:"50/50" },
  { value:"specific", label:"Paga inteiro" },
];

const PAY_METHODS = [
  { value:"debit",  label:"Débito / Transferência" },
  { value:"cash",   label:"Dinheiro" },
  { value:"ticket", label:"🎟️ Ticket Refeição/Aliment." },
];

const GOAL_ICONS = ["💰","🏠","✈️","🚗","📚","👶","💍","🎓","🏖️","🏋️","💻","🎯","🐾"];

// ─── Design ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#f0f4ff", header:"#312e81", primary:"#4f46e5", pLight:"#eef2ff",
  success:"#059669", sLight:"#d1fae5", warn:"#d97706",
  danger:"#dc2626", dLight:"#fee2e2",
  card:"#ffffff", border:"#e2e8f0", muted:"#94a3b8", sub:"#64748b", text:"#1e1b4b",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt   = (v=0)  => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const uid   = ()     => Math.random().toString(36).slice(2,9);
const today = ()     => new Date().toISOString().slice(0,10);

function splitShare(amount, splitType, splitMember, memberA, memberB) {
  const a = Number(amount)||0;
  if (splitType === "half") return { [memberA]: a/2, [memberB]: a/2 };
  if (splitType === "specific" && splitMember)
    return { [memberA]: splitMember===memberA ? a : 0, [memberB]: splitMember===memberB ? a : 0 };
  return { [memberA]:0, [memberB]:0 };
}

function healthColor(p) { return p<=0?"#94a3b8":p<0.5?"#10b981":p<0.75?"#f59e0b":"#ef4444"; }
function healthLabel(p) { return p<=0?"Sem dados":p<0.5?"Saudável 🟢":p<0.75?"Atenção 🟡":"Crítico 🔴"; }

// ─── UI Primitives ────────────────────────────────────────────────────────────
function Card({ children, style={} }) {
  return <div style={{ background:C.card, borderRadius:18, padding:"20px 22px", boxShadow:"0 2px 10px rgba(79,70,229,.07)", border:`1px solid ${C.border}`, ...style }}>{children}</div>;
}
function STitle({ children, action }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <h2 style={{ margin:0, fontSize:16, fontWeight:800, color:C.text }}>{children}</h2>
      {action}
    </div>
  );
}
const inpSt = { border:`1.5px solid ${C.border}`, borderRadius:10, padding:"10px 13px", fontSize:14, outline:"none", color:C.text, background:"#fff", fontFamily:"inherit", width:"100%", boxSizing:"border-box" };
function Input(p)  { return <input {...p}  style={{...inpSt,...(p.style||{})}} />; }

/** Máscara de moeda brasileira — digita centavos, formata automaticamente.
 *  value: string numérica ("1461.37") | onChange: (stringValue) => void  */
function CurrencyInput({ value, onChange, ...props }) {
  const fmt = (v) => {
    const num = parseFloat(v);
    if (!v || isNaN(num) || num === 0) return "";
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const handle = (e) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) { onChange(""); return; }
    onChange(String(parseInt(digits, 10) / 100));
  };
  return (
    <input {...props} type="text" inputMode="numeric"
      value={fmt(value)} onChange={handle} placeholder="0,00"
      style={{...inpSt,...(props.style||{})}} />
  );
}
function Select({ children, ...p }) { return <select {...p} style={{...inpSt,...(p.style||{})}}>{children}</select>; }
function Btn({ children, variant="primary", ...p }) {
  const vs = { primary:{background:C.primary,color:"#fff"}, ghost:{background:"transparent",color:C.primary,border:`1.5px solid ${C.primary}`}, danger:{background:C.danger,color:"#fff"} };
  return <button {...p} style={{ border:"none", borderRadius:10, padding:"11px 20px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", ...vs[variant], ...(p.style||{}) }}>{children}</button>;
}
function Field({ label, children, span }) {
  return <div style={{ display:"flex", flexDirection:"column", gap:4, ...(span?{gridColumn:`span ${span}`}:{}) }}>
    {label && <label style={{ fontSize:11, fontWeight:700, color:C.sub, textTransform:"uppercase", letterSpacing:".07em" }}>{label}</label>}
    {children}
  </div>;
}
function ProgressBar({ value, max, color=C.primary, height=8 }) {
  const p = Math.min(((value||0)/(max||1))*100,100);
  return <div style={{ background:C.border, borderRadius:999, height, overflow:"hidden" }}><div style={{ width:`${p}%`, height:"100%", background:color, borderRadius:999, transition:"width .5s" }} /></div>;
}
function Empty({ msg }) { return <p style={{ color:C.muted, textAlign:"center", padding:"28px 0", margin:0, fontSize:14 }}>{msg}</p>; }
function Badge({ children, color=C.primary }) { return <span style={{ fontSize:11, fontWeight:700, background:`${color}22`, color, borderRadius:20, padding:"3px 10px" }}>{children}</span>; }

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router   = useRouter();
  const supabase = createClient();

  const [householdId, setHouseholdId] = useState(null);
  const [userId,      setUserId]      = useState(null);
  const [tab,         setTab]         = useState("dashboard");
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());

  // Init: get session + household
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setUserId(user.id);
      const { data: m } = await supabase.from("household_members").select("household_id").eq("user_id", user.id).single();
      if (!m) { router.push("/setup"); return; }
      setHouseholdId(m.household_id);
    })();
  }, []);

  const { household, members } = useHousehold(householdId);
  const memberA = members[0]?.display_name || "Membro A";
  const memberB = members[1]?.display_name || "Membro B";

  const bills   = useFixedBills(householdId);
  const exps    = useExpenses(householdId);
  const cards   = useCreditCards(householdId);
  const txs     = useCardTransactions(householdId);
  const goals   = useSavingsGoals(householdId);
  const income    = useIncomeSources(householdId);
  const billPay   = useBillPayments(householdId);
  const instHook  = useCardInstallments(householdId);
  const debtHook  = useDebts(householdId);

  const loading = !householdId || bills.loading || income.loading;

  // ── Monthly numbers ────────────────────────────────────────────────────────
  const active  = bills.data.filter(b=>b.active!==false);
  const mExp    = exps.data.filter(e=>e.year===year&&e.month===month);
  const mTxs    = txs.data.filter(t=>t.year===year&&t.month===month);
  const mInc    = income.data.filter(s=>s.year===year&&s.month===month);
  const mInst   = instHook.forMonth(month, year); // parcelas do mês

  // Renda recebida e pendente por membro
  const salA = income.receivedTotal(memberA, month, year);
  const salB = income.receivedTotal(memberB, month, year);
  // fallback: usa esperado enquanto CLT ainda não chegou
  const salAeff = salA || income.pendingTotal(memberA, month, year);
  const salBeff = salB || income.pendingTotal(memberB, month, year);

  const sh = (row) => splitShare(row.amount, row.split_type, row.split_member, memberA, memberB);

  let fixA=0, fixB=0, varA=0, varB=0, cardA=0, cardB=0, ticket=0;
  active.forEach(b=>{ const s=sh(b); fixA+=s[memberA]||0; fixB+=s[memberB]||0; });
  // Parcelas mensais de dívidas entram como custo fixo
  debtHook.debts.data.filter(d=>d.active).forEach(d=>{
    const pmt=Number(d.monthly_payment||0);
    if(d.split_type==="half"){ fixA+=pmt/2; fixB+=pmt/2; }
    else if(d.member_name===memberA) fixA+=pmt;
    else fixB+=pmt;
  });
  mExp.forEach(e=>{ if(e.pay_method==="ticket"){ticket+=Number(e.amount);return;} const s=sh(e); varA+=s[memberA]||0; varB+=s[memberB]||0; });
  mTxs.forEach(t=>{ const s=sh(t); cardA+=s[memberA]||0; cardB+=s[memberB]||0; });
  // Parcelas do mês também entram na conta do cartão
  mInst.forEach(i=>{ const s=splitShare(i.amount, i.plan?.split_type||"half", i.plan?.split_member, memberA, memberB); cardA+=s[memberA]||0; cardB+=s[memberB]||0; });

  const totA = fixA+varA+cardA, totB = fixB+varB+cardB;
  const pctA = salAeff>0 ? totA/salAeff : 0;
  const pctB = salBeff>0 ? totB/salBeff : 0;

  const catMap = {};
  active.forEach(b=>{ catMap[b.category]=(catMap[b.category]||0)+Number(b.amount); });
  mExp.forEach(e=>{  if(e.pay_method!=="ticket") catMap[e.category]=(catMap[e.category]||0)+Number(e.amount); });
  mTxs.forEach(t=>{ catMap[t.category]=(catMap[t.category]||0)+Number(t.amount); });
  const catData = Object.entries(catMap).map(([k,v])=>({name:CATS[k]?.label||k,value:v,color:CATS[k]?.color||"#999"}));

  const navMonth = d => {
    if(d===-1){ if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
    else      { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }
  };

  const logout = async () => { await supabase.auth.signOut(); router.push("/auth"); };

  if (loading) return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:C.bg,flexDirection:"column",gap:12 }}>
      <div style={{ fontSize:32 }}>💜</div>
      <p style={{ color:C.primary,fontWeight:700,fontSize:16,margin:0 }}>Carregando…</p>
    </div>
  );

  const TABS = [
    { id:"dashboard",   icon:"🏠", label:"Início"         },
    { id:"renda",       icon:"💰", label:"Renda"          },
    { id:"contas",      icon:"📅", label:"Contas a Pagar" },
    { id:"fixas",       icon:"📋", label:"Contas Fixas"   },
    { id:"lancamentos", icon:"💸", label:"Gastos"         },
    { id:"cartoes",     icon:"💳", label:"Cartões"        },
    { id:"metas",       icon:"🎯", label:"Metas"          },
    { id:"dividas",     icon:"📉", label:"Dívidas"        },
    { id:"config",      icon:"⚙️", label:"Configurações" },
  ];

  const shared = {
    memberA, memberB, householdId, month, year,
    mExp, mTxs, mInc, mInst, active, sh,
    bills, exps, cards, txs, goals, income, billPay, instHook, debtHook,
    salA, salB, salAeff, salBeff,
    fixA, fixB, varA, varB, cardA, cardB,
    totA, totB, pctA, pctB, ticket, catData,
    setTab,
  };

  return (
    <AppLock>
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:C.bg, minHeight:"100vh", color:C.text, colorScheme:"light" }}>

      {/* ── SIDE DRAWER ── */}
      <NavDrawer
        open={drawerOpen} onClose={()=>setDrawerOpen(false)}
        tab={tab} setTab={setTab} tabs={TABS}
        household={household} memberA={memberA} memberB={memberB}
        onLogout={logout}
      />

      {/* ── HEADER ── */}
      <div style={{ background:C.header, color:"#fff", padding:"14px 16px" }}>
        <div style={{ maxWidth:960, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
          {/* Hamburger + logo */}
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button onClick={()=>setDrawerOpen(true)} style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:10, width:40, height:40, color:"#fff", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:5, flexShrink:0 }}>
              {[0,1,2].map(i=><div key={i} style={{ width:18, height:2, background:"#fff", borderRadius:2 }}/>)}
            </button>
            <div>
              <div style={{ fontWeight:900, fontSize:16, lineHeight:1.2 }}>{household?.name || "Finanças da Casa"}</div>
              <div style={{ opacity:.6, fontSize:11 }}>{memberA} & {memberB}</div>
            </div>
          </div>
          {/* Navegador de mês */}
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(255,255,255,.13)", borderRadius:12, padding:"7px 12px" }}>
            <button onClick={()=>navMonth(-1)} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer", lineHeight:1, padding:0 }}>‹</button>
            <span style={{ fontWeight:700, fontSize:13, minWidth:110, textAlign:"center" }}>{MONTHS_FULL[month]} {year}</span>
            <button onClick={()=>navMonth( 1)} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer", lineHeight:1, padding:0 }}>›</button>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth:960, margin:"0 auto", padding:"18px 14px 32px" }}>
        {tab==="dashboard"    && <DashTab    {...shared} />}
        {tab==="renda"        && <RendaTab   {...shared} />}
        {tab==="contas"       && <ContasTab  {...shared} />}
        {tab==="fixas"        && <FixasTab   {...shared} />}
        {tab==="lancamentos"  && <LancTab    {...shared} />}
        {tab==="cartoes"      && <CartoesTab {...shared} />}
        {tab==="metas"        && <MetasTab   {...shared} />}
        {tab==="dividas"      && <DiviTab    {...shared} />}
        {tab==="config"       && <ConfigTab  {...shared} household={household} members={members} supabase={supabase} />}
      </div>

    </div>
    </AppLock>
  );
}

// ─── SIDE DRAWER NAVIGATION ──────────────────────────────────────────────────
function NavDrawer({ open, onClose, tab, setTab, tabs, household, memberA, memberB, onLogout }) {
  const go = (id) => { setTab(id); onClose(); };
  return (
    <>
      {/* Overlay escuro */}
      <div onClick={onClose} style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:300,
        opacity:open?1:0, pointerEvents:open?"all":"none", transition:"opacity .2s",
      }}/>
      {/* Painel lateral */}
      <div style={{
        position:"fixed", top:0, left:0, bottom:0, width:290,
        background:"#fff", zIndex:301,
        transform:open?"translateX(0)":"translateX(-110%)",
        transition:"transform .27s cubic-bezier(.4,0,.2,1)",
        display:"flex", flexDirection:"column",
        boxShadow:"6px 0 30px rgba(0,0,0,.18)",
      }}>
        {/* Cabeçalho do drawer */}
        <div style={{ background:C.header, padding:"20px 18px 16px", color:"#fff" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,.18)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13 }}>V♥H</div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:8, width:34, height:34, color:"#fff", cursor:"pointer", fontSize:18, fontFamily:"inherit" }}>✕</button>
          </div>
          <div style={{ fontWeight:900, fontSize:17 }}>{household?.name || "Finanças da Casa"}</div>
          <div style={{ fontSize:12, opacity:.65, marginTop:2 }}>{memberA} & {memberB}</div>
        </div>

        {/* Itens de navegação */}
        <div style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>go(t.id)} style={{
              display:"flex", alignItems:"center", gap:14,
              width:"100%", padding:"15px 18px",
              border:"none", borderLeft:tab===t.id?`4px solid ${C.primary}`:"4px solid transparent",
              background:tab===t.id?C.pLight:"transparent",
              color:tab===t.id?C.primary:C.text,
              fontSize:16, fontWeight:tab===t.id?800:500,
              cursor:"pointer", fontFamily:"inherit", textAlign:"left",
              WebkitTapHighlightColor:"transparent",
            }}>
              <span style={{ fontSize:22, width:32, display:"inline-block" }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Botão sair */}
        <div style={{ padding:"16px 18px", borderTop:`1px solid ${C.border}`, paddingBottom:"calc(16px + env(safe-area-inset-bottom))" }}>
          <button onClick={onLogout} style={{
            width:"100%", padding:"13px 0", background:C.dLight, color:C.danger,
            border:"none", borderRadius:12, fontWeight:700, fontSize:15,
            cursor:"pointer", fontFamily:"inherit",
          }}>Sair da conta</button>
        </div>
      </div>
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashTab({ memberA, memberB, salA, salB, fixA, fixB, varA, varB, cardA, cardB, totA, totB, pctA, pctB, ticket, catData, active, goals, mExp, mTxs, setTab }) {
  const totalIncome  = salA + salB;
  const houseFixed   = active.reduce((a,b)=>a+Number(b.amount),0);
  const houseVar     = mExp.filter(e=>e.pay_method!=="ticket").reduce((a,e)=>a+Number(e.amount),0);
  const houseCard    = mTxs.reduce((a,t)=>a+Number(t.amount),0);
  const houseTotal   = houseFixed + houseVar + houseCard;
  const saldo        = totalIncome - houseTotal;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {(!salA && !salB) && (
        <div style={{ background:"#fffbeb", border:"1.5px solid #fcd34d", borderRadius:12, padding:"12px 16px", color:"#92400e", fontSize:13, fontWeight:500 }}>
          ⚠️ Registre a renda deste mês na aba <strong>💰 Renda</strong> para ver os indicadores completos.
        </div>
      )}

      {/* Cards de resumo — clicáveis */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
        {[
          { icon:"💵", title:"Renda Total",  value:fmt(totalIncome), sub:`${memberA} + ${memberB}`,      c:C.primary, toTab:"renda"  },
          { icon:"🏠", title:"Gastos Casa",  value:fmt(houseTotal),  sub:"Fixas + variáveis + cartões",  c:C.danger,  toTab:"contas" },
          { icon:"✅", title:"Saldo do Mês", value:fmt(saldo),       sub:saldo>=0?"Livre p/ poupança":"Atenção!", c:saldo>=0?C.success:C.danger, toTab:"metas" },
          ...(ticket>0?[{ icon:"🎟️", title:"Via Ticket", value:fmt(ticket), sub:"Não conta no saldo", c:C.muted, toTab:null }]:[]),
        ].map(({icon,title,value,sub,c,toTab})=>(
          <div key={title} onClick={toTab?()=>setTab(toTab):undefined}
            style={{ background:C.card, borderRadius:18, padding:"16px 18px", boxShadow:"0 2px 10px rgba(79,70,229,.07)", border:`1px solid ${C.border}`, borderTop:`4px solid ${c}`, cursor:toTab?"pointer":"default", position:"relative", transition:"transform .12s", WebkitTapHighlightColor:"transparent" }}
            onPointerDown={e=>{ if(toTab) e.currentTarget.style.transform="scale(.97)"; }}
            onPointerUp={e=>{ e.currentTarget.style.transform=""; }}
            onPointerLeave={e=>{ e.currentTarget.style.transform=""; }}
          >
            <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
            <div style={{ fontSize:11, color:C.sub, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>{title}</div>
            <div style={{ fontSize:21, fontWeight:900, color:c, marginBottom:2 }}>{value}</div>
            <div style={{ fontSize:11, color:C.muted }}>{sub}</div>
            {toTab && <div style={{ position:"absolute", top:12, right:14, color:C.muted, fontSize:16, opacity:.4 }}>›</div>}
          </div>
        ))}
      </div>

      {/* Cards individuais — clicáveis, vão para Renda */}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {[
          { name:memberA, sal:salA, tot:totA, fix:fixA, vari:varA+cardA, pct:pctA, color:C.primary, bg:"#eef2ff" },
          { name:memberB, sal:salB, tot:totB, fix:fixB, vari:varB+cardB, pct:pctB, color:C.success, bg:"#f0fdf4" },
        ].map(p=>{
          const avail = (p.sal||0) - p.tot;
          const col   = healthColor(p.pct);
          return (
            <div key={p.name}
              onClick={()=>setTab("renda")}
              style={{ background:C.card, borderRadius:18, padding:"16px 18px", boxShadow:"0 2px 10px rgba(79,70,229,.07)", border:`1px solid ${C.border}`, cursor:"pointer", position:"relative", transition:"transform .12s", WebkitTapHighlightColor:"transparent" }}
              onPointerDown={e=>{ e.currentTarget.style.transform="scale(.98)"; }}
              onPointerUp={e=>{ e.currentTarget.style.transform=""; }}
              onPointerLeave={e=>{ e.currentTarget.style.transform=""; }}
            >
              <div style={{ position:"absolute", top:14, right:14, color:C.muted, fontSize:16, opacity:.4 }}>›</div>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:p.bg, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:18, color:p.color, flexShrink:0 }}>
                  {p.name[0].toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:900, fontSize:16, color:C.text }}>{p.name}</div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:1 }}>
                    {p.sal > 0 ? `Recebido: ${fmt(p.sal)}` : "Sem renda registrada"}
                  </div>
                </div>
                <Badge color={col}>{healthLabel(p.pct)}</Badge>
              </div>
              <div style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.sub, marginBottom:5 }}>
                  <span>Comprometimento</span>
                  <span style={{ color:col, fontWeight:800 }}>{p.sal>0?`${(p.pct*100).toFixed(1)}%`:"—"}</span>
                </div>
                <ProgressBar value={p.tot} max={p.sal||1} color={col} height={10}/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                {[["Fixas",fmt(p.fix),C.text],["Variáveis",fmt(p.vari),C.text],["Disponível",fmt(avail),avail>=0?"#16a34a":C.danger]].map(([l,v,c])=>(
                  <div key={l} style={{ background:"#f8fafc", borderRadius:10, padding:"8px 10px" }}>
                    <div style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:"uppercase", marginBottom:2 }}>{l}</div>
                    <div style={{ fontSize:13, fontWeight:800, color:c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráficos — empilhados (melhor no mobile) */}
      {catData.length>0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Card>
            <STitle>Gastos por Categoria</STitle>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85}
                  label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={12}>
                  {catData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip formatter={v=>fmt(v)} allowEscapeViewBox={{ x:false, y:true }}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 14px", marginTop:8 }}>
              {catData.map((c,i)=>(
                <span key={i} style={{ fontSize:12, color:C.sub, display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ width:9,height:9,borderRadius:"50%",background:c.color,display:"inline-block",flexShrink:0 }}/>
                  {c.name}
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <STitle>Comprometimento</STitle>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={[
                  {name:memberA, Comprometido:totA, Disponível:Math.max(0,salA-totA)},
                  {name:memberB, Comprometido:totB, Disponível:Math.max(0,salB-totB)},
                ]}
                margin={{ top:5, right:10, left:0, bottom:5 }}
              >
                <XAxis dataKey="name" tick={{fontSize:13}}/>
                <YAxis tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v} tick={{fontSize:11}} width={36}/>
                <Tooltip
                  formatter={v=>fmt(v)}
                  allowEscapeViewBox={{ x:false, y:true }}
                  wrapperStyle={{ zIndex:10 }}
                />
                <Legend wrapperStyle={{fontSize:12}}/>
                <Bar dataKey="Comprometido" fill="#ef4444" radius={[5,5,0,0]}/>
                <Bar dataKey="Disponível"   fill="#10b981" radius={[5,5,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Metas — clicável */}
      {goals.data.length>0 && (
        <div
          onClick={()=>setTab("metas")}
          style={{ background:C.card, borderRadius:18, padding:"20px 22px", boxShadow:"0 2px 10px rgba(79,70,229,.07)", border:`1px solid ${C.border}`, cursor:"pointer", position:"relative", WebkitTapHighlightColor:"transparent" }}
          onPointerDown={e=>{ e.currentTarget.style.transform="scale(.98)"; }}
          onPointerUp={e=>{ e.currentTarget.style.transform=""; }}
          onPointerLeave={e=>{ e.currentTarget.style.transform=""; }}
        >
          <div style={{ position:"absolute", top:14, right:16, color:C.muted, fontSize:16, opacity:.4 }}>›</div>
          <STitle>🎯 Metas de Poupança</STitle>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {goals.data.map(g=>{
              const p=Math.min((Number(g.current_amount)||0)/(Number(g.target_amount)||1),1);
              return <div key={g.id}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5, fontSize:13 }}>
                  <span style={{ fontWeight:700 }}>{g.icon} {g.name}</span>
                  <span style={{ color:C.sub }}>{fmt(g.current_amount)} / {fmt(g.target_amount)}</span>
                </div>
                <ProgressBar value={g.current_amount} max={g.target_amount} color={p>=1?C.success:C.primary} height={9}/>
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── RENDA ────────────────────────────────────────────────────────────────────
function RendaTab({ memberA, memberB, income, mInc, month, year }) {
  const [fvName, setFvName] = useState("");
  const [fvAmt,  setFvAmt]  = useState("");
  const [fvDate, setFvDate] = useState(new Date().toISOString().slice(0,10));
  const [fhName, setFhName] = useState("");
  const [fhAmt,  setFhAmt]  = useState("");
  const [marking, setMarking] = useState(null);
  const [markAmt,  setMarkAmt]  = useState("");
  const [markDate, setMarkDate] = useState(new Date().toISOString().slice(0,10));

  const mV = mInc.filter(s=>s.member_name===memberA).sort((a,b)=>(b.received_date||"").localeCompare(a.received_date||""));
  const mH = mInc.filter(s=>s.member_name===memberB);
  const totalV     = mV.reduce((a,s)=>a+Number(s.received_amount||0),0);
  const totalHRecv = mH.filter(s=>s.status==="received").reduce((a,s)=>a+Number(s.received_amount||0),0);
  const totalHPend = mH.filter(s=>s.status==="pending" ).reduce((a,s)=>a+Number(s.expected_amount||0),0);

  const addFreelance = async () => {
    if (!fvName||!fvAmt) return;
    await income.insert({ member_name:memberA, source_name:fvName, source_type:"freelance",
      received_amount:Number(fvAmt), received_date:fvDate, status:"received", month, year });
    setFvName(""); setFvAmt("");
  };

  const addCLT = async () => {
    if (!fhName||!fhAmt) return;
    await income.insert({ member_name:memberB, source_name:fhName, source_type:"clt",
      expected_amount:Number(fhAmt), status:"pending", month, year });
    setFhName(""); setFhAmt("");
  };

  const copyPrevCLT = async () => {
    const n = await income.copyPreviousCLT(memberB, month, year);
    if (!n) alert("Nenhuma entrada CLT encontrada no mês anterior.");
  };

  const markReceived = async (id) => {
    if (!markAmt) return;
    await income.markReceived(id, Number(markAmt), markDate);
    setMarking(null); setMarkAmt(""); setMarkDate(new Date().toISOString().slice(0,10));
  };

  const hasPrevCLT = income.data.some(s=>{
    const pm=month===0?11:month-1, py=month===0?year-1:year;
    return s.member_name===memberB&&s.month===pm&&s.year===py&&s.source_type==="clt";
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {/* VITTOR — Autônomo */}
      <Card style={{ borderLeft:`5px solid ${C.primary}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <h2 style={{ margin:0, fontSize:16, fontWeight:800, color:C.text }}>👤 {memberA} — Autônomo</h2>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Lance cada pagamento conforme recebe</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:C.sub, fontWeight:700, textTransform:"uppercase" }}>Recebido este mês</div>
            <div style={{ fontSize:22, fontWeight:900, color:C.primary }}>{fmt(totalV)}</div>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <Field label="Descrição / Cliente" span={2}>
            <Input placeholder="Ex: Cliente ABC — Projeto X" value={fvName} onChange={e=>setFvName(e.target.value)}/>
          </Field>
          <Field label="Valor recebido (R$)">
            <CurrencyInput value={fvAmt} onChange={setFvAmt}/>
          </Field>
          <Field label="Data de recebimento">
            <Input type="date" value={fvDate} onChange={e=>setFvDate(e.target.value)}/>
          </Field>
        </div>
        <Btn onClick={addFreelance} style={{ width:"100%" }}>+ Registrar Pagamento Recebido</Btn>
        {mV.length>0 && (
          <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.sub, textTransform:"uppercase" }}>Pagamentos em {MONTHS_FULL[month]}</div>
            {mV.map(s=>(
              <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 13px", border:`1.5px solid ${C.border}`, borderRadius:12 }}>
                <span style={{ fontSize:18 }}>💸</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>{s.source_name}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{s.received_date}</div>
                </div>
                <div style={{ fontWeight:900, color:C.success, fontSize:15 }}>{fmt(s.received_amount)}</div>
                <button onClick={()=>income.remove(s.id)} style={{ background:"none", border:`1.5px solid ${C.dLight}`, borderRadius:8, width:30, height:30, cursor:"pointer" }}>🗑️</button>
              </div>
            ))}
          </div>
        )}
        {mV.length===0 && <Empty msg="Nenhum pagamento registrado neste mês."/>}
      </Card>

      {/* HEMERSON — CLT */}
      <Card style={{ borderLeft:`5px solid ${C.success}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div>
            <h2 style={{ margin:0, fontSize:16, fontWeight:800, color:C.text }}>👤 {memberB} — CLT (3 empregos)</h2>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Cadastre os empregos e confirme quando cada salário cair</div>
          </div>
          {hasPrevCLT && <Btn variant="ghost" onClick={copyPrevCLT} style={{ fontSize:12, padding:"7px 14px" }}>📋 Copiar mês anterior</Btn>}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16, marginTop:8 }}>
          <div style={{ background:C.sLight, borderRadius:12, padding:"10px 14px" }}>
            <div style={{ fontSize:11, color:"#166534", fontWeight:700, textTransform:"uppercase" }}>✅ Recebido</div>
            <div style={{ fontSize:20, fontWeight:900, color:"#16a34a" }}>{fmt(totalHRecv)}</div>
          </div>
          <div style={{ background:"#fffbeb", borderRadius:12, padding:"10px 14px" }}>
            <div style={{ fontSize:11, color:"#92400e", fontWeight:700, textTransform:"uppercase" }}>⏳ A Receber</div>
            <div style={{ fontSize:20, fontWeight:900, color:C.warn }}>{fmt(totalHPend)}</div>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <Field label="Nome do emprego" span={2}>
            <Input placeholder="Ex: Empresa Principal, Empresa Secundária…" value={fhName} onChange={e=>setFhName(e.target.value)}/>
          </Field>
          <Field label="Salário esperado (R$)">
            <CurrencyInput value={fhAmt} onChange={setFhAmt}/>
          </Field>
          <div style={{ display:"flex", alignItems:"flex-end" }}>
            <Btn onClick={addCLT} style={{ width:"100%" }}>+ Adicionar Emprego</Btn>
          </div>
        </div>
        {mH.length>0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {mH.map(s=>{
              const recv=s.status==="received";
              return (
                <div key={s.id} style={{ border:`1.5px solid ${recv?"#86efac":C.border}`, background:recv?"#f0fdf4":"#fff", borderRadius:13, padding:"12px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:22 }}>💼</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>{s.source_name}</div>
                      <div style={{ fontSize:12, color:C.muted }}>
                        Esperado: <strong>{fmt(s.expected_amount)}</strong>
                        {recv && <> · Recebido: <strong style={{ color:"#16a34a" }}>{fmt(s.received_amount)}</strong> em {s.received_date}</>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      {recv ? <Badge color={C.success}>✅ Recebido</Badge> : <Badge color={C.warn}>⏳ Pendente</Badge>}
                      {!recv && <Btn onClick={()=>{ setMarking(s.id); setMarkAmt(String(s.expected_amount||"")); }} style={{ fontSize:12, padding:"6px 12px" }}>✓ Confirmar</Btn>}
                      <button onClick={()=>income.remove(s.id)} style={{ background:"none", border:`1.5px solid ${C.dLight}`, borderRadius:8, width:30, height:30, cursor:"pointer" }}>🗑️</button>
                    </div>
                  </div>
                  {marking===s.id && (
                    <div style={{ marginTop:12, padding:"12px 14px", background:"#fffbeb", borderRadius:10, display:"grid", gridTemplateColumns:"1fr 1fr auto auto", gap:10, alignItems:"end" }}>
                      <Field label="Valor recebido (R$)"><CurrencyInput value={markAmt} onChange={setMarkAmt}/></Field>
                      <Field label="Data de recebimento"><Input type="date" value={markDate} onChange={e=>setMarkDate(e.target.value)}/></Field>
                      <Btn variant="success" onClick={()=>markReceived(s.id)}>💾 Salvar</Btn>
                      <Btn variant="ghost" onClick={()=>setMarking(null)}>Cancelar</Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {mH.length===0 && <Empty msg="Nenhum emprego cadastrado este mês. Adicione acima ou copie do mês anterior."/>}
      </Card>
    </div>
  );
}

// ─── CONTAS FIXAS ─────────────────────────────────────────────────────────────
function FixasTab({ bills, memberA, memberB, sh }) {
  const blank = { name:"", category:"moradia", amount:"", split_type:"half", split_member:"", due_day:"" };
  const [form, setForm] = useState(blank);
  const [editing, setEd] = useState(null);
  const f = k => v => setForm(p=>({...p,[k]:v}));

  const save = async () => {
    if (!form.name||!form.amount) return;
    const row = { ...form, amount:Number(form.amount), due_day:form.due_day?Number(form.due_day):null };
    if (editing) { await bills.update(editing, row); setEd(null); }
    else await bills.insert(row);
    setForm(blank);
  };

  const toggle = id => { const b=bills.data.find(x=>x.id===id); bills.update(id,{active:!b.active}); };
  const del    = async id => { if(confirm("Excluir?")) await bills.remove(id); };
  const edit   = b => { setForm({name:b.name,category:b.category,amount:String(b.amount),split_type:b.split_type,split_member:b.split_member||"",due_day:String(b.due_day||"")}); setEd(b.id); };

  let tCasa=0, tA=0, tB=0;
  bills.data.filter(b=>b.active!==false).forEach(b=>{ const s=sh(b); tA+=s[memberA]||0; tB+=s[memberB]||0; tCasa+=Number(b.amount); });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <Card>
        <STitle>{editing?"✏️ Editar Conta Fixa":"➕ Nova Conta Fixa"}</STitle>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <Field label="Nome" span={2}><Input placeholder="Ex: Aluguel, Netflix…" value={form.name} onChange={e=>f("name")(e.target.value)}/></Field>
          <Field label="Categoria"><Select value={form.category} onChange={e=>f("category")(e.target.value)}>{Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}</Select></Field>
          <Field label="Valor (R$)"><CurrencyInput value={form.amount} onChange={v=>f("amount")(v)}/></Field>
          <Field label="Divisão">
            <Select value={form.split_type} onChange={e=>f("split_type")(e.target.value)}>
              <option value="half">50/50</option>
              <option value="specific">Um só paga</option>
            </Select>
          </Field>
          {form.split_type==="specific"&&(
            <Field label="Quem paga?">
              <Select value={form.split_member} onChange={e=>f("split_member")(e.target.value)}>
                <option value="">Selecione…</option>
                <option value={memberA}>{memberA}</option>
                <option value={memberB}>{memberB}</option>
              </Select>
            </Field>
          )}
          <Field label="Vence dia"><Input type="number" placeholder="Ex: 10" min={1} max={31} value={form.due_day} onChange={e=>f("due_day")(e.target.value)}/></Field>
        </div>
        {form.amount&&(
          <div style={{ background:C.pLight, borderRadius:10, padding:"8px 14px", marginBottom:12, fontSize:13, color:C.primary }}>
            {form.split_type==="half"&&`${memberA}: ${fmt(Number(form.amount)/2)} · ${memberB}: ${fmt(Number(form.amount)/2)}`}
            {form.split_type==="specific"&&form.split_member&&`${form.split_member} paga: ${fmt(Number(form.amount))}`}
          </div>
        )}
        <div style={{ display:"flex", gap:10 }}>
          <Btn onClick={save} style={{ flex:1 }}>{editing?"Salvar Edição":"Adicionar Conta Fixa"}</Btn>
          {editing&&<Btn variant="ghost" onClick={()=>{setEd(null);setForm(blank);}}>Cancelar</Btn>}
        </div>
      </Card>

      {bills.data.length>0&&(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          {[["🏠 Casa",fmt(tCasa),C.text],[`👤 ${memberA}`,fmt(tA),C.primary],[`👤 ${memberB}`,fmt(tB),C.success]].map(([l,v,c])=>(
            <Card key={l} style={{ textAlign:"center", padding:"14px 16px" }}>
              <div style={{ fontSize:11, color:C.sub, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>{l}</div>
              <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <STitle>📋 Contas Fixas ({bills.data.filter(b=>b.active!==false).length} ativas)</STitle>
        {bills.data.length===0?<Empty msg="Nenhuma conta fixa. Adicione acima 👆"/>:(
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            {bills.data.map(b=>{
              const cat=CATS[b.category]||{}; const s=sh(b); const off=b.active===false;
              return <div key={b.id} style={{ padding:"12px 14px", border:`1.5px solid ${C.border}`, borderRadius:13, opacity:off?.45:1, background:off?"#f8fafc":"#fff" }}>
                {/* Linha 1: ícone + nome + valor */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:20, flexShrink:0 }}>{cat.icon}</span>
                  <div style={{ flex:1, fontWeight:700, fontSize:14, lineHeight:1.3 }}>
                    {b.name} {off&&<Badge color={C.muted}>pausada</Badge>}
                  </div>
                  <div style={{ fontWeight:900, fontSize:15, color:C.text, flexShrink:0 }}>{fmt(b.amount)}</div>
                </div>
                {/* Linha 2: detalhes + botões */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingLeft:30 }}>
                  <div style={{ fontSize:11, color:C.muted, flex:1, paddingRight:8 }}>
                    {b.split_type==="half"
                      ? `V: ${fmt(s[memberA])} · H: ${fmt(s[memberB])}`
                      : `${b.split_member} paga tudo`}
                    {b.due_day&&` · dia ${b.due_day}`}
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    <button onClick={()=>toggle(b.id)} title={off?"Ativar":"Pausar"} style={{ background:"none", border:`1.5px solid ${C.border}`, borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:15 }}>{off?"▶":"⏸"}</button>
                    <button onClick={()=>edit(b)} style={{ background:"none", border:`1.5px solid ${C.border}`, borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:15 }}>✏️</button>
                    <button onClick={()=>del(b.id)} style={{ background:"none", border:`1.5px solid ${C.dLight}`, borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:15 }}>🗑️</button>
                  </div>
                </div>
              </div>;
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── LANÇAMENTOS ──────────────────────────────────────────────────────────────
function LancTab({ exps, memberA, memberB, month, year, mExp }) {
  const blank = { description:"", category:"mercado", amount:"", pay_method:"debit", split_type:"half", split_member:"", expense_date:today() };
  const [form, setForm] = useState(blank);
  const f = k => v => setForm(p=>({...p,[k]:v}));

  const add = async () => {
    if (!form.description||!form.amount) return;
    await exps.insert({ ...form, amount:Number(form.amount), month, year });
    setForm(p=>({...p,description:"",amount:""}));
  };

  const sorted = [...mExp].sort((a,b)=>b.expense_date.localeCompare(a.expense_date));
  const sumCash   = mExp.filter(e=>e.pay_method!=="ticket").reduce((a,e)=>a+Number(e.amount),0);
  const sumTicket = mExp.filter(e=>e.pay_method==="ticket").reduce((a,e)=>a+Number(e.amount),0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <Card>
        <STitle>➕ Novo Lançamento</STitle>
        <div style={{ background:C.pLight, border:`1.5px solid #a5b4fc`, borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#3730a3" }}>
          💳 Gastos no <strong>cartão de crédito</strong>? Use a aba <strong>Cartões</strong>.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <Field label="Descrição" span={2}><Input placeholder="Ex: Farmácia, Combustível…" value={form.description} onChange={e=>f("description")(e.target.value)}/></Field>
          <Field label="Categoria"><Select value={form.category} onChange={e=>f("category")(e.target.value)}>{Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}</Select></Field>
          <Field label="Valor (R$)"><CurrencyInput value={form.amount} onChange={v=>f("amount")(v)}/></Field>
          <Field label="Forma de pagamento"><Select value={form.pay_method} onChange={e=>f("pay_method")(e.target.value)}>{PAY_METHODS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          <Field label="Divisão">
            <Select value={form.split_type} onChange={e=>f("split_type")(e.target.value)}>
              <option value="half">50/50</option><option value="specific">Um só paga</option>
            </Select>
          </Field>
          {form.split_type==="specific"&&<Field label="Quem paga?"><Select value={form.split_member} onChange={e=>f("split_member")(e.target.value)}><option value="">Selecione…</option><option value={memberA}>{memberA}</option><option value={memberB}>{memberB}</option></Select></Field>}
          <Field label="Data"><Input type="date" value={form.expense_date} onChange={e=>f("expense_date")(e.target.value)}/></Field>
        </div>
        <Btn onClick={add} style={{ width:"100%" }}>Registrar Gasto</Btn>
      </Card>

      {mExp.length>0&&(
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Card style={{ textAlign:"center", padding:"14px 16px" }}><div style={{ fontSize:11, color:C.sub, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>💸 Em Dinheiro/Débito</div><div style={{ fontSize:20, fontWeight:900, color:C.danger }}>{fmt(sumCash)}</div></Card>
          <Card style={{ textAlign:"center", padding:"14px 16px" }}><div style={{ fontSize:11, color:C.sub, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>🎟️ Via Ticket</div><div style={{ fontSize:20, fontWeight:900, color:C.muted }}>{fmt(sumTicket)}</div></Card>
        </div>
      )}

      <Card>
        <STitle>💸 {MONTHS_FULL[month]} {year} ({mExp.length})</STitle>
        {sorted.length===0?<Empty msg="Nenhum lançamento neste mês."/>:(
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {sorted.map(e=>{
              const cat=CATS[e.category]||{}; const isT=e.pay_method==="ticket";
              return <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 13px", border:`1.5px solid ${C.border}`, borderRadius:12, background:isT?"#f8fafc":"#fff" }}>
                <span style={{ fontSize:20, minWidth:26 }}>{cat.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>{e.description}{isT&&<span style={{ background:"#e0f2fe",color:"#0369a1",fontSize:10,borderRadius:6,padding:"2px 6px",marginLeft:6 }}>ticket</span>}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{e.expense_date} · {e.split_type==="half"?"50/50":`${e.split_member} paga`}</div>
                </div>
                <div style={{ fontWeight:800, color:isT?C.muted:C.text, minWidth:85, textAlign:"right" }}>{fmt(e.amount)}</div>
                <button onClick={()=>exps.remove(e.id)} style={{ background:"none", border:`1.5px solid ${C.dLight}`, borderRadius:8, width:30, height:30, cursor:"pointer" }}>🗑️</button>
              </div>;
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── CARTÕES ──────────────────────────────────────────────────────────────────
function CartoesTab({ cards, txs, memberA, memberB, month, year, mTxs, mInst, instHook, sh }) {
  const blankC = { name:"", bank:"", card_limit:"", closing_day:"", due_day:"", owner:"both" };
  const blankT = { card_id:"", description:"", category:"lazer", amount:"", split_type:"half", split_member:"", transaction_date:today() };
  const blankP = { card_id:"", description:"", category:"roupas", split_type:"half", split_member:"", total_installments:"", firstAmount:"", recurAmount:"", first_month:month, first_year:year };
  const [cForm, setCF]      = useState(blankC);
  const [tForm, setTF]      = useState(blankT);
  const [pForm, setPF]      = useState(blankP);
  const [instView, setIV]   = useState("transactions"); // "transactions" | "installments"
  const [adding,   setAdding] = useState(null); // null | "card" | "tx" | "plan"

  const addCard = async () => { if(!cForm.name)return; await cards.insert({...cForm,card_limit:cForm.card_limit?Number(cForm.card_limit):null,closing_day:cForm.closing_day?Number(cForm.closing_day):null,due_day:cForm.due_day?Number(cForm.due_day):null}); setCF(blankC); setAdding(null); };
  const delCard = async id => { if(!confirm("Excluir cartão e transações?"))return; await cards.remove(id); txs.data.filter(t=>t.card_id===id).forEach(t=>txs.remove(t.id)); };
  const addTx   = async () => { if(!tForm.card_id||!tForm.description||!tForm.amount)return; await txs.insert({...tForm,amount:Number(tForm.amount),month,year}); setTF(p=>({...p,description:"",amount:""})); setAdding(null); };
  const addPlan = async () => {
    if (!pForm.card_id||!pForm.description||!pForm.total_installments||!pForm.firstAmount) return;
    const recurAmt = pForm.recurAmount || pForm.firstAmount;
    const { error } = await instHook.createPlan({ ...pForm, total_installments: Number(pForm.total_installments), first_month: Number(pForm.first_month), first_year: Number(pForm.first_year), firstAmount: pForm.firstAmount, recurAmount: recurAmt });
    if (!error) { setPF({...blankP, first_month:month, first_year:year}); setAdding(null); }
  };

  // Card invoice = regular transactions + installments
  const cardTotal = (cardId) => {
    const txTotal   = mTxs.filter(t=>t.card_id===cardId).reduce((a,t)=>a+Number(t.amount),0);
    const instTotal = mInst.filter(i=>i.card_id===cardId).reduce((a,i)=>a+Number(i.amount),0);
    return txTotal + instTotal;
  };

  // Active installment plans (have remaining months)
  const activePlans = instHook.activePlans(month, year);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <Card>
        <STitle>➕ Novo Cartão</STitle>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <Field label="Apelido" span={2}><Input placeholder="Ex: Nubank Vittor" value={cForm.name} onChange={e=>setCF(p=>({...p,name:e.target.value}))}/></Field>
          <Field label="Banco / Bandeira"><Input placeholder="Ex: Nubank Mastercard" value={cForm.bank} onChange={e=>setCF(p=>({...p,bank:e.target.value}))}/></Field>
          <Field label="Dono"><Select value={cForm.owner} onChange={e=>setCF(p=>({...p,owner:e.target.value}))}><option value="both">Ambos</option><option value={memberA}>{memberA}</option><option value={memberB}>{memberB}</option></Select></Field>
          <Field label="Limite (R$)"><CurrencyInput value={cForm.card_limit} onChange={v=>setCF(p=>({...p,card_limit:v}))}/></Field>
          <Field label="Dia fechamento"><Input type="number" placeholder="25" min={1} max={31} value={cForm.closing_day} onChange={e=>setCF(p=>({...p,closing_day:e.target.value}))}/></Field>
          <Field label="Dia vencimento"><Input type="number" placeholder="5"  min={1} max={31} value={cForm.due_day}     onChange={e=>setCF(p=>({...p,due_day:e.target.value}))}/></Field>
        </div>
        <Btn onClick={addCard} style={{ width:"100%" }}>Adicionar Cartão</Btn>
      </Card>

      {cards.data.length>0&&(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:13 }}>
          {cards.data.map(c=>{
            const spent = cardTotal(c.id);
            const lim=Number(c.card_limit)||0; const u=lim>0?spent/lim:0;
            const uc=u>.8?C.danger:u>.5?C.warn:C.primary;
            return <Card key={c.id} style={{ borderTop:`4px solid ${uc}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div><div style={{ fontWeight:800, fontSize:15 }}>💳 {c.name}</div><div style={{ fontSize:11, color:C.muted }}>{c.bank} · {c.owner==="both"?"Ambos":c.owner}</div></div>
                <button onClick={()=>delCard(c.id)} style={{ background:"none", border:`1.5px solid ${C.dLight}`, borderRadius:8, width:28, height:28, cursor:"pointer" }}>🗑️</button>
              </div>
              <div style={{ fontSize:13, marginBottom:8 }}>Fatura: <strong style={{ color:C.danger }}>{fmt(spent)}</strong>{lim>0&&<span style={{ color:C.muted }}> / {fmt(lim)}</span>}</div>
              {lim>0&&<ProgressBar value={spent} max={lim} color={uc}/>}
              {c.closing_day&&<div style={{ fontSize:11, color:C.muted, marginTop:6 }}>Fecha dia {c.closing_day} · Vence dia {c.due_day}</div>}
            </Card>;
          })}
        </div>
      )}

      {/* Botões de ação */}
      {cards.data.length>0&&(
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <Btn onClick={()=>setAdding(adding==="tx"?null:"tx")} style={{ width:"100%" }}>💸 Lançamento avulso</Btn>
          <Btn onClick={()=>setAdding(adding==="plan"?null:"plan")} variant="ghost" style={{ width:"100%" }}>🔄 Compra parcelada</Btn>
        </div>
      )}

      {/* Formulário: Lançamento avulso */}
      {adding==="tx"&&cards.data.length>0&&(
        <Card>
          <STitle>💸 Novo Lançamento Avulso</STitle>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <Field label="Cartão"><Select value={tForm.card_id} onChange={e=>setTF(p=>({...p,card_id:e.target.value}))}><option value="">Selecione…</option>{cards.data.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Categoria"><Select value={tForm.category} onChange={e=>setTF(p=>({...p,category:e.target.value}))}>{Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}</Select></Field>
            <Field label="Descrição" span={2}><Input placeholder="Ex: iFood, Amazon…" value={tForm.description} onChange={e=>setTF(p=>({...p,description:e.target.value}))}/></Field>
            <Field label="Valor (R$)"><CurrencyInput value={tForm.amount} onChange={v=>setTF(p=>({...p,amount:v}))}/></Field>
            <Field label="Divisão">
              <Select value={tForm.split_type} onChange={e=>setTF(p=>({...p,split_type:e.target.value}))}>
                <option value="half">50/50</option><option value="specific">Um só paga</option>
              </Select>
            </Field>
            {tForm.split_type==="specific"&&<Field label="Quem paga?"><Select value={tForm.split_member} onChange={e=>setTF(p=>({...p,split_member:e.target.value}))}><option value="">Selecione…</option><option value={memberA}>{memberA}</option><option value={memberB}>{memberB}</option></Select></Field>}
            <Field label="Data"><Input type="date" value={tForm.transaction_date} onChange={e=>setTF(p=>({...p,transaction_date:e.target.value}))}/></Field>
          </div>
          <Btn onClick={addTx} style={{ width:"100%" }}>Adicionar à Fatura</Btn>
        </Card>
      )}

      {/* Formulário: Compra parcelada */}
      {adding==="plan"&&cards.data.length>0&&(
        <Card style={{ border:`2px solid ${C.primary}` }}>
          <STitle>🔄 Nova Compra Parcelada</STitle>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <Field label="Cartão"><Select value={pForm.card_id} onChange={e=>setPF(p=>({...p,card_id:e.target.value}))}><option value="">Selecione…</option>{cards.data.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Categoria"><Select value={pForm.category} onChange={e=>setPF(p=>({...p,category:e.target.value}))}>{Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}</Select></Field>
            <Field label="Descrição" span={2}><Input placeholder="Ex: TV Samsung, Zara, Nike…" value={pForm.description} onChange={e=>setPF(p=>({...p,description:e.target.value}))}/></Field>
            <Field label="Nº de parcelas"><Input type="number" placeholder="Ex: 12" min={2} max={48} value={pForm.total_installments} onChange={e=>setPF(p=>({...p,total_installments:e.target.value}))}/></Field>
            <Field label="Divisão">
              <Select value={pForm.split_type} onChange={e=>setPF(p=>({...p,split_type:e.target.value}))}>
                <option value="half">50/50</option><option value="specific">Um só paga</option>
              </Select>
            </Field>
            {pForm.split_type==="specific"&&<Field label="Quem paga?" span={2}><Select value={pForm.split_member} onChange={e=>setPF(p=>({...p,split_member:e.target.value}))}><option value="">Selecione…</option><option value={memberA}>{memberA}</option><option value={memberB}>{memberB}</option></Select></Field>}
            <Field label="Valor 1ª parcela (R$)"><CurrencyInput value={pForm.firstAmount} onChange={v=>setPF(p=>({...p,firstAmount:v}))}/></Field>
            <Field label="Demais parcelas (R$)"><CurrencyInput value={pForm.recurAmount} onChange={v=>setPF(p=>({...p,recurAmount:v}))}/></Field>
            <div style={{ gridColumn:"1/-1", background:C.pLight, borderRadius:10, padding:"8px 14px", fontSize:12, color:C.primary }}>
              💡 Deixe "Demais parcelas" em branco se todas forem iguais à primeira. Mês de início: <strong>{MONTHS_FULL[month]} {year}</strong>
            </div>
          </div>
          <Btn onClick={addPlan} style={{ width:"100%" }}>Criar Parcelamento</Btn>
        </Card>
      )}

      {(mTxs.length>0||mInst.length>0)&&(
        <Card>
          <STitle>🧾 Fatura — {MONTHS_FULL[month]} {year}</STitle>
          {cards.data.map(c=>{
            const txs_c  = mTxs.filter(t=>t.card_id===c.id).sort((a,b)=>b.transaction_date.localeCompare(a.transaction_date));
            const inst_c = mInst.filter(i=>i.card_id===c.id);
            if(!txs_c.length&&!inst_c.length) return null;
            return (
              <div key={c.id} style={{ marginBottom:18 }}>
                <div style={{ fontWeight:800, fontSize:14, color:C.primary, marginBottom:8, paddingBottom:6, borderBottom:`1.5px solid ${C.border}` }}>
                  💳 {c.name} — <span style={{ color:C.danger }}>{fmt(cardTotal(c.id))}</span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  {txs_c.map(t=>{
                    const cat=CATS[t.category]||{};
                    return <div key={t.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 11px", border:`1.5px solid ${C.border}`, borderRadius:10 }}>
                      <span>{cat.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700 }}>{t.description}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{t.transaction_date} · {t.split_type==="half"?"50/50":`${t.split_member} paga`}</div>
                      </div>
                      <div style={{ fontWeight:800, fontSize:14 }}>{fmt(t.amount)}</div>
                      <button onClick={()=>txs.remove(t.id)} style={{ background:"none", border:`1.5px solid ${C.dLight}`, borderRadius:8, width:28, height:28, cursor:"pointer" }}>🗑️</button>
                    </div>;
                  })}
                  {inst_c.map(i=>{
                    const cat=CATS[i.plan?.category]||{};
                    return <div key={i.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 11px", border:`1.5px solid #a5b4fc`, borderRadius:10, background:"#eef2ff" }}>
                      <span>{cat.icon||"🔄"}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700 }}>
                          {i.plan?.description}
                          <span style={{ fontSize:10, background:C.primary, color:"#fff", borderRadius:6, padding:"2px 6px", marginLeft:6 }}>{i.installment_number}/{i.total_installments}</span>
                        </div>
                        <div style={{ fontSize:11, color:C.muted }}>Parcela · {i.plan?.split_type==="half"?"50/50":`${i.plan?.split_member} paga`}</div>
                      </div>
                      <div style={{ fontWeight:800, fontSize:14 }}>{fmt(i.amount)}</div>
                    </div>;
                  })}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {activePlans.length>0&&(
        <Card>
          <STitle>🔄 Parcelamentos Ativos ({activePlans.length})</STitle>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {activePlans.map(p=>{
              const allInst   = instHook.installments.data.filter(i=>i.plan_id===p.id);
              const ref       = year*12+month;
              const remaining = allInst.filter(i=>(i.year*12+i.month)>=ref).length;
              const paid_c    = allInst.length - remaining;
              const cat       = CATS[p.category]||{};
              return (
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", border:`1.5px solid ${C.border}`, borderRadius:12, background:"#f8fafc" }}>
                  <span style={{ fontSize:20 }}>{cat.icon||"🔄"}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14 }}>{p.description}</div>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>
                      {cards.data.find(c=>c.id===p.card_id)?.name} · {paid_c}/{p.total_installments} pagas · {remaining} restantes
                    </div>
                    <ProgressBar value={paid_c} max={p.total_installments} color={C.primary} height={5}/>
                  </div>
                  <button onClick={()=>{if(confirm(`Cancelar "${p.description}"? Remove as parcelas futuras.`)) instHook.cancelPlan(p.id);}} style={{ background:"none", border:`1.5px solid ${C.dLight}`, borderRadius:8, width:30, height:30, cursor:"pointer", fontSize:12 }}>🗑️</button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {cards.data.length===0&&<Card><Empty msg="Nenhum cartão cadastrado. Adicione acima 👆"/></Card>}
    </div>
  );
}

// ─── METAS ────────────────────────────────────────────────────────────────────
function MetasTab({ goals, active, mExp, month, year }) {
  const blank = { name:"", icon:"💰", target_amount:"", current_amount:"0", deadline:"" };
  const [form, setForm]   = useState(blank);
  const [depId, setDepId] = useState(null);
  const [dep,   setDep]   = useState("");

  const fixedT = active.reduce((a,b)=>a+Number(b.amount),0);
  const varT   = mExp.filter(e=>e.pay_method!=="ticket").reduce((a,e)=>a+Number(e.amount),0);
  const est    = fixedT + varT;

  const add = async () => {
    if(!form.name||!form.target_amount) return;
    await goals.insert({...form,target_amount:Number(form.target_amount),current_amount:Number(form.current_amount)||0});
    setForm(blank);
  };

  const deposit = async id => {
    const a=Number(dep); if(!a)return;
    const g=goals.data.find(x=>x.id===id);
    await goals.update(id,{current_amount:(Number(g.current_amount)||0)+a});
    setDep(""); setDepId(null);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {est>0&&(
        <div style={{ background:`linear-gradient(135deg,${C.header},#5b21b6)`, borderRadius:18, padding:"20px 18px", color:"#fff" }}>
          <div style={{ fontWeight:900, fontSize:16, marginBottom:6, textAlign:"center" }}>🛡️ Reserva de Emergência Recomendada</div>
          <p style={{ margin:"0 0 16px", opacity:.85, fontSize:13, textAlign:"center" }}>Com gastos mensais estimados de <strong>{fmt(est)}</strong>:</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[["3 meses\n(mínimo)",est*3],["6 meses\n(ideal)",est*6]].map(([l,v])=>(
              <div key={l} style={{ background:"rgba(255,255,255,.15)", borderRadius:14, padding:"14px 12px", textAlign:"center" }}>
                <div style={{ fontSize:10, opacity:.8, fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", marginBottom:6, whiteSpace:"pre-line", lineHeight:1.3 }}>{l}</div>
                <div style={{ fontSize:20, fontWeight:900, letterSpacing:"-.02em" }}>{fmt(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Card>
        <STitle>🎯 Nova Meta</STitle>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div style={{ gridColumn:"1/-1", display:"flex", gap:10 }}>
            <Field label="Ícone"><Select value={form.icon} onChange={e=>setForm(p=>({...p,icon:e.target.value}))} style={{ width:65 }}>{GOAL_ICONS.map(i=><option key={i} value={i}>{i}</option>)}</Select></Field>
            <div style={{ flex:1 }}><Field label="Nome da meta"><Input placeholder="Ex: Reserva de emergência, Viagem…" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></Field></div>
          </div>
          <Field label="Valor alvo (R$)"><CurrencyInput value={form.target_amount} onChange={v=>setForm(p=>({...p,target_amount:v}))}/></Field>
          <Field label="Já guardaram (R$)"><CurrencyInput value={form.current_amount} onChange={v=>setForm(p=>({...p,current_amount:v}))}/></Field>
          <Field label="Prazo (opcional)" span={2}><Input type="date" value={form.deadline} onChange={e=>setForm(p=>({...p,deadline:e.target.value}))}/></Field>
        </div>
        <Btn onClick={add} style={{ width:"100%" }}>Criar Meta</Btn>
      </Card>

      {goals.data.length===0?<Card><Empty msg="Nenhuma meta criada ainda. 🎯"/></Card>:goals.data.map(g=>{
        const cur=Number(g.current_amount)||0; const tgt=Number(g.target_amount)||1;
        const pct=Math.min(cur/tgt,1); const done=pct>=1;
        let daysLeft=null, dc=C.success;
        if(g.deadline){ const d=Math.round((new Date(g.deadline)-new Date())/(864e5)); daysLeft=d; dc=d<30?C.danger:d<90?C.warn:C.success; }
        return <Card key={g.id} style={{ border:done?`2px solid ${C.success}`:`1.5px solid ${C.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:30 }}>{g.icon}</span>
              <div>
                <div style={{ fontWeight:900, fontSize:16 }}>{g.name} {done&&"✅"}</div>
                {g.deadline&&<div style={{ fontSize:12, color:dc, fontWeight:600 }}>{daysLeft!==null&&(daysLeft>0?`${daysLeft} dias`:daysLeft===0?"Hoje!":"⚠️ Vencido")} — {new Date(g.deadline).toLocaleDateString("pt-BR")}</div>}
              </div>
            </div>
            <button onClick={()=>{ if(confirm("Excluir meta?")) goals.remove(g.id); }} style={{ background:"none", border:`1.5px solid ${C.dLight}`, borderRadius:8, width:30, height:30, cursor:"pointer" }}>🗑️</button>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:8 }}>
            <span>Guardado: <strong style={{ color:C.primary }}>{fmt(cur)}</strong></span>
            <span>Meta: <strong>{fmt(tgt)}</strong></span>
            <span style={{ fontWeight:900, color:done?C.success:C.primary }}>{(pct*100).toFixed(1)}%</span>
          </div>
          <ProgressBar value={cur} max={tgt} color={done?C.success:C.primary} height={12}/>
          {!done&&<div style={{ fontSize:12, color:C.muted, marginTop:6 }}>Faltam {fmt(tgt-cur)}</div>}
          <div style={{ marginTop:12 }}>
            {depId===g.id
              ? <div style={{ display:"flex", gap:8 }}><CurrencyInput value={dep} onChange={setDep} style={{ flex:1 }}/><Btn onClick={()=>deposit(g.id)}>💾 Salvar</Btn><Btn variant="ghost" onClick={()=>{setDepId(null);setDep("");}}>Cancelar</Btn></div>
              : <Btn variant="ghost" onClick={()=>setDepId(g.id)} style={{ width:"100%" }}>➕ Registrar Depósito</Btn>
            }
          </div>
        </Card>;
      })}
    </div>
  );
}

// ─── CONTAS A PAGAR ───────────────────────────────────────────────────────────
function ContasTab({ billPay, bills, cards, txs, month, year }) {
  const [newName,   setNewName]   = useState("");
  const [newAmt,    setNewAmt]    = useState("");
  const [newDueDay, setNewDueDay] = useState("");
  const [marking,   setMarking]   = useState(null); // { id, mode: 'paid'|'paid_late' }
  const [interest,  setInterest]  = useState("");
  const [generated, setGenerated] = useState(false);

  // Auto-gera entradas ao abrir a aba
  useEffect(() => {
    if (!generated && billPay.data !== undefined && !billPay.loading) {
      billPay.autoGenerate(bills.data, cards.data, txs.data, month, year)
        .then(() => setGenerated(true));
    }
  }, [billPay.loading, month, year]);

  // Regenera quando muda o mês
  useEffect(() => { setGenerated(false); }, [month, year]);

  const mBills = billPay.forPeriod(month, year)
    .sort((a, b) => (a.due_day || 99) - (b.due_day || 99));

  // Totais
  const totalEsperado = mBills.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalPago     = mBills.filter(b => b.status !== "pending").reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalPendente = mBills.filter(b => b.status === "pending").reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalJuros    = mBills.filter(b => b.status === "paid_late").reduce((s, b) => s + Number(b.interest_amount || 0), 0);

  const confirmMark = async () => {
    if (!marking) return;
    if (marking.mode === "paid") {
      await billPay.markPaid(marking.id);
    } else {
      await billPay.markPaidLate(marking.id, interest);
    }
    setMarking(null); setInterest("");
  };

  const addManual = async () => {
    if (!newName) return;
    await billPay.insert({
      name: newName, amount: newAmt ? Number(newAmt) : null,
      due_day: newDueDay ? Number(newDueDay) : null,
      status: "pending", source_type: "manual", month, year,
    });
    setNewName(""); setNewAmt(""); setNewDueDay("");
  };

  const STATUS_CONFIG = {
    pending:  { label:"⏳ Pendente",         color:C.warn,    bg:"#fffbeb" },
    paid:     { label:"✅ Pago",             color:C.success, bg:"#f0fdf4" },
    paid_late:{ label:"⚠️ Pago com atraso", color:"#d97706", bg:"#fff7ed" },
  };

  const SOURCE_ICON = { fixed_bill:"📋", credit_card:"💳", manual:"📄" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {/* Resumo do mês */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Card style={{ borderTop:`4px solid ${C.primary}`, padding:"14px 16px" }}>
          <div style={{ fontSize:11, color:C.sub, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>💰 Total esperado</div>
          <div style={{ fontSize:20, fontWeight:900, color:C.primary }}>{fmt(totalEsperado)}</div>
        </Card>
        <Card style={{ borderTop:`4px solid ${C.success}`, padding:"14px 16px" }}>
          <div style={{ fontSize:11, color:C.sub, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>✅ Já pago</div>
          <div style={{ fontSize:20, fontWeight:900, color:C.success }}>{fmt(totalPago)}</div>
        </Card>
        <Card style={{ borderTop:`4px solid ${C.warn}`, padding:"14px 16px" }}>
          <div style={{ fontSize:11, color:C.sub, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>⏳ Pendente</div>
          <div style={{ fontSize:20, fontWeight:900, color:C.warn }}>{fmt(totalPendente)}</div>
        </Card>
        <Card style={{ borderTop:`4px solid ${C.danger}`, padding:"14px 16px" }}>
          <div style={{ fontSize:11, color:C.sub, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>💸 Juros pagos</div>
          <div style={{ fontSize:20, fontWeight:900, color:totalJuros > 0 ? C.danger : C.muted }}>{fmt(totalJuros)}</div>
        </Card>
      </div>

      {/* Lista de contas */}
      <Card>
        <STitle>📅 {MONTHS_FULL[month]} {year} ({mBills.length} contas)</STitle>
        {mBills.length === 0
          ? <Empty msg="Carregando contas… abra a aba novamente se demorar." />
          : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {mBills.map(b => {
                const st  = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
                const isM = marking?.id === b.id;
                return (
                  <div key={b.id} style={{ border:`1.5px solid ${b.status!=="pending"?"#e2e8f0":C.border}`, background:st.bg, borderRadius:14, padding:"12px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:20, minWidth:26 }}>{SOURCE_ICON[b.source_type] || "📄"}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14 }}>{b.name}</div>
                        <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
                          {b.due_day ? `Vence dia ${b.due_day}` : "Sem vencimento"}
                          {b.status === "paid_late" && b.interest_amount > 0 &&
                            <span style={{ color:C.danger, fontWeight:600 }}> · Juros: {fmt(b.interest_amount)}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", minWidth:90 }}>
                        <div style={{ fontWeight:900, fontSize:15 }}>{b.amount ? fmt(b.amount) : "—"}</div>
                        <div style={{ fontSize:10, fontWeight:700, color:st.color }}>{st.label}</div>
                      </div>
                    </div>

                    {/* Ações */}
                    {b.status === "pending" && !isM && (
                      <div style={{ display:"flex", gap:8, marginTop:10 }}>
                        <Btn onClick={()=>setMarking({id:b.id,mode:"paid"})} style={{ flex:1, padding:"8px 0", fontSize:13 }}>✅ Marcar pago</Btn>
                        <Btn onClick={()=>setMarking({id:b.id,mode:"paid_late"})} variant="ghost" style={{ flex:1, padding:"8px 0", fontSize:13, color:C.warn, borderColor:C.warn }}>⚠️ Pago com atraso</Btn>
                      </div>
                    )}

                    {/* Formulário inline de confirmação */}
                    {isM && (
                      <div style={{ marginTop:10, background:"rgba(255,255,255,.7)", borderRadius:10, padding:"12px 14px" }}>
                        {marking.mode === "paid_late" && (
                          <Field label="Juros pagos (R$)" span={2}>
                            <CurrencyInput value={interest} onChange={setInterest} placeholder="0,00" style={{ marginBottom:10 }} />
                          </Field>
                        )}
                        <div style={{ display:"flex", gap:8 }}>
                          <Btn onClick={confirmMark} style={{ flex:1, padding:"8px 0", fontSize:13 }}>
                            {marking.mode === "paid" ? "✅ Confirmar pago" : "⚠️ Confirmar atraso"}
                          </Btn>
                          <Btn variant="ghost" onClick={()=>{setMarking(null);setInterest("");}} style={{ padding:"8px 14px", fontSize:13 }}>Cancelar</Btn>
                        </div>
                      </div>
                    )}

                    {/* Desfazer pagamento */}
                    {b.status !== "pending" && (
                      <button onClick={()=>billPay.markPending(b.id)} style={{ background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", marginTop:6, textDecoration:"underline", fontFamily:"inherit" }}>
                        Desfazer pagamento
                      </button>
                    )}

                    {/* Deletar conta manual */}
                    {b.source_type === "manual" && (
                      <button onClick={()=>billPay.remove(b.id)} style={{ background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", marginTop:4, textDecoration:"underline", fontFamily:"inherit", display:"block" }}>
                        Remover
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </Card>

      {/* Adicionar conta avulsa */}
      <Card>
        <STitle>➕ Adicionar Conta Avulsa</STitle>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <Field label="Nome da conta" span={2}>
            <Input placeholder="Ex: Conta de água, Boleto..." value={newName} onChange={e=>setNewName(e.target.value)} />
          </Field>
          <Field label="Valor (R$)">
            <CurrencyInput value={newAmt} onChange={setNewAmt} />
          </Field>
          <Field label="Dia de vencimento">
            <Input type="number" placeholder="Ex: 15" min={1} max={31} value={newDueDay} onChange={e=>setNewDueDay(e.target.value)} />
          </Field>
        </div>
        <Btn onClick={addManual} style={{ width:"100%" }}>Adicionar</Btn>
      </Card>
    </div>
  );
}

// ─── DÍVIDAS ─────────────────────────────────────────────────────────────────
const DEBT_TYPES = {
  credit_card: { icon:"💳", label:"Cartão Rotativo" },
  loan:        { icon:"💰", label:"Empréstimo"      },
  financing:   { icon:"🚗", label:"Financiamento"   },
};
const AMORT_TYPES = {
  price:     "Price (parcela fixa)",
  sac:       "SAC (parcela decrescente)",
  revolving: "Rotativo (sem prazo fixo)",
};

function DiviTab({ debtHook, memberA, memberB }) {
  const blank = {
    name:"", debt_type:"loan", creditor:"", member_name:memberA,
    split_type:"half", original_amount:"", current_balance:"",
    interest_rate:"", rate_type:"monthly", amortization_type:"price",
    total_installments:"", paid_installments:"0", start_date:today(), notes:"",
  };
  const [form,    setForm]    = useState(blank);
  const [adding,  setAdding]  = useState(false);
  const [expand,  setExpand]  = useState(null);   // id da dívida com tabela expandida
  const [paying,  setPaying]  = useState(null);   // id que está pagando
  const [payAmt,  setPayAmt]  = useState("");
  const [showAll, setShowAll] = useState({});

  const f = k => v => setForm(p=>({...p,[k]:v}));

  const addDebt = async () => {
    if (!form.name||!form.original_amount||!form.current_balance||!form.interest_rate) return;
    const pmt = debtHook.computeMonthlyPayment({
      ...form,
      interest_rate:      Number(form.interest_rate),
      original_amount:    Number(form.original_amount),
      current_balance:    Number(form.current_balance),
      total_installments: Number(form.total_installments)||0,
      paid_installments:  Number(form.paid_installments)||0,
    });
    await debtHook.debts.insert({
      ...form,
      original_amount:    Number(form.original_amount),
      current_balance:    Number(form.current_balance),
      interest_rate:      Number(form.interest_rate),
      total_installments: form.amortization_type==="revolving"?null:Number(form.total_installments),
      paid_installments:  Number(form.paid_installments)||0,
      monthly_payment:    pmt,
      active:             true,
    });
    setForm(blank); setAdding(false);
  };

  const confirmPayment = async (debtId) => {
    const custom = payAmt ? Number(payAmt) : null;
    await debtHook.makePayment(debtId, custom);
    setPaying(null); setPayAmt("");
  };

  const activeDebts   = debtHook.debts.data.filter(d=>d.active);
  const inactiveDebts = debtHook.debts.data.filter(d=>!d.active);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {/* Resumo */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[
          { icon:"📉", label:"Total em Dívidas", value:fmt(debtHook.totalBalance),   color:C.danger  },
          { icon:"💸", label:"Juros Pagos",       value:fmt(debtHook.totalJurosPaid), color:C.warn    },
          { icon:"📋", label:"Valor Original",    value:fmt(debtHook.totalOriginal),  color:C.muted   },
          { icon:"✅", label:"Já Quitado",        value:fmt(debtHook.totalOriginal-debtHook.totalBalance), color:C.success },
        ].map(({icon,label,value,color})=>(
          <Card key={label} style={{ borderTop:`4px solid ${color}`, padding:"14px 16px" }}>
            <div style={{ fontSize:11, color:C.sub, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>{icon} {label}</div>
            <div style={{ fontSize:20, fontWeight:900, color }}>{value}</div>
          </Card>
        ))}
      </div>

      {/* Barra de progresso geral */}
      {debtHook.totalOriginal>0&&(
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:13 }}>
            <span style={{ fontWeight:700 }}>📊 Progresso de Quitação Geral</span>
            <span style={{ color:C.success, fontWeight:800 }}>
              {((1-debtHook.totalBalance/debtHook.totalOriginal)*100).toFixed(1)}%
            </span>
          </div>
          <ProgressBar value={debtHook.totalOriginal-debtHook.totalBalance} max={debtHook.totalOriginal} color={C.success} height={12}/>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginTop:6 }}>
            <span>Quitado: {fmt(debtHook.totalOriginal-debtHook.totalBalance)}</span>
            <span>Restante: {fmt(debtHook.totalBalance)}</span>
          </div>
        </Card>
      )}

      {/* Botão adicionar */}
      <Btn onClick={()=>setAdding(a=>!a)} style={{ width:"100%" }}>
        {adding?"✕ Cancelar":"➕ Cadastrar Nova Dívida"}
      </Btn>

      {/* Formulário de nova dívida */}
      {adding&&(
        <Card style={{ border:`2px solid ${C.primary}` }}>
          <STitle>📉 Nova Dívida</STitle>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <Field label="Nome" span={2}><Input placeholder="Ex: Financiamento Carro, Empréstimo Caixa…" value={form.name} onChange={e=>f("name")(e.target.value)}/></Field>
            <Field label="Tipo">
              <Select value={form.debt_type} onChange={e=>f("debt_type")(e.target.value)}>
                {Object.entries(DEBT_TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </Select>
            </Field>
            <Field label="Credor"><Input placeholder="Ex: Banco do Brasil…" value={form.creditor} onChange={e=>f("creditor")(e.target.value)}/></Field>
            <Field label="Responsável">
              <Select value={form.member_name} onChange={e=>f("member_name")(e.target.value)}>
                <option value={memberA}>{memberA}</option>
                <option value={memberB}>{memberB}</option>
                <option value="both">Ambos</option>
              </Select>
            </Field>
            <Field label="Divisão">
              <Select value={form.split_type} onChange={e=>f("split_type")(e.target.value)}>
                <option value="half">50/50</option>
                <option value="specific">Só o responsável</option>
              </Select>
            </Field>
            <Field label="Valor original (R$)"><CurrencyInput value={form.original_amount} onChange={f("original_amount")}/></Field>
            <Field label="Saldo devedor atual (R$)"><CurrencyInput value={form.current_balance} onChange={f("current_balance")}/></Field>
            <Field label="Taxa de juros (%)">
              <Input type="number" placeholder="Ex: 3,5" step="0.01" value={form.interest_rate} onChange={e=>f("interest_rate")(e.target.value)}/>
            </Field>
            <Field label="Tipo de taxa">
              <Select value={form.rate_type} onChange={e=>f("rate_type")(e.target.value)}>
                <option value="monthly">Mensal (% a.m.)</option>
                <option value="annual">Anual (% a.a.)</option>
              </Select>
            </Field>
            <Field label="Sistema de amortização" span={2}>
              <Select value={form.amortization_type} onChange={e=>f("amortization_type")(e.target.value)}>
                {Object.entries(AMORT_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            {form.amortization_type!=="revolving"&&<>
              <Field label="Total de parcelas"><Input type="number" placeholder="Ex: 48" value={form.total_installments} onChange={e=>f("total_installments")(e.target.value)}/></Field>
              <Field label="Parcelas já pagas"><Input type="number" placeholder="Ex: 12" value={form.paid_installments} onChange={e=>f("paid_installments")(e.target.value)}/></Field>
            </>}
            <Field label="Data de início">
              <Input type="date" value={form.start_date} onChange={e=>f("start_date")(e.target.value)}/>
            </Field>
            <Field label="Observações" span={2}><Input placeholder="Opcional…" value={form.notes} onChange={e=>f("notes")(e.target.value)}/></Field>
          </div>
          <Btn onClick={addDebt} style={{ width:"100%" }}>💾 Cadastrar Dívida</Btn>
        </Card>
      )}

      {/* Lista de dívidas ativas */}
      {activeDebts.length>0&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {activeDebts.map(d=>{
            const dt      = DEBT_TYPES[d.debt_type]||{icon:"💸",label:"Dívida"};
            const progress = Math.min((1-Number(d.current_balance)/Number(d.original_amount))*100,100);
            const next    = debtHook.nextPayment(d);
            const table   = expand===d.id ? generateAmortizationTable(d) : [];
            const showFull = showAll[d.id];
            const displayTable = showFull ? table : table.slice(0,6);
            const remaining = (d.total_installments||0)-(d.paid_installments||0);
            const isPayingThis = paying===d.id;

            return (
              <Card key={d.id} style={{ borderLeft:`5px solid ${C.danger}` }}>
                {/* Header */}
                <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:12 }}>
                  <span style={{ fontSize:24 }}>{dt.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:900, fontSize:15 }}>{d.name}</div>
                    <div style={{ fontSize:11, color:C.muted }}>
                      {d.creditor&&<>{d.creditor} · </>}{dt.label} · {d.member_name==="both"?"Ambos":d.member_name}
                    </div>
                  </div>
                  <Badge color={C.danger}>{AMORT_TYPES[d.amortization_type]?.split(" ")[0]}</Badge>
                </div>

                {/* Progresso */}
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5 }}>
                    <span style={{ color:C.muted }}>Quitação</span>
                    <span style={{ fontWeight:800, color:C.success }}>{progress.toFixed(1)}%</span>
                  </div>
                  <ProgressBar value={Number(d.original_amount)-Number(d.current_balance)} max={Number(d.original_amount)} color={C.success} height={10}/>
                </div>

                {/* Valores */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
                  {[
                    ["Saldo Devedor", fmt(d.current_balance), C.danger],
                    ["Valor Original", fmt(d.original_amount), C.muted],
                    ["Parcela Mensal", fmt(d.monthly_payment), C.text],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{ background:"#f8fafc", borderRadius:10, padding:"8px 10px" }}>
                      <div style={{ fontSize:9, color:C.muted, fontWeight:700, textTransform:"uppercase", marginBottom:2 }}>{l}</div>
                      <div style={{ fontSize:13, fontWeight:800, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>

                {d.amortization_type!=="revolving"&&(
                  <div style={{ fontSize:11, color:C.muted, marginBottom:12 }}>
                    📅 {d.paid_installments}/{d.total_installments} parcelas pagas · {remaining} restantes
                  </div>
                )}

                {/* Ações */}
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <Btn onClick={()=>{ setPaying(isPayingThis?null:d.id); setPayAmt(""); }} style={{ flex:1, padding:"9px 0", fontSize:13 }}>
                    {isPayingThis?"✕ Cancelar":"💳 Pagar parcela"}
                  </Btn>
                  <Btn variant="ghost" onClick={()=>setExpand(expand===d.id?null:d.id)} style={{ flex:1, padding:"9px 0", fontSize:13 }}>
                    {expand===d.id?"▲ Fechar":"📊 Ver projeção"}
                  </Btn>
                  <button onClick={()=>debtHook.debts.remove(d.id)} style={{ background:"none", border:`1.5px solid ${C.dLight}`, borderRadius:10, width:38, height:38, cursor:"pointer" }}>🗑️</button>
                </div>

                {/* Formulário de pagamento inline */}
                {isPayingThis&&(
                  <div style={{ marginTop:14, background:"#f0fdf4", borderRadius:12, padding:"14px 16px" }}>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>💳 Pagamento deste mês</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                      {[["Juros",fmt(next.interest)],["Amortização",fmt(next.principal)],["Total",fmt(next.total)]].map(([l,v])=>(
                        <div key={l} style={{ background:"#fff", borderRadius:10, padding:"8px 10px", border:`1.5px solid ${C.border}` }}>
                          <div style={{ fontSize:9, color:C.muted, fontWeight:700, textTransform:"uppercase" }}>{l}</div>
                          <div style={{ fontSize:13, fontWeight:800 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <Field label="Valor personalizado (deixe vazio para usar o calculado)">
                      <CurrencyInput value={payAmt} onChange={setPayAmt} placeholder="Valor calculado automaticamente"/>
                    </Field>
                    <div style={{ marginTop:10 }}>
                      <Btn onClick={()=>confirmPayment(d.id)} style={{ width:"100%" }}>✅ Confirmar Pagamento</Btn>
                    </div>
                  </div>
                )}

                {/* Tabela de amortização */}
                {expand===d.id&&table.length>0&&(
                  <div style={{ marginTop:14 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:C.sub, textTransform:"uppercase", marginBottom:8 }}>📊 Projeção de Amortização</div>
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                        <thead>
                          <tr style={{ background:C.header, color:"#fff" }}>
                            {["Parcela","Pagamento","Juros","Amortização","Saldo"].map(h=>(
                              <th key={h} style={{ padding:"8px 10px", textAlign:"right", fontWeight:700, fontSize:11, whiteSpace:"nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayTable.map((r,i)=>(
                            <tr key={i} style={{ background:i%2===0?"#f8fafc":"#fff", borderBottom:`1px solid ${C.border}` }}>
                              <td style={{ padding:"7px 10px", textAlign:"right", color:C.muted, fontWeight:600 }}>{r.n}</td>
                              <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:700 }}>{fmt(r.payment)}</td>
                              <td style={{ padding:"7px 10px", textAlign:"right", color:C.danger }}>{fmt(r.interest)}</td>
                              <td style={{ padding:"7px 10px", textAlign:"right", color:C.success }}>{fmt(r.principal)}</td>
                              <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:700 }}>{fmt(r.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {table.length>6&&(
                      <button onClick={()=>setShowAll(p=>({...p,[d.id]:!p[d.id]}))} style={{ background:"none", border:"none", color:C.primary, fontSize:12, cursor:"pointer", marginTop:8, fontWeight:700 }}>
                        {showFull?`▲ Mostrar menos`:`▼ Ver todas as ${table.length} parcelas`}
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {activeDebts.length===0&&<Card><Empty msg="Nenhuma dívida ativa. Cadastre acima 👆"/></Card>}

      {/* Dívidas quitadas */}
      {inactiveDebts.length>0&&(
        <Card>
          <STitle>✅ Dívidas Quitadas ({inactiveDebts.length})</STitle>
          {inactiveDebts.map(d=>(
            <div key={d.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
              <span>{DEBT_TYPES[d.debt_type]?.icon||"💸"}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{d.name}</div>
                <div style={{ fontSize:11, color:C.muted }}>{d.creditor}</div>
              </div>
              <Badge color={C.success}>Quitada</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── CONFIGURAÇÕES DA CASA ────────────────────────────────────────────────────
function ConfigTab({ household, members, supabase, householdId }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(household?.invite_code||""); setCopied(true); setTimeout(()=>setCopied(false),2000); };

  const regenerate = async () => {
    if (!confirm("Gerar novo código invalida o atual. Continuar?")) return;
    const newCode = Math.random().toString(36).slice(2,10).toUpperCase();
    await supabase.from("households").update({ invite_code: newCode }).eq("id", householdId);
    window.location.reload();
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <Card>
        <STitle>🏠 Sua Casa</STitle>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ fontSize:13, color:C.sub }}>Nome</div>
          <div style={{ fontWeight:800, fontSize:18, color:C.text }}>{household?.name}</div>
        </div>
        <hr style={{ border:"none", borderTop:`1px solid ${C.border}`, margin:"16px 0" }}/>
        <div style={{ fontSize:13, color:C.sub, marginBottom:8 }}>Membros ({members.length}/2)</div>
        {members.map(m=>(
          <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 13px", background:"#f8fafc", borderRadius:10, marginBottom:8 }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:C.primary, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:16 }}>{m.display_name[0].toUpperCase()}</div>
            <div>
              <div style={{ fontWeight:700 }}>{m.display_name}</div>
              <div style={{ fontSize:11, color:C.muted }}>{m.role==="owner"?"Criador da casa":"Membro"}</div>
            </div>
          </div>
        ))}
      </Card>

      {members.length < 2 && household && (
        <Card style={{ border:`2px dashed ${C.primary}` }}>
          <STitle>🔗 Código de Convite</STitle>
          <p style={{ margin:"0 0 14px", fontSize:13, color:C.sub }}>Compartilhe este código com seu parceiro para que ele entre na sua casa:</p>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ flex:1, background:C.pLight, borderRadius:12, padding:"14px 18px", fontFamily:"monospace", fontSize:24, fontWeight:900, color:C.primary, letterSpacing:".15em", textAlign:"center" }}>{household.invite_code}</div>
            <Btn onClick={copy} style={{ padding:"14px 18px" }}>{copied?"✅ Copiado!":"📋 Copiar"}</Btn>
          </div>
          <button onClick={regenerate} style={{ background:"none", border:"none", color:C.muted, fontSize:12, cursor:"pointer", marginTop:10, textDecoration:"underline" }}>Gerar novo código</button>
        </Card>
      )}
    </div>
  );
}
