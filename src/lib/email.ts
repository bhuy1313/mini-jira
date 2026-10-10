import { logger } from "@/lib/logger";

/**
 * Outbound email qua Resend HTTP API (fetch thuần, không thêm dependency).
 *
 * Chế độ khi thiếu RESEND_API_KEY: no-op + log (dev/E2E/CI an toàn — auth
 * flows vẫn chạy, chỉ không có mail thật). Không bao giờ throw lên caller:
 * gửi mail là side-effect fire-and-forget, lỗi gửi không được làm hỏng
 * signup/reset/invite.
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  /** Bản text thuần — luôn có để client mail không HTML vẫn đọc được. */
  text: string;
  html?: string;
}

export interface EmailSender {
  send(input: SendEmailInput): Promise<{ sent: boolean; id?: string }>;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailFromAddress(): string {
  return process.env.EMAIL_FROM ?? "Mini Jira <onboarding@resend.dev>";
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function createEmailSender(
  fetchFn: typeof fetch = fetch,
  opts?: { apiKey?: string; from?: string },
): EmailSender {
  const apiKey = opts?.apiKey ?? process.env.RESEND_API_KEY;
  const from = opts?.from ?? emailFromAddress();

  return {
    async send(input: SendEmailInput): Promise<{ sent: boolean; id?: string }> {
      if (!apiKey) {
        logger.info(
          { to: input.to, subject: input.subject },
          "Email not configured (RESEND_API_KEY missing) — skipping send",
        );
        return { sent: false };
      }
      try {
        const res = await fetchFn("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: input.to,
            subject: input.subject,
            text: input.text,
            html: input.html ?? `<pre>${escapeHtml(input.text)}</pre>`,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          logger.error(
            { to: input.to, status: res.status },
            "Resend API rejected the email",
          );
          return { sent: false };
        }
        const data = (await res.json().catch(() => null)) as { id?: string } | null;
        return { sent: true, id: data?.id };
      } catch (err) {
        logger.error({ err, to: input.to }, "Email send failed");
        return { sent: false };
      }
    },
  };
}

/** Singleton dùng trong server actions/auth hooks. */
export const emailSender: EmailSender = createEmailSender();

function appUrl(path: string): string {
  const base =
    process.env.BETTER_AUTH_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export function verifyEmailTemplate(to: string, url: string): SendEmailInput {
  return {
    to,
    subject: "Verify your Mini Jira email",
    text: [
      "Welcome to Mini Jira!",
      "",
      "Please verify your email address by opening this link:",
      url,
      "",
      "If you did not create this account, you can ignore this email.",
    ].join("\n"),
  };
}

export function resetPasswordTemplate(to: string, url: string): SendEmailInput {
  return {
    to,
    subject: "Reset your Mini Jira password",
    text: [
      "You requested a password reset for Mini Jira.",
      "",
      "Open this link to choose a new password:",
      url,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
  };
}

export function workspaceAddedTemplate(
  to: string,
  workspaceName: string,
  workspaceId: string,
): SendEmailInput {
  const url = appUrl(`/workspaces/${workspaceId}`);
  return {
    to,
    subject: `You've been added to "${workspaceName}" on Mini Jira`,
    text: [
      `You've been added to the workspace "${workspaceName}" on Mini Jira.`,
      "",
      `Open it here: ${url}`,
    ].join("\n"),
  };
}
