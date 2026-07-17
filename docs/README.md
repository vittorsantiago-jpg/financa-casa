# 💜 Finanças da Casa

Sistema de gestão financeira doméstica compartilhada.  
Construído para ser seguro, multi-tenant e extensível.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER / PWA                        │
│   Next.js 14 (React) — Client Components               │
│   Supabase JS SDK (anon key apenas)                    │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│                  VERCEL (Edge)                          │
│   Middleware: valida JWT + protege rotas               │
│   Next.js Server Components (SSR quando necessário)    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                 SUPABASE                                │
│   Auth: JWT via email/senha                            │
│   Database: PostgreSQL com RLS                         │
│   Realtime: WebSocket para sync instantâneo            │
└─────────────────────────────────────────────────────────┘
```

---

## Segurança

### Camadas de proteção

| Camada | Mecanismo | Onde |
|--------|-----------|------|
| Autenticação | JWT via Supabase Auth | Middleware Next.js |
| Autorização | Row Level Security (RLS) | PostgreSQL |
| Isolamento | `household_id` em toda query | Banco + RLS |
| Segredos | Variáveis de ambiente | Vercel (nunca no código) |
| Transporte | HTTPS obrigatório | Vercel (automático) |
| Tokens | Renovação automática | Middleware SSR |

### Row Level Security

Cada tabela tem políticas RLS que garantem:
- Usuário **só vê dados do próprio household**
- Mesmo que descubra o ID de outro household, **não consegue ler nada**
- A anon key do Supabase **nunca bypassa o RLS**
- Funções auxiliares usam `SECURITY DEFINER` para queries seguras

```sql
-- Exemplo: nenhum usuário acessa dados de outra casa
CREATE POLICY "expenses_select"
  ON public.expenses FOR SELECT
  USING (public.user_in_household(household_id));
```

### O que NÃO fazemos (por segurança)

- ❌ Service Role Key **nunca** vai para o frontend
- ❌ Nenhuma query sem filtro `household_id`
- ❌ Nenhuma rota acessível sem autenticação (middleware)
- ❌ Nenhum dado sensível no código (apenas em `.env`)

---

## Modelo de dados

```
households (uma por casal/família)
├── household_members (usuários vinculados à casa)
├── salaries (salário por membro, por mês/ano)
├── fixed_bills (contas fixas recorrentes)
├── expenses (gastos variáveis mensais)
├── credit_cards (cartões de crédito)
│   └── card_transactions (lançamentos por cartão)
└── savings_goals (metas de poupança)
```

### Multi-tenant

O sistema foi projetado para múltiplos casais/famílias:
- Cada `household` é completamente isolado
- O RLS garante isolamento no banco
- Um usuário pode pertencer a apenas um household

---

## Stack tecnológica

| Tecnologia | Função | Por quê |
|------------|--------|---------|
| Next.js 14 | Frontend + SSR | Deploy trivial na Vercel, App Router |
| Supabase | Auth + DB + Realtime | PostgreSQL gerenciado com RLS e WebSocket |
| Vercel | Hospedagem | CI/CD automático, edge network, HTTPS |
| next-pwa | PWA | Instalável no celular, funciona offline |
| recharts | Gráficos | Leve, feito para React |

---

## Estrutura de pastas

```
financa-casa/
├── src/
│   ├── middleware.js          # Proteção de rotas (auth + household check)
│   ├── app/
│   │   ├── layout.jsx         # Root layout com meta PWA
│   │   ├── page.jsx           # Redirect inteligente
│   │   ├── auth/page.jsx      # Login / cadastro
│   │   ├── setup/page.jsx     # Criar ou entrar em uma casa
│   │   └── dashboard/
│   │       └── page.jsx       # App principal (todos os módulos)
│   └── lib/
│       ├── supabase/
│       │   ├── client.js      # Supabase browser client
│       │   └── server.js      # Supabase server client (SSR)
│       └── hooks/
│           └── useFinances.js # Hooks de dados com realtime
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Schema + RLS completo
├── public/
│   └── manifest.json          # PWA manifest
├── docs/
│   ├── README.md              # Este arquivo
│   └── SETUP.md               # Guia de deploy passo a passo
├── .env.example               # Template de variáveis (commitar isso é ok)
├── .gitignore                 # .env.local NUNCA vai pro Git
├── next.config.mjs            # Config Next.js + PWA
└── package.json
```

---

## Módulos do sistema

| Módulo | Funcionalidade |
|--------|----------------|
| 🏠 Dashboard | Saúde financeira da casa + individual, gráficos |
| 💵 Salários | Registro mensal por pessoa, histórico |
| 📋 Contas Fixas | Recorrentes, pausáveis, divisão configurável |
| 💸 Lançamentos | Gastos variáveis (débito, dinheiro, ticket) |
| 💳 Cartões | Múltiplos cartões, faturas por mês |
| 🎯 Metas | Poupança com progresso e cálculo de reserva de emergência |
| ⚙️ Casa | Código de convite, membros |

---

## Extensibilidade (para uso por outros casais)

O sistema já está pronto para múltiplos usuários:

1. **Novo casal se cadastra** → cria conta no `/auth`
2. **Cria uma casa** → `/setup` → recebe código de convite
3. **Parceiro entra** → usa o código no `/setup`
4. **Dados completamente isolados** → RLS garante isso

Para tornar o sistema público:
- Configure um domínio personalizado na Vercel
- Ative verificação de e-mail no Supabase Auth
- Considere adicionar um plano de limites (rate limiting)

---

## Licença

Projeto pessoal — use, adapte e compartilhe à vontade.
