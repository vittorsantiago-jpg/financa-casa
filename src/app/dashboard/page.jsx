"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  useFixedBills, useExpenses, useCreditCards,
  useCardTransactions, useSavingsGoals, useIncomeSources, useHousehold
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
  const income  = useIncomeSources(householdId);

  const loading = !householdId || bills.loading || income.loading;

  // ── Monthly numbers ────────────────────────────────────────────────────────
  const active  = bills.data.filter(b=>b.active!==false);
  const mExp    = exps.data.filter(e=>e.year===year&&e.month===month);
  const mTxs    = txs.data.filter(t=>t.year===year&&t.month===month);
  const mInc    = income.data.filter(s=>s.year===year&&s.month===month);

  // Renda recebida e pendente por membro
  const salA = income.receivedTotal(memberA, month, year);
  const salB = income.receivedTotal(memberB, month, year);
  // fallback: usa esperado enquanto CLT ainda não chegou
  const salAeff = salA || income.pendingTotal(memberA, month, year);
  const salBeff = salB || income.pendingTotal(memberB, month, year);

  const sh = (row) => splitShare(row.amount, row.split_type, row.split_member, memberA, memberB);

  let fixA=0, fixB=0, varA=0, varB=0, cardA=0, cardB=0, ticket=0;
  active.forEach(b=>{ const s=sh(b); fixA+=s[memberA]||0; fixB+=s[memberB]||0; });
  mExp.forEach(e=>{ if(e.pay_method==="ticket"){ticket+=Number(e.amount);return;} const s=sh(e); varA+=s[memberA]||0; varB+=s[memberB]||0; });
  mTxs.forEach(t=>{ const s=sh(t); cardA+=s[memberA]||0; cardB+=s[memberB]||0; });

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
    {id:"dashboard",    label:"🏠 Dashboard"},
    {id:"renda",        label:"💰 Renda"},
    {id:"fixas",        label:"📋 Fixas"},
    {id:"lancamentos",  label:"💸 Lançamentos"},
    {id:"cartoes",      label:"💳 Cartões"},
    {id:"metas",        label:"🎯 Metas"},
    {id:"config",       label:"⚙️ Casa"},
  ];

  const shared = {
    memberA, memberB, householdId, month, year,
    mExp, mTxs, mInc, active, sh,
    bills, exps, cards, txs, goals, income,
    salA, salB, salAeff, salBeff,
    fixA, fixB, varA, varB, cardA, cardB,
    totA, totB, pctA, pctB, ticket, catData,
  };

  return (
    <AppLock>
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:C.bg, minHeight:"100vh", color:C.text }}>
      {/* HEADER */}
      <div style={{ background:C.header, color:"#fff", padding:"18px 20px 0" }}>
        <div style={{ maxWidth:960, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:"50%", background:"rgba(255,255,255,.18)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:14, color:"#fff" }}>V♥H</div>
              <div>
                <div style={{ fontWeight:900, fontSize:18 }}>{household?.name || "Finanças da Casa"}</div>
                <div style={{ opacity:.65, fontSize:12 }}>{memberA} & {memberB}</div>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,.13)", borderRadius:12, padding:"7px 14px" }}>
                <button onClick={()=>navMonth(-1)} style={{ background:"none", border:"none", color:"#fff", fontSize:18, cursor:"pointer" }}>‹</button>
                <span style={{ fontWeight:700, fontSize:14, minWidth:145, textAlign:"center" }}>{MONTHS_FULL[month]} {year}</span>
                <button onClick={()=>navMonth( 1)} style={{ background:"none", border:"none", color:"#fff", fontSize:18, cursor:"pointer" }}>›</button>
              </div>
              <button onClick={logout} title="Sair" style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:10, padding:"8px 14px", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>Sair</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:2, overflowX:"auto" }}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                background:tab===t.id?"#fff":"transparent", color:tab===t.id?C.primary:"rgba(255,255,255,.78)",
                border:"none", borderRadius:"10px 10px 0 0", padding:"9px 15px", fontSize:13, fontWeight:700,
                cursor:"pointer", whiteSpace:"nowrap", transition:"all .15s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth:960, margin:"0 auto", padding:"22px 16px 40px" }}>
        {tab==="dashboard"    && <DashTab    {...shared} />}
        {tab==="renda"        && <RendaTab    {...shared} />}
        {tab==="fixas"        && <FixasTab   {...shared} />}
        {tab==="lancamentos"  && <LancTab    {...shared} />}
        {tab==="cartoes"      && <CartoesTab {...shared} />}
        {tab==="metas"        && <MetasTab   {...shared} />}
        {tab==="config"       && <ConfigTab  {...shared} household={household} members={members} supabase={supabase} />}
      </div>
    </div>
    </AppLock>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashTab({ memberA, memberB, salA, salB, fixA, fixB, varA, varB, cardA, cardB, totA, totB, pctA, pctB, ticket, catData, active, goals, mExp, mTxs }) {
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
          ⚠️ Cadastre os salários deste mês na aba <strong>Salários</strong> para ver os indicadores completos.
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:14 }}>
        {[
          { icon:"💵", title:"Renda Total",   value:fmt(totalIncome), sub:`${memberA} + ${memberB}`,     c:C.primary },
          { icon:"🏠", title:"Gastos Casa",   value:fmt(houseTotal),  sub:"Fixas + variáveis + cartões", c:C.danger  },
          { icon:"✅", title:"Saldo do Mês",   value:fmt(saldo),       sub:saldo>=0?"Livre p/ poupança":"Atenção!", c:saldo>=0?C.success:C.danger },
          ...(ticket>0?[{ icon:"🎟️", title:"Via Ticket", value:fmt(ticket), sub:"Não conta no saldo", c:C.muted }]:[]),
        ].map(({icon,title,value,sub,c})=>(
          <Card key={title} style={{ borderTop:`4px solid ${c}` }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
            <div style={{ fontSize:11, color:C.sub, fontWeight:700, textTransform:"uppercase", marginBottom:4 }}>{title}</div>
            <div style={{ fontSize:22, fontWeight:900, color:c, marginBottom:2 }}>{value}</div>
            <div style={{ fontSize:11, color:C.muted }}>{sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {[
          { name:memberA, sal:salA, tot:totA, fix:fixA, vari:varA+cardA, pct:pctA },
          { name:memberB, sal:salB, tot:totB, fix:fixB, vari:varB+cardB, pct:pctB },
        ].map(p=>(
          <Card key={p.name}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontWeight:800, fontSize:15 }}>👤 {p.name}</span>
              <Badge color={healthColor(p.pct)}>{healthLabel(p.pct)}</Badge>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14, fontSize:13 }}>
              {[["SALÁRIO",fmt(p.sal),C.text],["COMPROMETIDO",fmt(p.tot),"#ef4444"],["FIXAS",fmt(p.fix),C.text],["VARIÁVEIS",fmt(p.vari),C.text]].map(([l,v,c])=>(
                <div key={l}><div style={{ color:C.muted, fontSize:10, fontWeight:700, letterSpacing:".06em", marginBottom:2 }}>{l}</div><div style={{ fontWeight:700, color:c }}>{v}</div></div>
              ))}
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.sub, marginBottom:4 }}>
                <span>Comprometimento</span>
                <span style={{ color:healthColor(p.pct), fontWeight:800 }}>{p.sal>0?`${(p.pct*100).toFixed(1)}%`:"—"}</span>
              </div>
              <ProgressBar value={p.tot} max={p.sal} color={healthColor(p.pct)} height={10} />
            </div>
            <div style={{ background:"#f0fdf4", borderRadius:10, padding:"10px 13px", display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:"#166534", fontWeight:600 }}>Disponível</span>
              <span style={{ fontWeight:800, color:(p.sal-p.tot)>=0?"#16a34a":C.danger, fontSize:15 }}>{fmt(p.sal-p.tot)}</span>
            </div>
          </Card>
        ))}
      </div>

      {catData.length>0 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <Card>
            <STitle>Gastos por Categoria</STitle>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={12}>
                  {catData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip formatter={v=>fmt(v)}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 12px", marginTop:6 }}>
              {catData.map((c,i)=><span key={i} style={{ fontSize:11, color:C.sub, display:"flex", alignItems:"center", gap:4 }}><span style={{ width:8,height:8,borderRadius:"50%",background:c.color,display:"inline-block" }}/>{c.name}</span>)}
            </div>
          </Card>
          <Card>
            <STitle>Comprometimento</STitle>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                {name:memberA, Comprometido:totA, Disponível:Math.max(0,salA-totA)},
                {name:memberB, Comprometido:totB, Disponível:Math.max(0,salB-totB)},
              ]}>
                <XAxis dataKey="name" tick={{fontSize:13}}/>
                <YAxis tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v} tick={{fontSize:11}}/>
                <Tooltip formatter={v=>fmt(v)}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                <Bar dataKey="Comprometido" fill="#ef4444" radius={[5,5,0,0]}/>
                <Bar dataKey="Disponível"   fill="#10b981" radius={[5,5,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {goals.data.length>0 && (
        <Card>
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
        </Card>
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
            <Input type="number" placeholder="0,00" value={fvAmt} onChange={e=>setFvAmt(e.target.value)}/>
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
            <Input type="number" placeholder="0,00" value={fhAmt} onChange={e=>setFhAmt(e.target.value)}/>
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
                      <Field label="Valor recebido (R$)"><Input type="number" value={markAmt} onChange={e=>setMarkAmt(e.target.value)}/></Field>
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
          <Field label="Valor (R$)"><Input type="number" placeholder="0,00" value={form.amount} onChange={e=>f("amount")(e.target.value)}/></Field>
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
              return <div key={b.id} style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 14px", border:`1.5px solid ${C.border}`, borderRadius:13, opacity:off?.45:1 }}>
                <span style={{ fontSize:22, minWidth:28 }}>{cat.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{b.name} {off&&<Badge color={C.muted}>pausada</Badge>}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                    {b.split_type==="half"?`${memberA}:${fmt(s[memberA])} · ${memberB}:${fmt(s[memberB])}`:`${b.split_member} paga tudo`}
                    {b.due_day&&` · vence dia ${b.due_day}`}
                  </div>
                </div>
                <div style={{ fontWeight:900, fontSize:16, minWidth:90, textAlign:"right" }}>{fmt(b.amount)}</div>
                <div style={{ display:"flex", gap:5 }}>
                  <button onClick={()=>toggle(b.id)} style={{ background:"none", border:`1.5px solid ${C.border}`, borderRadius:8, width:32, height:32, cursor:"pointer" }}>{off?"▶":"⏸"}</button>
                  <button onClick={()=>edit(b)} style={{ background:"none", border:`1.5px solid ${C.border}`, borderRadius:8, width:32, height:32, cursor:"pointer" }}>✏️</button>
                  <button onClick={()=>del(b.id)} style={{ background:"none", border:`1.5px solid ${C.dLight}`, borderRadius:8, width:32, height:32, cursor:"pointer" }}>🗑️</button>
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
          <Field label="Valor (R$)"><Input type="number" placeholder="0,00" value={form.amount} onChange={e=>f("amount")(e.target.value)}/></Field>
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
function CartoesTab({ cards, txs, memberA, memberB, month, year, mTxs }) {
  const blankC = { name:"", bank:"", card_limit:"", closing_day:"", due_day:"", owner:"both" };
  const blankT = { card_id:"", description:"", category:"lazer", amount:"", split_type:"half", split_member:"", transaction_date:today() };
  const [cForm, setCF] = useState(blankC);
  const [tForm, setTF] = useState(blankT);

  const addCard = async () => { if(!cForm.name)return; await cards.insert({...cForm,card_limit:cForm.card_limit?Number(cForm.card_limit):null,closing_day:cForm.closing_day?Number(cForm.closing_day):null,due_day:cForm.due_day?Number(cForm.due_day):null}); setCF(blankC); };
  const delCard = async id => { if(!confirm("Excluir cartão e transações?"))return; await cards.remove(id); txs.data.filter(t=>t.card_id===id).forEach(t=>txs.remove(t.id)); };
  const addTx   = async () => { if(!tForm.card_id||!tForm.description||!tForm.amount)return; await txs.insert({...tForm,amount:Number(tForm.amount),month,year}); setTF(p=>({...p,description:"",amount:""})); };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <Card>
        <STitle>➕ Novo Cartão</STitle>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <Field label="Apelido" span={2}><Input placeholder="Ex: Nubank Vittor" value={cForm.name} onChange={e=>setCF(p=>({...p,name:e.target.value}))}/></Field>
          <Field label="Banco / Bandeira"><Input placeholder="Ex: Nubank Mastercard" value={cForm.bank} onChange={e=>setCF(p=>({...p,bank:e.target.value}))}/></Field>
          <Field label="Dono"><Select value={cForm.owner} onChange={e=>setCF(p=>({...p,owner:e.target.value}))}><option value="both">Ambos</option><option value={memberA}>{memberA}</option><option value={memberB}>{memberB}</option></Select></Field>
          <Field label="Limite (R$)"><Input type="number" value={cForm.card_limit} onChange={e=>setCF(p=>({...p,card_limit:e.target.value}))}/></Field>
          <Field label="Dia fechamento"><Input type="number" placeholder="25" min={1} max={31} value={cForm.closing_day} onChange={e=>setCF(p=>({...p,closing_day:e.target.value}))}/></Field>
          <Field label="Dia vencimento"><Input type="number" placeholder="5"  min={1} max={31} value={cForm.due_day}     onChange={e=>setCF(p=>({...p,due_day:e.target.value}))}/></Field>
        </div>
        <Btn onClick={addCard} style={{ width:"100%" }}>Adicionar Cartão</Btn>
      </Card>

      {cards.data.length>0&&(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:13 }}>
          {cards.data.map(c=>{
            const spent=mTxs.filter(t=>t.card_id===c.id).reduce((a,t)=>a+Number(t.amount),0);
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

      {cards.data.length>0&&(
        <Card>
          <STitle>💸 Lançar na Fatura</STitle>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <Field label="Cartão"><Select value={tForm.card_id} onChange={e=>setTF(p=>({...p,card_id:e.target.value}))}><option value="">Selecione…</option>{cards.data.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Categoria"><Select value={tForm.category} onChange={e=>setTF(p=>({...p,category:e.target.value}))}>{Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}</Select></Field>
            <Field label="Descrição" span={2}><Input placeholder="Ex: iFood, Amazon…" value={tForm.description} onChange={e=>setTF(p=>({...p,description:e.target.value}))}/></Field>
            <Field label="Valor (R$)"><Input type="number" value={tForm.amount} onChange={e=>setTF(p=>({...p,amount:e.target.value}))}/></Field>
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

      {mTxs.length>0&&(
        <Card>
          <STitle>🧾 Faturas — {MONTHS_FULL[month]} {year}</STitle>
          {cards.data.map(c=>{
            const ts=mTxs.filter(t=>t.card_id===c.id).sort((a,b)=>b.transaction_date.localeCompare(a.transaction_date));
            if(!ts.length) return null;
            const tot=ts.reduce((a,t)=>a+Number(t.amount),0);
            return <div key={c.id} style={{ marginBottom:18 }}>
              <div style={{ fontWeight:800, fontSize:14, color:C.primary, marginBottom:8, paddingBottom:6, borderBottom:`1.5px solid ${C.border}` }}>💳 {c.name} — <span style={{ color:C.danger }}>{fmt(tot)}</span></div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {ts.map(t=>{
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
              </div>
            </div>;
          })}
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
        <div style={{ background:`linear-gradient(135deg,${C.header},#5b21b6)`, borderRadius:18, padding:"20px 22px", color:"#fff" }}>
          <div style={{ fontWeight:900, fontSize:16, marginBottom:6 }}>🛡️ Reserva de Emergência Recomendada</div>
          <p style={{ margin:"0 0 14px", opacity:.85, fontSize:13 }}>Com gastos mensais estimados de <strong>{fmt(est)}</strong>:</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {[["3 meses (mínimo)",est*3],["6 meses (ideal)",est*6]].map(([l,v])=>(
              <div key={l} style={{ background:"rgba(255,255,255,.15)", borderRadius:12, padding:"12px 16px" }}>
                <div style={{ fontSize:11, opacity:.75, fontWeight:700, textTransform:"uppercase" }}>{l}</div>
                <div style={{ fontSize:22, fontWeight:900, marginTop:4 }}>{fmt(v)}</div>
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
          <Field label="Valor alvo (R$)"><Input type="number" placeholder="0,00" value={form.target_amount} onChange={e=>setForm(p=>({...p,target_amount:e.target.value}))}/></Field>
          <Field label="Já guardaram (R$)"><Input type="number" placeholder="0,00" value={form.current_amount} onChange={e=>setForm(p=>({...p,current_amount:e.target.value}))}/></Field>
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
              ? <div style={{ display:"flex", gap:8 }}><Input type="number" placeholder="Valor depositado…" value={dep} onChange={e=>setDep(e.target.value)} style={{ flex:1 }}/><Btn onClick={()=>deposit(g.id)}>💾 Salvar</Btn><Btn variant="ghost" onClick={()=>{setDepId(null);setDep("");}}>Cancelar</Btn></div>
              : <Btn variant="ghost" onClick={()=>setDepId(g.id)} style={{ width:"100%" }}>➕ Registrar Depósito</Btn>
            }
          </div>
        </Card>;
      })}
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
