"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const lsGet = (uid, k)    => { try { return localStorage.getItem(`fvh_${uid}_${k}`); }  catch { return null; } };
const lsSet = (uid, k, v) => { try { localStorage.setItem(`fvh_${uid}_${k}`, v); }      catch {} };
const lsDel = (uid, k)    => { try { localStorage.removeItem(`fvh_${uid}_${k}`); }      catch {} };

async function hashPin(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("fvh2024_salt_" + pin));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export default function AppLock({ children }) {
  const [status,  setStatus]  = useState("loading");
  const [userId,  setUserId]  = useState(null);
  const [pin,     setPin]     = useState("");
  const [setup1,  setSetup1]  = useState("");
  const [hasBio,  setHasBio]  = useState(false);
  const [bioReg,  setBioReg]  = useState(false);
  const [error,   setError]   = useState("");
  const TIMEOUT = 2 * 60 * 1000;

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStatus("unlocked"); return; }
      const uid = user.id;
      setUserId(uid);
      const hash = lsGet(uid, "pin_hash");
      const cid  = lsGet(uid, "bio_cid");
      let bioOk = false;
      if (window.PublicKeyCredential) {
        bioOk = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
        setHasBio(bioOk); setBioReg(!!cid);
      }
      if (!hash) { setStatus("setup"); return; }
      setStatus("locked");
      if (bioOk && cid) setTimeout(() => triggerBio(uid, cid), 500);
    };
    init();
    let bgTs = null;
    const onVis = () => {
      if (document.hidden) bgTs = Date.now();
      else if (bgTs && Date.now() - bgTs > TIMEOUT) { setStatus("locked"); setPin(""); bgTs = null; }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const triggerBio = async (uid, cidStr) => {
    try {
      const cid = Uint8Array.from(atob(cidStr), c => c.charCodeAt(0));
      await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ id: cid, type: "public-key" }], userVerification: "required", timeout: 60000 } });
      setStatus("unlocked"); setPin(""); setError("");
    } catch { setError("Biometria cancelada — use o PIN."); }
  };

  const registerBio = async () => {
    if (!userId) return;
    try {
      const cred = await navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: "Finanças da Casa", id: window.location.hostname }, user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "usuario", displayName: "Usuário" }, pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }], authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" }, timeout: 60000 } });
      lsSet(userId, "bio_cid", btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
      setBioReg(true); setStatus("unlocked");
    } catch { setStatus("unlocked"); }
  };

  const tap = async (d) => {
    if (!userId) return;
    setError("");
    if (d === "⌫") { setPin(p => p.slice(0, -1)); return; }
    const np = pin + d;
    setPin(np);
    if (np.length < 6) return;
    await new Promise(r => setTimeout(r, 80));
    if (status === "setup") {
      setSetup1(np); setStatus("setup_confirm"); setPin("");
    } else if (status === "setup_confirm") {
      if (np === setup1) {
        lsSet(userId, "pin_hash", await hashPin(np));
        setPin(""); setSetup1("");
        hasBio ? setStatus("bio_setup") : setStatus("unlocked");
      } else {
        setError("PINs não conferem. Tente novamente.");
        setPin(""); setSetup1(""); setStatus("setup");
      }
    } else if (status === "locked") {
      const stored = lsGet(userId, "pin_hash");
      if ((await hashPin(np)) === stored) { setStatus("unlocked"); setPin(""); }
      else { setError("PIN incorreto. Tente novamente."); setPin(""); }
    }
  };

  const resetPin = () => {
    if (!userId || !confirm("Redefinir o PIN vai apagar a biometria cadastrada. Continuar?")) return;
    lsDel(userId, "pin_hash"); lsDel(userId, "bio_cid");
    setBioReg(false); setStatus("setup"); setPin("");
  };

  if (status === "loading") return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#312e81", flexDirection:"column", gap:12, fontFamily:"system-ui,sans-serif" }}>
      <div style={{ fontSize:36 }}>💜</div>
      <p style={{ color:"#a5b4fc", fontWeight:700, margin:0 }}>Carregando…</p>
    </div>
  );

  if (status === "unlocked") return <>{children}</>;

  if (status === "bio_setup") return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#312e81", padding:24, fontFamily:"system-ui,sans-serif" }}>
      <div style={{ background:"#1e1b4b", borderRadius:24, padding:"36px 28px", maxWidth:340, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:52, marginBottom:16 }}>🔑</div>
        <h2 style={{ color:"#fff", fontWeight:900, fontSize:20, margin:"0 0 10px" }}>Ativar desbloqueio por digital?</h2>
        <p style={{ color:"#a5b4fc", fontSize:14, margin:"0 0 28px", lineHeight:1.7 }}>Na próxima abertura do app, você entra com sua <strong>digital ou Face ID</strong> em vez de digitar o PIN.</p>
        <button onClick={registerBio} style={{ width:"100%", background:"#4f46e5", color:"#fff", border:"none", borderRadius:14, padding:"14px 0", fontSize:16, fontWeight:800, cursor:"pointer", marginBottom:12, fontFamily:"inherit" }}>🔐 Ativar Digital / Face ID</button>
        <button onClick={() => setStatus("unlocked")} style={{ width:"100%", background:"transparent", color:"rgba(255,255,255,.45)", border:"none", padding:"10px 0", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>Agora não</button>
      </div>
    </div>
  );

  const LABELS = { setup: ["Crie seu PIN", "6 dígitos que só você saberá"], setup_confirm: ["Confirme seu PIN", "Digite o mesmo PIN de novo"], locked: ["Finanças da Casa", "Digite seu PIN para entrar"] };
  const [title, sub] = LABELS[status] || ["", ""];
  const keys = [1,2,3,4,5,6,7,8,9, "bio", 0, "⌫"];

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:"#312e81", fontFamily:"system-ui,sans-serif", WebkitTapHighlightColor:"transparent", userSelect:"none" }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24, width:"100%", maxWidth:300, padding:"0 24px" }}>
        <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(255,255,255,.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, color:"#fff" }}>💜</div>
        <div style={{ textAlign:"center" }}>
          <div style={{ color:"#fff", fontWeight:900, fontSize:20, marginBottom:4 }}>{title}</div>
          <div style={{ color:"#a5b4fc", fontSize:13 }}>{sub}</div>
        </div>
        <div style={{ display:"flex", gap:18 }}>
          {[...Array(6)].map((_, i) => <div key={i} style={{ width:13, height:13, borderRadius:"50%", border:"2px solid rgba(255,255,255,.45)", background: i < pin.length ? "#fff" : "transparent", transition:"background .1s" }} />)}
        </div>
        {error && <div style={{ color:"#fca5a5", fontSize:13, textAlign:"center", fontWeight:600 }}>{error}</div>}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:11, width:"100%" }}>
          {keys.map((k, i) => {
            const isBio = k === "bio";
            const showBio = isBio && status === "locked" && bioReg && hasBio;
            if (isBio && !showBio) return <div key={i} />;
            return (
              <button key={i}
                onClick={() => { if (isBio) { const cid = lsGet(userId, "bio_cid"); if (cid) triggerBio(userId, cid); } else tap(k); }}
                style={{ background:"rgba(255,255,255,.13)", border:"none", borderRadius:14, padding:"17px 0", fontSize: typeof k === "number" ? 23 : 22, fontWeight: typeof k === "number" ? 700 : 400, color:"#fff", cursor:"pointer", WebkitTapHighlightColor:"transparent", fontFamily:"inherit" }}
                onPointerDown={e => e.currentTarget.style.background = "rgba(255,255,255,.26)"}
                onPointerUp={e => e.currentTarget.style.background = "rgba(255,255,255,.13)"}
                onPointerLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.13)"}
              >{isBio ? "🔑" : k}</button>
            );
          })}
        </div>
        {status === "locked" && <button onClick={resetPin} style={{ background:"none", border:"none", color:"rgba(255,255,255,.3)", fontSize:12, cursor:"pointer", marginTop:4, fontFamily:"inherit" }}>Esqueci meu PIN</button>}
      </div>
    </div>
  );
}
