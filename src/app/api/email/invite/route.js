import { resend, FROM, inviteHtml } from "@/lib/email";

export async function POST(request) {
  try {
    const { email, inviterName, inviteCode, householdName } = await request.json();

    if (!email || !inviterName || !inviteCode) {
      return Response.json({ error: "email, inviterName e inviteCode são obrigatórios" }, { status: 400 });
    }

    const { error } = await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: `${inviterName} te convidou para o Finanças da Casa 💜`,
      html:    inviteHtml({ inviterName, inviteCode, householdName: householdName || "a casa" }),
    });

    if (error) throw error;

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[email/invite]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
