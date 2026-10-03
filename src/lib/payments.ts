import type { PaymentMethod, PaymentStatus } from "./types";

export interface ChargeRequest {
  rideId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
}

export interface ChargeResult {
  status: PaymentStatus;
  provider: string;
  providerRef: string | null;
}

/**
 * PaymentProvider abstraction. Production integration target: PayFast.
 * Credentials come from PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY /
 * PAYFAST_PASSPHRASE environment variables. Until those credentials exist
 * AND a real charge has been verified end-to-end, the platform honestly
 * runs the MockPaymentProvider — no live payment is ever pretended.
 * Raw card data is never collected or stored by this application.
 */
export interface PaymentProvider {
  readonly name: string;
  charge(req: ChargeRequest): Promise<ChargeResult>;
  refund?(providerRef: string, amount: number): Promise<ChargeResult>;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "MOCK";

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    return {
      status: "SUCCESS",
      provider: this.name,
      providerRef: `MOCK-${req.rideId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    };
  }

  async refund(providerRef: string): Promise<ChargeResult> {
    return { status: "REFUNDED", provider: this.name, providerRef: `RFND-${providerRef}` };
  }
}

/** PayFast stub — activates only when real credentials are configured. */
export class PayFastPaymentProvider implements PaymentProvider {
  readonly name = "PAYFAST";
  constructor(
    private merchantId: string,
    private merchantKey: string,
    private passphrase: string,
  ) {}

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    // Intentionally conservative: without verified credentials + a tested
    // integration we must not report success. Mark FAILED so operations sees
    // the provider is not wired yet.
    void this.merchantId;
    void this.merchantKey;
    void this.passphrase;
    void req;
    return { status: "FAILED", provider: this.name, providerRef: null };
  }
}

export function getPaymentProvider(): PaymentProvider {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  if (merchantId && merchantKey && passphrase) {
    return new PayFastPaymentProvider(merchantId, merchantKey, passphrase);
  }
  return new MockPaymentProvider();
}
