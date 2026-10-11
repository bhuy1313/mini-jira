import { describe, expect, it, vi } from "vitest";

import {
  createEmailSender,
  resetPasswordTemplate,
  verifyCodeTemplate,
  verifyEmailTemplate,
  workspaceAddedTemplate,
} from "./email";

function okResponse(body: unknown = { id: "mail-1" }): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response;
}

describe("Email sender", () => {
  it("no-op khi thiếu API key (không throw, không gọi fetch)", async () => {
    const fetchFn = vi.fn();
    const sender = createEmailSender(fetchFn, { apiKey: "" });
    const res = await sender.send({ to: "a@x.com", subject: "Hi", text: "hello" });
    expect(res).toEqual({ sent: false });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("gọi Resend API với Bearer auth khi có key", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse());
    const sender = createEmailSender(fetchFn, {
      apiKey: "re_test",
      from: "Mini Jira <noreply@test.dev>",
    });
    const res = await sender.send({ to: "a@x.com", subject: "Hi", text: "hello" });
    expect(res).toEqual({ sent: true, id: "mail-1" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body as string) as Record<string, string>;
    expect(body.from).toBe("Mini Jira <noreply@test.dev>");
    expect(body.to).toBe("a@x.com");
  });

  it("Resend từ chối / network lỗi → sent:false, không throw", async () => {
    const rejected = createEmailSender(
      vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response),
      { apiKey: "re_test" },
    );
    await expect(
      rejected.send({ to: "a@x.com", subject: "Hi", text: "hello" }),
    ).resolves.toEqual({ sent: false });

    const broken = createEmailSender(vi.fn().mockRejectedValue(new Error("down")), {
      apiKey: "re_test",
    });
    await expect(
      broken.send({ to: "a@x.com", subject: "Hi", text: "hello" }),
    ).resolves.toEqual({ sent: false });
  });
});

describe("Email templates", () => {
  it("verify/reset/invite chứa link và địa chỉ nhận", () => {
    const verify = verifyEmailTemplate("u@x.com", "https://app/verify?token=t");
    expect(verify.to).toBe("u@x.com");
    expect(verify.text).toContain("https://app/verify?token=t");

    const reset = resetPasswordTemplate("u@x.com", "https://app/reset?token=t");
    expect(reset.text).toContain("https://app/reset?token=t");

    const added = workspaceAddedTemplate("u@x.com", "Acme", "ws-1");
    expect(added.text).toContain("Acme");
    expect(added.text).toContain("/workspaces/ws-1");
  });

  it("verify code template chứa mã OTP", () => {
    const tpl = verifyCodeTemplate("u@x.com", "482916");
    expect(tpl.to).toBe("u@x.com");
    expect(tpl.subject).toContain("482916");
    expect(tpl.text).toContain("482916");
  });
});
