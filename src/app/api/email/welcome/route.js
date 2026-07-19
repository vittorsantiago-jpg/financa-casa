import { resend, FROM, welcomeHtml } from "@/lib/email";

export async function POST(request) {
  try {
    const { email, name, householdName } = await request.json();

    if (!email || !name) {
      return Response.json({ error: "email e name são obrigatórios" }, { status: 400 });
    }

    const { error } = await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: `Bem-vindo ao Finanças da Casa, ${name}! 💜`,
      html:    welcomeHtml({ name, householdName: householdName || "sua casa" }),
    });

    if (error) throw error;

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[email/welcome]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
