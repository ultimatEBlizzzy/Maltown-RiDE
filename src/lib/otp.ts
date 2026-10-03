/**
 * OtpProvider abstraction. Production target: Twilio SMS (TWILIO_* env).
 * The development MockOtpProvider stores codes in memory so the flow can be
 * exercised without credentials; the register endpoint surfaces the code in
 * non-production environments only.
 */
export interface OtpProvider {
  readonly name: string;
  send(phone: string, code: string): Promise<void>;
}

export class MockOtpProvider implements OtpProvider {
  readonly name = "MOCK";
  private codes = new Map<string, { code: string; expiresAt: number }>();

  async send(phone: string, code: string): Promise<void> {
    this.codes.set(phone, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
    console.info(`[otp:mock] code for ${phone}: ${code}`);
  }

  /** Development helper — never exposed in production responses. */
  peek(phone: string): string | null {
    const entry = this.codes.get(phone);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.code;
  }
}

export class TwilioOtpProvider implements OtpProvider {
  readonly name = "TWILIO";
  constructor(
    private sid: string,
    private token: string,
    private from: string,
  ) {}

  async send(phone: string, code: string): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`;
    const body = new URLSearchParams({
      To: phone,
      From: this.from,
      Body: `Your MALTown RiDE verification code is ${code}`,
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) throw new Error(`Twilio SMS failed: ${res.status}`);
  }
}

export const otpProvider: OtpProvider = (() => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (sid && token && from) return new TwilioOtpProvider(sid, token, from);
  return new MockOtpProvider();
})();

export function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
