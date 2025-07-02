import { Resend } from "resend";
import { EmailTemplate } from "@/components/resend/email-template";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const { name, email } = await request.json();

  try {
    const { data, error } = await resend.emails.send({
      from: "Acme <from@example.com>",
      to: [email],
      subject: "Hello world",
      react: EmailTemplate({ name }),
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
