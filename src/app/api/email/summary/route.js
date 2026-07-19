import { createClient } from "@supabase/supabase-js";
import { resend, FROM, summaryHtml } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const CATS = {
  moradia:"🏠 Moradia", transporte:"🚗 Transporte", alimentacao:"🍕 Alimentação",
  saude:"💊 Saúde", educacao:"📚 Educação", lazer:"🎮 Lazer",
  vestuario:"👕 Vestuário", servicos:"⚡ Serviços", outros:"📦 Outros",
};

export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Mês anterior
    const now      = new Date();
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month    = prevDate.getMonth();
    const year     = prevDate.getFullYear();
    const monthName = `${MONTHS_PT[month]} ${year}`;

    // Busca todos os households
    const { data: households } = await supabase.from("households").select("id, name");
    const { data: members }    = await supabase.from("household_members").select("household_id, user_id, display_name");
    const { data: { users } }  = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const userMap = Object.fromEntries(users.map(u => [u.id, u.email]));

    let sent = 0;

    for (const hh of households || []) {
      const hid = hh.id;

      // Busca dados do mês anterior para esse household
      const [
        { data: incomeData  },
        { data: expData     },
        { data: txData      },
        { data: billsData   },
        { data: goalsData   },
      ] = await Promise.all([
        supabase.from("income_sources")   .select("received_amount,status").eq("household_id",hid).eq("month",month).eq("year",year).eq("status","received"),
        supabase.from("expenses")          .select("amount,category,pay_method").eq("household_id",hid).eq("month",month).eq("year",year),
        supabase.from("card_transactions") .select("amount,category").eq("household_id",hid).eq("month",month).eq("year",year),
        supabase.from("fixed_bills")       .select("amount").eq("household_id",hid).eq("active",true),
        supabase.from("savings_goals")     .select("name,target_amount,current_amount").eq("household_id",hid),
      ]);

      const income   = (incomeData  ||[]).reduce((s,r)=>s+Number(r.received_amount||0),0);
      const fixedExp = (billsData   ||[]).reduce((s,r)=>s+Number(r.amount||0),0);
      const varExp   = (expData     ||[]).filter(e=>e.pay_method!=="ticket").reduce((s,r)=>s+Number(r.amount||0),0);
      const cardExp  = (txData      ||[]).reduce((s,r)=>s+Number(r.amount||0),0);
      const expenses = fixedExp + varExp + cardExp;
      const balance  = income - expenses;

      // Categorias (var + card)
      const catMap = {};
      [...(expData||[]).filter(e=>e.pay_method!=="ticket"), ...(txData||[])].forEach(r=>{
        catMap[r.category] = (catMap[r.category]||0) + Number(r.amount||0);
      });
      const categories = Object.entries(catMap)
        .map(([k,v])=>({ name: CATS[k]||k, value:v }))
        .sort((a,b)=>b.value-a.value);

      const goals = (goalsData||[]).map(g=>({
        name: g.name,
        pct: Math.min((Number(g.current_amount)||0)/(Number(g.target_amount)||1)*100,100),
      }));

      // Envia para cada membro da casa
      const hhMembers = (members||[]).filter(m=>m.household_id===hid);
      for (const m of hhMembers) {
        const email = userMap[m.user_id];
        if (!email) continue;

        await resend.emails.send({
          from:    FROM,
          to:      email,
          subject: `📊 Resumo financeiro de ${monthName} — Finanças da Casa`,
          html:    summaryHtml({ memberName:m.display_name, monthName, income, expenses, balance, categories, goals }),
        });
        sent++;
      }
    }

    return Response.json({ ok: true, sent });
  } catch (err) {
    console.error("[email/summary]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
