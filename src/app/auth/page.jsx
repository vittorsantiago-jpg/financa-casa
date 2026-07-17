"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const C = {
  bg: "#f0f4ff", header: "#312e81", primary: "#4f46e5",
  success: "#059669", danger: "#dc2626", border: "#e2e8f0",
  muted: "#94a3b8", text: "#1e1b4b", card: "#ffffff",
};

const inp = {
  width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10,
  padding: "12px 14px", fontSize: 15, outline: "none", fontFamily: "inherit",
  boxSizing: "border-box", color: C.text,
};

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode]         = useState("login"); // "login" | "register"
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [info, setInfo]         = useState("");

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      router.push("/dashboard");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      setInfo("Conta criada! Verifique seu e-mail para confirmar e depois faça login.");
      setMode("login");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.card, borderRadius:24, padding:"36px 32px", width:"100%", maxWidth:400, boxShadow:"0 8px 32px rgba(79,70,229,.13)" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:56, height:56, borderRadius:"50%", background:C.header, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:900, color:"#fff", margin:"0 auto 12px", letterSpacing:-1 }}>V♥H</div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:900, color:C.text }}>Finanças da Casa</h1>
          <p style={{ margin:"4px 0 0", color:C.muted, fontSize:14 }}>Gestão financeira para casais</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display:"flex", background:"#f1f5f9", borderRadius:12, padding:4, marginBottom:24 }}>
          {[["login","Entrar"],["register","Criar conta"]].map(([m,l]) => (
            <button key={m} onClick={()=>{setMode(m);setError("");setInfo("");}} style={{
              flex:1, padding:"9px 0", border:"none", borderRadius:9, fontSize:14, fontWeight:700,
              cursor:"pointer", background:mode===m?C.card:"transparent", color:mode===m?C.primary:C.muted,
              boxShadow:mode===m?"0 1px 4px rgba(0,0,0,.08)":"none", transition:"all .15s",
            }}>{l}</button>
          ))}
        </div>

        <form onSubmit={handle} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:".06em" }}>E-mail</label>
            <input type="email" required placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:".06em" }}>Senha</label>
            <input type="password" required placeholder={mode==="register"?"mínimo 8 caracteres":"••••••••"} minLength={8} value={password} onChange={e=>setPassword(e.target.value)} style={inp} />
          </div>

          {error && <div style={{ background:"#fef2f2", border:`1.5px solid #fca5a5`, borderRadius:10, padding:"10px 14px", color:C.danger, fontSize:13 }}>❌ {error}</div>}
          {info  && <div style={{ background:"#f0fdf4", border:`1.5px solid #86efac`, borderRadius:10, padding:"10px 14px", color:C.success, fontSize:13 }}>✅ {info}</div>}

          <button type="submit" disabled={loading} style={{
            background:C.primary, color:"#fff", border:"none", borderRadius:12, padding:"13px 0",
            fontSize:16, fontWeight:800, cursor:loading?"wait":"pointer", marginTop:4,
            opacity:loading?.7:1, transition:"opacity .15s",
          }}>
            {loading ? "Aguarde…" : mode==="login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p style={{ textAlign:"center", fontSize:12, color:C.muted, marginTop:20, lineHeight:1.6 }}>
          Seus dados são protegidos com criptografia e isolamento por família.
        </p>
      </div>
    </div>
  );
}
