# 🚀 Guia de Deploy — Finanças da Casa

Tempo estimado: **20–30 minutos** (primeira vez). Em deploys futuros: menos de 5.

---

## Pré-requisitos

- [x] Conta no **GitHub** (já tem)
- [x] Conta no **Vercel** (já tem)
- [x] Conta no **Supabase** (já tem)
- [ ] **Node.js 18+** instalado localmente ([nodejs.org](https://nodejs.org))

---

## PASSO 1 — Supabase: criar o banco de dados

### 1.1 Criar o projeto

1. Acesse [supabase.com](https://supabase.com) → **New Project**
2. Preencha:
   - **Name:** `financa-casa`
   - **Database Password:** escolha uma senha forte (anote em lugar seguro)
   - **Region:** South America (São Paulo) → melhor latência para o Brasil
3. Aguarde o projeto inicializar (~2 min)

### 1.2 Executar o schema SQL

1. No painel do Supabase → **SQL Editor** → **New query**
2. Abra o arquivo `supabase/migrations/001_initial_schema.sql`
3. Copie TODO o conteúdo e cole no editor
4. Clique em **Run** (▶️)
5. Você deve ver: `Success. No rows returned`

> ⚠️ Se aparecer algum erro, verifique se colou o arquivo completo.

### 1.3 Copiar as chaves de API

1. Supabase → **Project Settings** → **API**
2. Anote (vamos usar no Passo 3):
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon public** key → começa com `eyJ...`

### 1.4 Configurar autenticação de e-mail

1. Supabase → **Authentication** → **Providers** → **Email**
2. Mantenha **Email** habilitado
3. Em **Email Settings**, configure o remetente (opcional)
4. Se quiser, desative **Confirm email** para testes (reative depois!)

---

## PASSO 2 — GitHub: subir o código

```bash
# Clone/crie a pasta do projeto
cd financa-casa

# Inicie o repositório
git init
git add .
git commit -m "feat: sistema financeiro inicial"

# Crie o repositório no GitHub (pelo site ou GitHub CLI)
# Depois conecte:
git remote add origin https://github.com/SEU_USUARIO/financa-casa.git
git branch -M main
git push -u origin main
```

> 🔒 **Importante:** o `.gitignore` já está configurado para NUNCA commitar
> o `.env.local`. Verifique antes de fazer o push.

---

## PASSO 3 — Vercel: deploy automático

### 3.1 Importar o projeto

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Clique em **Import** no repositório `financa-casa`
3. Framework: **Next.js** (detectado automaticamente)

### 3.2 Configurar variáveis de ambiente

Na tela de import, clique em **Environment Variables** e adicione:

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (a chave anon) |

> ⚠️ Nunca adicione a `service_role` key nas variáveis da Vercel frontend.

### 3.3 Deploy

Clique em **Deploy**. O build leva ~2 minutos.

Você receberá uma URL como: `https://financa-casa-abc123.vercel.app`

---

## PASSO 4 — Configurar o domínio (opcional)

Se quiser uma URL mais bonita:

1. Vercel → seu projeto → **Settings** → **Domains**
2. Adicione um domínio personalizado (ex: `financas.seudominio.com`)
3. Ou use um subdomínio gratuito da Vercel renomeando o projeto

---

## PASSO 5 — Instalar como PWA no celular

### Android (Chrome):
1. Acesse a URL do app no Chrome
2. Menu (⋮) → **Adicionar à tela inicial**
3. Confirme → o ícone aparece na tela inicial

### iPhone (Safari):
1. Acesse a URL no Safari
2. Botão de compartilhar (□↑) → **Adicionar à Tela de Início**
3. Confirme → o ícone aparece na tela inicial

---

## PASSO 6 — Primeiro uso

### Vittor (cria a casa):
1. Acesse a URL → **Criar conta** com e-mail e senha
2. Verifique o e-mail de confirmação
3. Faça login → tela de Setup → **Criar nova casa**
4. Nome: "Casa Vittor & Hemerson"
5. Você verá o **código de convite** na aba ⚙️ Casa

### Hemerson (entra na casa):
1. Cria conta com e-mail e senha
2. Faz login → tela de Setup → **Entrar com código**
3. Digita o código que o Vittor compartilhou

---

## Desenvolvimento local

```bash
# Instalar dependências
npm install

# Criar o .env.local
cp .env.example .env.local
# Editar .env.local com suas chaves do Supabase

# Rodar em desenvolvimento (PWA desativado em dev)
npm run dev

# Acesse: http://localhost:3000
```

---

## Atualizações futuras

Para deployar uma atualização:

```bash
git add .
git commit -m "feat: descrição da mudança"
git push
```

A Vercel detecta o push e faz o deploy automaticamente. ✅

---

## Troubleshooting

**Erro 500 no deploy:**
- Verifique se as variáveis de ambiente estão corretas na Vercel

**"Invalid login credentials":**
- Verifique se o e-mail foi confirmado no Supabase Auth

**Dados não sincronizando em tempo real:**
- Supabase → **Database** → **Replication** → verifique se as tabelas estão habilitadas para realtime

**Para habilitar realtime (necessário para sync instantâneo):**
1. Supabase → **Database** → **Replication**
2. Habilite para as tabelas: `expenses`, `fixed_bills`, `card_transactions`, `savings_goals`
