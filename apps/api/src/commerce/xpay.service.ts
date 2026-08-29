import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type XPayCheckoutLine = {
  name: string;
  currency: string;
  unitAmount: number;
  quantity: number;
  productId: string;
  slug: string;
};

export type XPayCheckoutSession = {
  id: string;
  url?: string;
  status?: string;
  paymentStatus?: string;
  amountTotal?: number;
  currency?: string;
  presentmentDetails?: {
    amount?: number;
    amountSubtotal?: number;
    amountTotal?: number;
    amountDiscount?: number;
    currency?: string;
    exchangeRate?: number;
  } | null;
  metadata?: Record<string, unknown>;
  paymentIntentId?: string;
  paymentIntent?: {
    id?: string;
  } | null;
};

export type XPayWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: XPayCheckoutSession;
  };
};

export type CreateXPayCheckoutInput = {
  orderId: string;
  orderNumber: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
  };
  lines: XPayCheckoutLine[];
};

@Injectable()
export class XPayService {
  private readonly logger = new Logger(XPayService.name);

  async createCheckoutSession(
    input: CreateXPayCheckoutInput,
  ): Promise<XPayCheckoutSession & { id: string; url: string }> {
    const secretKey = this.requiredEnv('XPAY_SECRET_KEY');
    const returnUrl = this.requiredEnv('XPAY_RETURN_URL');

    const cancelUrl = String(
      process.env.XPAY_CANCEL_URL ?? '',
    ).trim();

    const baseUrl = String(
      process.env.XPAY_API_BASE_URL || 'https://api.xpay.app',
    )
      .trim()
      .replace(/\/+$/, '');

    const body = {
      currency: input.lines[0].currency.toUpperCase(),
      mode: 'payment',
      uiMode: 'hosted',
      submitType: 'PAY',
      locale: 'ar',
      customerCreation: 'always',

      customerDetails: {
        name: input.user.fullName,
        email: input.user.email,
        phone: input.user.phone,
      },

      afterCompletion: {
        type: 'redirect',
        redirect: {
          url: returnUrl,
        },
      },

      ...(cancelUrl
        ? {
            cancelUrl,
          }
        : {}),

      metadata: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        userId: input.user.id,
        channel: 'athr-web',
      },

      lineItems: input.lines.map((line) => ({
        priceData: {
          currency: line.currency.toUpperCase(),
          unitAmount: line.unitAmount,
          productData: {
            name: line.name,
            metadata: {
              productId: line.productId,
              slug: line.slug,
            },
          },
        },
        quantity: line.quantity,
      })),
    };

    let response: Response;

    try {
      response = await fetch(
        `${baseUrl}/checkout/sessions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `athr-checkout-${input.orderId}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15_000),
        },
      );
    } catch (error) {
      this.logger.error(
        `XPay request failed before response: ${this.safeMessage(error)}`,
      );

      throw new ServiceUnavailableException(
        'تعذر الاتصال ببوابة الدفع حاليًا. حاول مرة أخرى بعد قليل.',
      );
    }

    const raw = await response.text();

    let payload: unknown;

    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      this.logger.error(
        `XPay checkout creation failed with HTTP ${response.status}.`,
      );

      throw new ServiceUnavailableException(
        'تعذر بدء جلسة الدفع حاليًا. حاول مرة أخرى.',
      );
    }

    if (!payload || typeof payload !== 'object') {
      throw new ServiceUnavailableException(
        'بوابة الدفع أعادت استجابة غير صالحة.',
      );
    }

    const session = payload as XPayCheckoutSession;

    if (
      typeof session.id !== 'string' ||
      !session.id.startsWith('cs_') ||
      typeof session.url !== 'string' ||
      !session.url.startsWith('https://')
    ) {
      this.logger.error(
        'XPay checkout response is missing a valid session ID or URL.',
      );

      throw new ServiceUnavailableException(
        'بوابة الدفع لم تُرجع رابط دفع صالحًا.',
      );
    }

    return session as XPayCheckoutSession & {
      id: string;
      url: string;
    };
  }

  verifyWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): XPayWebhookEvent {
    const secret = this.requiredEnv('XPAY_WEBHOOK_SECRET');
    const header = String(signatureHeader ?? '').trim();

    if (!header) {
      throw new BadRequestException('Missing XPay signature.');
    }

    const parts = new Map<string, string>();

    for (const entry of header.split(',')) {
      const separator = entry.indexOf('=');

      if (separator <= 0) {
        continue;
      }

      parts.set(
        entry.slice(0, separator).trim(),
        entry.slice(separator + 1).trim(),
      );
    }

    const timestamp = parts.get('t');
    const signature = parts.get('v1');

    if (
      !timestamp ||
      !/^\d+$/.test(timestamp) ||
      !signature ||
      !/^[0-9a-f]{64}$/i.test(signature)
    ) {
      throw new BadRequestException('Malformed XPay signature.');
    }

    const timestampSeconds = Number(timestamp);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (
      !Number.isFinite(timestampSeconds) ||
      Math.abs(nowSeconds - timestampSeconds) > 300
    ) {
      throw new BadRequestException(
        'XPay webhook timestamp is outside tolerance.',
      );
    }

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest();

    const received = Buffer.from(signature, 'hex');

    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new BadRequestException(
        'Invalid XPay webhook signature.',
      );
    }

    let payload: unknown;

    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException(
        'Invalid XPay webhook JSON.',
      );
    }

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException(
        'Invalid XPay webhook payload.',
      );
    }

    const event = payload as Partial<XPayWebhookEvent>;

    if (
      typeof event.id !== 'string' ||
      !event.id.trim() ||
      typeof event.type !== 'string' ||
      !event.type.trim() ||
      !event.data ||
      !event.data.object ||
      typeof event.data.object.id !== 'string'
    ) {
      throw new BadRequestException(
        'Incomplete XPay webhook payload.',
      );
    }

    return event as XPayWebhookEvent;
  }

  private requiredEnv(name: string): string {
    const value = String(
      process.env[name] ?? '',
    ).trim();

    if (!value) {
      throw new ServiceUnavailableException(
        `XPay configuration is incomplete: ${name}.`,
      );
    }

    return value;
  }

  private safeMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message.slice(0, 300);
    }

    return 'Unknown error';
  }
}
