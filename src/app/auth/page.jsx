"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const C = {
  bg: "#f0f4ff", primary: "#4f46e5", success: "#059669",
  danger: "#dc2626", border: "#e2e8f0", muted: "#94a3b8",
  text: "#1e1b4b", card: "#ffffff", header: "#312e81",
};

const inp = {
  width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10,
  padding: "12px 14px", fontSize: 15, outline: "none", fontFamily: "inherit",
  boxSizing: "border-box", color: C.text, background: "#fff",
};

// mode: "login" | "register" | "reset" | "new_password"
export default function AuthPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [mode,        setMode]    = useState("login");
  const [email,       setEmail]   = useState("");
  const [password,    setPassword] = useState("");
  const [newPass,     setNewPass] = useState("");
  const [loading,     setLoading] = useState(false);
  const [error,       setError]   = useState("");
  const [info,        setInfo]    = useState("");

  // Detecta link de redefinição de senha no hash da URL
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setMode("new_password");
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard"); router.refresh();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    setInfo("Conta criada! Verifique seu e-mail para confirmar e depois faça login.");
    setMode("login"); setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setInfo("Link enviado! Verifique seu e-mail e clique no link para redefinir a senha.");
    setLoading(false);
  };

  const handleNewPassword = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) { setError(error.message); setLoading(false); return; }
    setInfo("Senha atualizada com sucesso! Redirecionando…");
    setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1500);
    setLoading(false);
  };

  // ── Tela de nova senha (após clicar no link do e-mail) ────────────────────
  if (mode === "new_password") return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.card, borderRadius:24, padding:"36px 32px", width:"100%", maxWidth:400, boxShadow:"0 8px 32px rgba(79,70,229,.13)" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🔑</div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:900, color:C.text }}>Nova senha</h1>
          <p style={{ margin:"4px 0 0", color:C.muted, fontSize:14 }}>Digite sua nova senha de acesso</p>
        </div>
        <form onSubmit={handleNewPassword} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:".06em" }}>Nova senha</label>
            <input type="password" required placeholder="mínimo 8 caracteres" minLength={8}
              value={newPass} onChange={e=>setNewPass(e.target.value)} style={inp} />
          </div>
          {error && <div style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:10, padding:"10px 14px", color:C.danger, fontSize:13 }}>❌ {error}</div>}
          {info  && <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:10, padding:"10px 14px", color:C.success, fontSize:13 }}>✅ {info}</div>}
          <button type="submit" disabled={loading} style={{
            background:C.primary, color:"#fff", border:"none", borderRadius:12,
            padding:"13px 0", fontSize:16, fontWeight:800, cursor:"pointer",
            opacity:loading?.7:1, fontFamily:"inherit",
          }}>
            {loading ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );

  // ── Tela de recuperação de senha ─────────────────────────────────────────
  if (mode === "reset") return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.card, borderRadius:24, padding:"36px 32px", width:"100%", maxWidth:400, boxShadow:"0 8px 32px rgba(79,70,229,.13)" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>📧</div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:900, color:C.text }}>Esqueci minha senha</h1>
          <p style={{ margin:"4px 0 0", color:C.muted, fontSize:14 }}>Vamos enviar um link no seu e-mail</p>
        </div>
        <form onSubmit={handleReset} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:".06em" }}>E-mail</label>
            <input type="email" required placeholder="seu@email.com"
              value={email} onChange={e=>setEmail(e.target.value)} style={inp} />
          </div>
          {error && <div style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:10, padding:"10px 14px", color:C.danger, fontSize:13 }}>❌ {error}</div>}
          {info  && <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:10, padding:"10px 14px", color:C.success, fontSize:13 }}>✅ {info}</div>}
          {!info && (
            <button type="submit" disabled={loading} style={{
              background:C.primary, color:"#fff", border:"none", borderRadius:12,
              padding:"13px 0", fontSize:16, fontWeight:800, cursor:"pointer",
              opacity:loading?.7:1, fontFamily:"inherit",
            }}>
              {loading ? "Enviando…" : "Enviar link de redefinição"}
            </button>
          )}
          <button type="button" onClick={()=>{setMode("login");setError("");setInfo("");}} style={{
            background:"none", border:"none", color:C.muted, fontSize:14,
            cursor:"pointer", fontFamily:"inherit", padding:"4px 0",
          }}>
            ← Voltar para o login
          </button>
        </form>
      </div>
    </div>
  );

  // ── Tela principal (login / criar conta) ──────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.card, borderRadius:24, padding:"36px 32px", width:"100%", maxWidth:400, boxShadow:"0 8px 32px rgba(79,70,229,.13)" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:56, height:56, borderRadius:"50%", background:C.header, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:"#fff", margin:"0 auto 12px", letterSpacing:-1 }}>V♥H</div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:900, color:C.text }}>Finanças da Casa</h1>
          <p style={{ margin:"4px 0 0", color:C.muted, fontSize:14 }}>Gestão financeira para casais</p>
        </div>

        {/* Toggle login / criar conta */}
        <div style={{ display:"flex", background:"#f1f5f9", borderRadius:12, padding:4, marginBottom:24 }}>
          {[["login","Entrar"],["register","Criar conta"]].map(([m,l])=>(
            <button key={m} onClick={()=>{setMode(m);setError("");setInfo("");}} style={{
              flex:1, padding:"9px 0", border:"none", borderRadius:9, fontSize:14, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit",
              background:mode===m?C.card:"transparent", color:mode===m?C.primary:C.muted,
              boxShadow:mode===m?"0 1px 4px rgba(0,0,0,.08)":"none", transition:"all .15s",
            }}>{l}</button>
          ))}
        </div>

        <form onSubmit={mode==="login"?handleLogin:handleRegister} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:".06em" }}>E-mail</label>
            <input type="email" required placeholder="seu@email.com"
              value={email} onChange={e=>setEmail(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:C.muted, display:"block", marginBottom:5, textTransform:"uppercase", letterSpacing:".06em" }}>Senha</label>
            <input type="password" required placeholder={mode==="register"?"mínimo 8 caracteres":"••••••••"}
              minLength={8} value={password} onChange={e=>setPassword(e.target.value)} style={inp} />
          </div>

          {error && <div style={{ background:"#fef2f2", border:"1.5px solid #fca5a5", borderRadius:10, padding:"10px 14px", color:C.danger, fontSize:13 }}>❌ {error}</div>}
          {info  && <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:10, padding:"10px 14px", color:C.success, fontSize:13 }}>✅ {info}</div>}

          <button type="submit" disabled={loading} style={{
            background:C.primary, color:"#fff", border:"none", borderRadius:12,
            padding:"13px 0", fontSize:16, fontWeight:800, cursor:"pointer",
            marginTop:4, opacity:loading?.7:1, fontFamily:"inherit",
          }}>
            {loading ? "Aguarde…" : mode==="login" ? "Entrar" : "Criar conta"}
          </button>

          {/* Esqueci minha senha — só aparece no modo login */}
          {mode === "login" && (
            <button type="button" onClick={()=>{setMode("reset");setError("");setInfo("");}} style={{
              background:"none", border:"none", color:C.muted, fontSize:13,
              cursor:"pointer", fontFamily:"inherit", textAlign:"center",
              textDecoration:"underline", padding:"2px 0",
            }}>
              Esqueci minha senha
            </button>
          )}
        </form>

        <p style={{ textAlign:"center", fontSize:12, color:C.muted, marginTop:20, lineHeight:1.6 }}>
          Seus dados são protegidos com criptografia e isolamento por família.
        </p>
      </div>
    </div>
  );
}
