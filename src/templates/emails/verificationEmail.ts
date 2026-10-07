import { baseTemplate } from "./baseTemplate.js";

export default function verificationTemplate(
  name: string,
  code: string,
  expiresInMinutes: number,
) {
  return baseTemplate(
    "Verify your email",

    `
        <p>Hi ${name},</p>

        <p>
        Thank you for registering.
        </p>

        <p>
        Please use the verification code below:
        </p>

        <div class="code">
            ${code}
        </div>

        <p>
        This code expires in ${expiresInMinutes} minutes.
        </p>
        `,
  );
}
