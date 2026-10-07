import { transporter } from "../config/email.js";
import config from "../config/index.js";
import verificationTemplate from "../templates/emails/verificationEmail.js";
class EmailService {
  static async sendEmail(to: string, subject: string, html: string) {
    return transporter.sendMail({
      from: `"${config.email.from.name}" <${config.email.from.address}>`,
      to,
      subject,
      html,
    });
  }

  static async sendVerificationEmail(
    to: string,
    name: string,
    code: string,
    expiresInMinutes: number,
  ) {
    return EmailService.sendEmail(
      to,
      config.email.verificationEmailSubject,
      verificationTemplate(name, code, expiresInMinutes),
    );
  }
}
export default EmailService;
