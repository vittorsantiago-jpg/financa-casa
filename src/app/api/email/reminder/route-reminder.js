import { createClient } from "@supabase/supabase-js";
import { resend, FROM, reminderHtml } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  // Verifica se é uma chamada legítima (Vercel Cron ou CRON_SECRET)
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now    = new Date();
    const today  = now.getDate();
    const target = today + 2; // vence em 2 dias
    const month  = now.getMonth();
    const year   = now.getFullYear();

    // Busca contas pendentes que vencem em 2 dias
    const { data: bills } = await supabase
      .from("bill_payments")
      .select("*, households!inner(id, name)")
      .eq("status",   "pending")
      .eq("due_day",  target)
      .eq("month",    month)
      .eq("year",     year);

    if (!bills?.length) {
      return Response.json({ ok: true, sent: 0 });
    }

    // Agrupa por household
    const byHousehold = {};
    for (const b of bills) {
      const hid = b.household_id;
      if (!byHousehold[hid]) byHousehold[hid] = { bills: [], householdName: b.households?.name };
      byHousehold[hid].bills.push(b);
    }

    // Busca membros e emails de cada household
    const { data: members } = await supabase
      .from("household_members")
      .select("household_id, user_id, display_name")
      .in("household_id", Object.keys(byHousehold));

    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const userMap = Object.fromEntries(users.map(u => [u.id, u.email]));

    let sent = 0;
    for (const m of members || []) {
      const email = userMap[m.user_id];
      const data  = byHousehold[m.household_id];
      if (!email || !data) continue;

      await resend.emails.send({
        from:    FROM,
        to:      email,
        subject: `⚠️ ${data.bills.length} conta(s) vencendo em 2 dias`,
        html:    reminderHtml({ memberName: m.display_name, bills: data.bills }),
      });
      sent++;
    }

    return Response.json({ ok: true, sent });
  } catch (err) {
    console.error("[email/reminder]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
