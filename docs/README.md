# 💜 Finanças da Casa

Sistema de gestão financeira doméstica compartilhada.
Construído para Vittor & Hemerson — mas arquitetado para ser seguro, multi-tenant e extensível para outros casais.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│              BROWSER / PWA (celular ou desktop)         │
│   Next.js 14 (React) — Client Components               │
│   AppLock: PIN 6 dígitos + Biometria (WebAuthn)        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│                  VERCEL (Edge)                          │
│   Middleware: valida JWT + protege todas as rotas      │
│   Deploy automático a cada push no GitHub              │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                 SUPABASE                                │
│   Auth: e-mail/senha + redefinição de senha            │
│   Database: PostgreSQL com RLS                         │
│   Realtime: WebSocket para sync instantâneo            │
│   RPC: funções SECURITY DEFINER para operações críticas│
└─────────────────────────────────────────────────────────┘
```

---

## Segurança

### Camadas de proteção

| Camada | Mecanismo | Onde |
|--------|-----------|------|
| Bloqueio local | PIN 6 dígitos + Biometria (WebAuthn) | AppLock no browser |
| Autenticação | JWT via Supabase Auth | Middleware Next.js |
| Autorização | Row Level Security (RLS) | PostgreSQL |
| Isolamento | `household_id` em toda query | Banco + RLS |
| Segredos | Variáveis de ambiente | Vercel (nunca no código) |
| Transporte | HTTPS obrigatório | Vercel (automático) |
| Tokens | Renovação automática | Middleware SSR |
| Operações críticas | Funções RPC com SECURITY DEFINER | Supabase |

### Row Level Security

Cada tabela tem políticas RLS. Nenhum usuário acessa dados de outra casa.

### Funções RPC (SECURITY DEFINER)

Operações que precisam contornar RLS de forma segura:
- `create_household(p_name, p_display_name)` — cria casa e adiciona owner
- `join_household(p_invite_code, p_display_name)` — entra em casa via código

---

## Modelo de dados

```
households (uma por casal/família)
├── household_members (usuários vinculados — máx. 2)
├── income_sources (renda: freelance ou CLT múltiplo)
├── fixed_bills (contas fixas recorrentes)
├── expenses (gastos variáveis mensais)
├── credit_cards (cartões de crédito)
│   └── card_transactions (lançamentos por cartão/mês)
└── savings_goals (metas de poupança)
```

### Modelo de renda (income_sources)

Suporta dois fluxos:

**Autônomo (freelance):**
- Lança cada pagamento recebido com data e valor real
- `status = 'received'` imediatamente ao registrar

**CLT com múltiplos empregos:**
- Cadastra valor esperado por empregador (`status = 'pending'`)
- Confirma quando o salário cai na conta (ajusta valor real + data)
- Botão "Copiar mês anterior" para não redigitar os empregos todo mês

---

## Stack tecnológica

| Tecnologia | Função |
|------------|--------|
| Next.js 14 | Frontend + SSR + rotas protegidas |
| Supabase | Auth + DB + Realtime + RPC |
| Vercel | Hospedagem + CI/CD automático |
| next-pwa | PWA instalável no celular |
| WebAuthn | Biometria local (digital/Face ID) |
| recharts | Gráficos do dashboard |

---

## Estrutura de pastas

```
financa-casa/
├── src/
│   ├── middleware.js                  # Proteção de todas as rotas
│   ├── components/
│   │   └── AppLock.jsx               # Tela de PIN + biometria
│   ├── app/
│   │   ├── layout.jsx                # Root layout (meta PWA, fonte)
│   │   ├── page.jsx                  # Redirect para /auth ou /dashboard
│   │   ├── auth/page.jsx             # Login, cadastro, esqueci a senha
│   │   ├── setup/page.jsx            # Criar casa ou entrar com código
│   │   └── dashboard/page.jsx        # App principal (todos os módulos)
│   └── lib/
│       ├── supabase/
│       │   ├── client.js             # Supabase browser client
│       │   └── server.js             # Supabase server client (SSR)
│       └── hooks/
│           └── useFinances.js        # Hooks de dados com realtime
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql    # Schema + RLS completo
│       ├── 002_income_sources.sql    # Tabela de renda flexível
│       └── 003_rpc_functions.sql     # Funções create/join household
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── icon-192.png                  # Ícone V♥H (192x192)
│   └── icon-512.png                  # Ícone V♥H (512x512)
├── docs/
│   ├── README.md                     # Este arquivo
│   └── SETUP.md                      # Guia de deploy passo a passo
├── .env.example                      # Template de variáveis
├── .gitignore                        # .env.local nunca vai pro Git
├── jsconfig.json                     # Resolve imports @/
├── next.config.mjs                   # Config Next.js + PWA
└── package.json
```

---

## Módulos do sistema

| Módulo | Funcionalidade |
|--------|----------------|
| 🔐 AppLock | PIN de 6 dígitos + digital/Face ID. Trava após 2 min em background |
| 🏠 Dashboard | Saúde financeira da casa + individual, gráficos por categoria |
| 💰 Renda | Autônomo: lança por pagamento. CLT: esperado → confirmar recebimento |
| 📋 Fixas | Recorrentes pausáveis, divisão configurável (50/50 ou um paga tudo) |
| 💸 Lançamentos | Gastos variáveis (débito, dinheiro, ticket refeição) |
| 💳 Cartões | Múltiplos cartões, faturas por mês, utilização do limite |
| 🎯 Metas | Poupança com progresso, prazo e cálculo de reserva de emergência |
| ⚙️ Casa | Código de convite, membros, configurações |

---

## Divisão de gastos

Cada despesa/conta pode ser:
- **50/50** — cada um paga metade
- **Específico** — um membro paga o valor inteiro

O dashboard calcula automaticamente o comprometimento individual com base na renda recebida de cada um.

---

## Indicador de saúde financeira

| % da renda comprometida | Status |
|------------------------|--------|
| < 50% | 🟢 Saudável |
| 50% – 75% | 🟡 Atenção |
| > 75% | 🔴 Crítico |

---

## Extensibilidade (para outros casais)

O sistema já suporta múltiplos households:
1. Novo casal se cadastra em `/auth`
2. Cria uma casa em `/setup` → recebe código de convite
3. Parceiro entra com o código
4. Dados completamente isolados via RLS

---

## Domínio

O sistema está disponível em: **https://financas.lapidio.com.br**
