"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const C = {
  bg:"#f0f4ff", header:"#312e81", primary:"#4f46e5", success:"#059669",
  danger:"#dc2626", border:"#e2e8f0", muted:"#94a3b8", text:"#1e1b4b", card:"#ffffff",
};
const inp = {
  width:"100%", border:`1.5px solid ${C.border}`, borderRadius:10,
  padding:"12px 14px", fontSize:15, outline:"none", fontFamily:"inherit",
  boxSizing:"border-box", color:C.text,
};

export default function SetupPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [mode, setMode]           = useState("create"); // "create" | "join"
  const [displayName, setName]    = useState("");
  const [householdName, setHname] = useState("");
  const [inviteCode, setCode]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const createHousehold = async () => {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sessão expirada. Faça login novamente."); setLoading(false); return; }

    // 1. Criar household
    const { data: hh, error: e1 } = await supabase
      .from("households")
      .insert({ name: householdName.trim() })
      .select()
      .single();
    if (e1) { setError(e1.message); setLoading(false); return; }

    // 2. Adicionar usuário como owner
    const { error: e2 } = await supabase
      .from("household_members")
      .insert({ household_id: hh.id, user_id: user.id, display_name: displayName.trim(), role: "owner" });
    if (e2) { setError(e2.message); setLoading(false); return; }

    router.push("/dashboard");
    router.refresh();
  };

  const joinHousehold = async () => {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sessão expirada."); setLoading(false); return; }

    // Buscar household pelo código de convite
    const { data: hh, error: e1 } = await supabase
      .from("households")
      .select("id, name")
      .eq("invite_code", inviteCode.trim().toUpperCase())
      .single();
    if (e1 || !hh) { setError("Código de convite inválido ou expirado."); setLoading(false); return; }

    // Verificar se já é membro
    const { data: existing } = await supabase
      .from("household_members")
      .select("id")
      .eq("household_id", hh.id)
      .eq("user_id", user.id)
      .single();
    if (existing) { setError("Você já faz parte desta casa."); setLoading(false); return; }

    // Entrar como member
    const { error: e2 } = await supabase
      .from("household_members")
      .insert({ household_id: hh.id, user_id: user.id, display_name: displayName.trim(), role: "member" });
    if (e2) { setError(e2.message); setLoading(false); return; }

    router.push("/dashboard");
    router.refresh();
  };

  const submit = (e) => { e.preventDefault(); mode === "create" ? createHousehold() : joinHousehold(); };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.card, borderRadius:24, padding:"36px 32px", width:"100%", maxWidth:440, boxShadow:"0 8px 32px rgba(79,70,229,.13)" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🏠</div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:900, color:C.text }}>Configure sua Casa</h1>
          <p style={{ margin:"4px 0 0", color:C.muted, fontSize:14 }}>Crie uma nova casa ou entre na de alguém</p>
        </div>

        <div style={{ display:"flex", background:"#f1f5f9", borderRadius:12, padding:4, marginBottom:24 }}>
          {[["create","Criar nova casa"],["join","Entrar com código"]].map(([m,l])=>(
            <button key={m} onClick={()=>{setMode(m);setError("");}} style={{
              flex:1, padding:"9px 0", border:"none", borderRadius:9, fontSize:13, fontWeight:700,
              cursor:"pointer", background:mode===m?C.card:"transparent", color:mode===m?C.primary:C.muted,
              boxShadow:mode===m?"0 1px 4px rgba(0,0,0,.08)":"none", transition:"all .15s",
            }}>{l}</button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase" }}>Seu nome</label>
            <input required placeholder="Ex: Vittor" value={displayName} onChange={e=>setName(e.target.value)} style={inp} />
          </div>

          {mode === "create" ? (
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase" }}>Nome da casa</label>
              <input required placeholder="Ex: Casa Vittor & Hemerson" value={householdName} onChange={e=>setHname(e.target.value)} style={inp} />
            </div>
          ) : (
            <div>
              <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase" }}>Código de convite</label>
              <input required placeholder="Ex: AB1C2D" value={inviteCode} onChange={e=>setCode(e.target.value)} style={{ ...inp, textTransform:"uppercase", letterSpacing:".12em", fontWeight:700 }} maxLength={8} />
              <p style={{ margin:"6px 0 0", fontSize:12, color:C.muted }}>Peça o código para quem criou a casa.</p>
            </div>
          )}

          {error && <div style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:10, padding:"10px 14px", color:C.danger, fontSize:13 }}>❌ {error}</div>}

          {mode === "create" && (
            <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#166534" }}>
              💡 Após criar, você receberá um <strong>código de convite</strong> para compartilhar com seu parceiro.
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            background:C.primary, color:"#fff", border:"none", borderRadius:12, padding:"13px 0",
            fontSize:16, fontWeight:800, cursor:loading?"wait":"pointer", opacity:loading?.7:1, marginTop:4,
          }}>
            {loading ? "Aguarde…" : mode==="create" ? "Criar Casa" : "Entrar na Casa"}
          </button>
        </form>
      </div>
    </div>
  );
}
