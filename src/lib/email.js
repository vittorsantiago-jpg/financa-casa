import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);
export const FROM   = process.env.EMAIL_FROM || "financas@mail.lapidio.com.br";
export const APP_URL = "https://financas.lapidio.com.br";

const fmt = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

// ── Base layout ───────────────────────────────────────────────────────────────
export const baseTemplate = (content, preheader = "") => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Finanças da Casa</title>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${preheader}</div>` : ""}
</head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(79,70,229,.10)">

        <!-- Header -->
        <tr>
          <td style="background:#312e81;padding:28px 32px;text-align:center">
            <div style="font-size:32px;margin-bottom:8px">💜</div>
            <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px">Finanças da Casa</div>
            <div style="color:rgba(255,255,255,.6);font-size:13px;margin-top:3px">Gestão financeira para casais</div>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:32px 36px">${content}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">
            <div style="color:#94a3b8;font-size:12px;line-height:1.6">
              Finanças da Casa · <a href="${APP_URL}" style="color:#4f46e5;text-decoration:none">financas.lapidio.com.br</a><br>
              Este email foi enviado automaticamente, não é necessário responder.
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ── Botão CTA ─────────────────────────────────────────────────────────────────
export const ctaBtn = (text, url) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0">
    <tr><td align="center">
      <a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:12px;letter-spacing:0.2px">${text}</a>
    </td></tr>
  </table>`;

// ── Caixa de destaque (para código de convite etc.) ────────────────────────────
export const highlightBox = (label, value, color = "#4f46e5") => `
  <div style="background:#f0f4ff;border:2px dashed ${color};border-radius:14px;padding:20px;text-align:center;margin:20px 0">
    <div style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">${label}</div>
    <div style="color:${color};font-size:32px;font-weight:900;letter-spacing:6px">${value}</div>
  </div>`;

// ── Linha de separação ─────────────────────────────────────────────────────────
export const divider = `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">`;

// ── Linha de valor (para resumo) ──────────────────────────────────────────────
export const summaryRow = (label, value, color = "#1e1b4b", bold = false) => `
  <tr>
    <td style="padding:8px 0;color:#64748b;font-size:14px">${label}</td>
    <td style="padding:8px 0;text-align:right;color:${color};font-size:14px;font-weight:${bold ? 800 : 500}">${value}</td>
  </tr>`;

// ── Templates de email ────────────────────────────────────────────────────────

export const welcomeHtml = ({ name, householdName }) =>
  baseTemplate(`
    <h1 style="margin:0 0 8px;color:#1e1b4b;font-size:24px;font-weight:900">Bem-vindo, ${name}! 👋</h1>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.6">
      Sua conta foi criada com sucesso. A casa <strong style="color:#4f46e5">${householdName}</strong> está configurada e pronta para usar.
    </p>
    ${divider}
    <p style="margin:0 0 12px;color:#1e1b4b;font-size:14px;font-weight:700">O que você pode fazer agora:</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${[
        ["💰", "Registrar sua renda mensal"],
        ["📋", "Cadastrar suas contas fixas"],
        ["💳", "Adicionar cartões e faturas"],
        ["🎯", "Criar metas de poupança"],
        ["📉", "Acompanhar suas dívidas"],
      ].map(([icon, text]) => `
        <tr>
          <td style="padding:6px 0;width:32px;font-size:18px">${icon}</td>
          <td style="padding:6px 0;color:#475569;font-size:14px">${text}</td>
        </tr>`).join("")}
    </table>
    ${ctaBtn("Acessar o app →", APP_URL)}
    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center">
      Seus dados são protegidos com criptografia e isolamento por família.
    </p>
  `, `Bem-vindo ao Finanças da Casa, ${name}!`);

export const inviteHtml = ({ inviterName, inviteCode, householdName }) =>
  baseTemplate(`
    <h1 style="margin:0 0 8px;color:#1e1b4b;font-size:22px;font-weight:900">${inviterName} te convidou! 💜</h1>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.6">
      Você foi convidado para gerenciar as finanças da casa <strong style="color:#4f46e5">${householdName}</strong> juntos.
    </p>
    ${highlightBox("Seu código de convite", inviteCode)}
    <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6">
      Para entrar, siga estes passos:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${[
        ["1️⃣", "Acesse o app no link abaixo"],
        ["2️⃣", 'Clique em <strong>"Criar conta"</strong>'],
        ["3️⃣", 'Depois em <strong>"Entrar com código"</strong>'],
        ["4️⃣", "Digite o código acima"],
      ].map(([icon, text]) => `
        <tr>
          <td style="padding:6px 0;width:32px;font-size:18px">${icon}</td>
          <td style="padding:6px 0;color:#475569;font-size:14px">${text}</td>
        </tr>`).join("")}
    </table>
    ${ctaBtn("Criar minha conta →", `${APP_URL}/auth`)}
  `, `${inviterName} te convidou para o Finanças da Casa`);

export const reminderHtml = ({ memberName, bills }) =>
  baseTemplate(`
    <h1 style="margin:0 0 8px;color:#1e1b4b;font-size:22px;font-weight:900">⚠️ Conta(s) vencendo em breve</h1>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px;line-height:1.6">
      Olá, <strong>${memberName}</strong>! As seguintes contas vencem nos próximos 2 dias:
    </p>
    ${bills.map(b => `
      <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:10px;padding:14px 16px;margin-bottom:12px">
        <div style="color:#1e1b4b;font-size:15px;font-weight:700">${b.name}</div>
        <div style="color:#64748b;font-size:13px;margin-top:4px">
          Vence dia <strong>${b.due_day}</strong> · <strong style="color:#ef4444">${fmt(b.amount)}</strong>
        </div>
      </div>`).join("")}
    ${ctaBtn("Ver no app →", `${APP_URL}`)}
  `, `${bills.length} conta(s) vencendo em breve`);

export const summaryHtml = ({ memberName, monthName, income, expenses, balance, categories, goals }) =>
  baseTemplate(`
    <h1 style="margin:0 0 4px;color:#1e1b4b;font-size:22px;font-weight:900">📊 Resumo de ${monthName}</h1>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px">Olá, <strong>${memberName}</strong>! Aqui está um resumo do mês passado.</p>

    <!-- Totais -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
      ${summaryRow("💰 Renda recebida", fmt(income), "#16a34a", true)}
      ${summaryRow("🏠 Total de gastos", fmt(expenses), "#ef4444", true)}
      ${divider.replace('<hr', '<tr><td colspan="2"><hr')}
      ${summaryRow("✅ Saldo do mês", fmt(balance), balance >= 0 ? "#16a34a" : "#ef4444", true)}
    </table>

    ${categories.length > 0 ? `
      <p style="margin:0 0 10px;color:#1e1b4b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Top categorias</p>
      ${categories.slice(0, 4).map(c => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9">
          <span style="color:#475569;font-size:14px">${c.name}</span>
          <span style="color:#1e1b4b;font-size:14px;font-weight:600">${fmt(c.value)}</span>
        </div>`).join("")}
    ` : ""}

    ${goals.length > 0 ? `
      ${divider}
      <p style="margin:0 0 10px;color:#1e1b4b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">🎯 Metas</p>
      ${goals.map(g => `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="color:#475569;font-size:13px">${g.name}</span>
            <span style="color:#4f46e5;font-size:13px;font-weight:700">${Math.round(g.pct)}%</span>
          </div>
          <div style="background:#e2e8f0;border-radius:6px;height:6px">
            <div style="background:#4f46e5;border-radius:6px;height:6px;width:${Math.min(g.pct, 100)}%"></div>
          </div>
        </div>`).join("")}
    ` : ""}

    ${ctaBtn("Ver detalhes no app →", APP_URL)}
  `, `Resumo financeiro de ${monthName}`);
