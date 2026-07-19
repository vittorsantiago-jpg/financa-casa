# 🚀 Guia de Deploy — Finanças da Casa

Tempo estimado na primeira vez: **30–40 minutos**.
Atualizações futuras: `git push` e a Vercel faz o resto automaticamente.

---

## Pré-requisitos

- Conta no **GitHub**
- Conta no **Vercel** (conectada ao GitHub)
- Conta no **Supabase**
- **Node.js 18+** instalado localmente
- Domínio configurado (opcional — ex: `financas.lapidio.com.br`)

---

## PASSO 1 — Supabase: banco de dados

### 1.1 Criar o projeto

1. [supabase.com](https://supabase.com) → **New Project**
2. Nome: `financa-casa`, Region: **South America (São Paulo)**
3. Aguarde ~2 minutos

### 1.2 Rodar as migrations (ordem importa)

Supabase → **SQL Editor** → **New query** → cole e rode cada arquivo na ordem:

| Ordem | Arquivo | O que faz |
|-------|---------|-----------|
| 1º | `supabase/migrations/001_initial_schema.sql` | Cria todas as tabelas + RLS |
| 2º | `supabase/migrations/002_income_sources.sql` | Tabela de renda flexível |
| 3º | `supabase/migrations/003_rpc_functions.sql` | Funções create/join household |

### 1.3 Corrigir policies de RLS (necessário)

Ainda no SQL Editor, rode:

```sql
DROP POLICY IF EXISTS "households_insert_authenticated" ON public.households;
CREATE POLICY "households_insert_auth" ON public.households FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "members_insert_authenticated" ON public.household_members;
CREATE POLICY "members_insert_auth" ON public.household_members FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

### 1.4 Configurar autenticação

1. **Authentication → Email** → desative "Confirm email" para testes (reative depois)
2. **Authentication → URL Configuration → Redirect URLs** → adicione:
   ```
   https://SEU_DOMINIO/**
   ```

### 1.5 Copiar as chaves

**Settings → API:**
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## PASSO 2 — GitHub

```bash
git init
git add .
git commit -m "feat: sistema financeiro inicial"
git remote add origin https://github.com/SEU_USUARIO/financa-casa.git
git push -u origin main
```

⚠️ Confirme que `.env.local` **não aparece** no `git status` antes de fazer push.

---

## PASSO 3 — Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → importe o repositório
2. Framework: **Next.js** (detectado automaticamente)
3. Em **Environment Variables**, adicione:

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon pública |

4. Clique em **Deploy**

---

## PASSO 4 — Domínio personalizado (opcional)

1. Vercel → projeto → **Settings → Domains** → adicione `financas.seudominio.com.br`
2. No seu DNS, adicione:

| Tipo | Nome | Valor |
|------|------|-------|
| CNAME | `financas` | `cname.vercel-dns.com` |

3. O HTTPS é gerado automaticamente pelo Vercel

---

## PASSO 5 — PWA no celular

### Android (Chrome):
Acesse a URL → Menu (⋮) → **Adicionar à tela inicial**

### iPhone (Safari):
Acesse a URL → Compartilhar (□↑) → **Adicionar à Tela de Início**

O ícone V♥H aparece na tela inicial e o app abre sem barra de navegação do browser.

---

## PASSO 6 — Primeiro uso

**Usuário A (cria a casa):**
1. Acessa a URL → cria conta com e-mail e senha
2. Cria seu PIN de 6 dígitos (+ opcional: ativa biometria)
3. Setup → "Criar nova casa" → preenche nome e seu nome
4. Na aba ⚙️ (header) → copia o código de convite

**Usuário B (entra na casa):**
1. Acessa a URL → cria conta com e-mail e senha
2. Cria seu PIN de 6 dígitos
3. Setup → "Entrar com código" → digita o código

---

## Atualizações futuras

```bash
git add ARQUIVO_MODIFICADO
git commit -m "descrição da mudança"
git push
```

A Vercel detecta o push e faz o deploy automaticamente em ~1 minuto.

---

## Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `row violates row-level security` | Policy de RLS bloqueando | Rode o SQL do passo 1.3 |
| `useIncomeSources is not exported` | `useFinances.js` desatualizado | Substitua pelo arquivo mais recente |
| `Module not found: @/lib/...` | Falta o `jsconfig.json` | Adicione o `jsconfig.json` na raiz |
| App não abre / tela branca | Cache do PWA | Hard refresh: segure o botão de reload |
| Múltiplas casas criadas | Tentativas duplicadas no setup | Limpe via SQL Editor no Supabase |

---

## Verificar se está tudo ok no Supabase

```sql
-- Tabelas criadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- Funções RPC criadas
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('create_household', 'join_household');

-- Membros da casa
SELECT h.name, hm.display_name, hm.role
FROM public.households h
JOIN public.household_members hm ON hm.household_id = h.id;
```
