import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { getDB } from '../database/db';

type SubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';

export interface StatusResponse {
  status: SubscriptionStatus;
  plan: 'monthly' | 'annual' | null;
  daysRemaining: number | null;
  currentPeriodEnd: string | null;
}

interface SubscriptionRow {
  status: string;
  plan: string | null;
  current_period_end: string | null;
}

interface CustomerCodeRow {
  paystack_customer_code: string | null;
}

interface PaystackCustomerResponse {
  data: { customer_code: string };
}

interface PaystackTransactionResponse {
  data: { authorization_url: string };
}

interface SubscriptionCreateData {
  subscription_code: string;
  created_at: string;
  next_payment_date: string;
  plan: { interval: string };
  customer: { customer_code: string };
}

interface SubscriptionCancelData {
  customer: { customer_code: string };
}

interface InvoiceUpdateData {
  paid_at: string | null;
  subscription: {
    next_payment_date: string;
    customer: { customer_code: string };
  };
}

interface InvoicePaymentFailedData {
  subscription: {
    customer: { customer_code: string };
  };
}

interface WebhookEvent {
  event: string;
  data: unknown;
}

const PAYSTACK_BASE = 'https://api.paystack.co';

@Injectable()
export class SubscriptionService {
  async getStatus(userId: string): Promise<StatusResponse> {
    const sql = getDB();
    const rows = (await sql`
      SELECT status, plan, current_period_end
      FROM subscriptions
      WHERE user_id = ${userId}
      LIMIT 1
    `) as SubscriptionRow[];

    if (rows.length === 0) {
      return { status: 'inactive', plan: null, daysRemaining: null, currentPeriodEnd: null };
    }

    const row = rows[0];
    let daysRemaining: number | null = null;
    if (row.current_period_end) {
      daysRemaining = Math.max(
        0,
        Math.ceil((new Date(row.current_period_end).getTime() - Date.now()) / 86400000),
      );
    }

    return {
      status: row.status as SubscriptionStatus,
      plan: row.plan as 'monthly' | 'annual' | null,
      daysRemaining,
      currentPeriodEnd: row.current_period_end
        ? new Date(row.current_period_end).toISOString()
        : null,
    };
  }

  async checkout(
    userId: string,
    email: string,
    plan: 'monthly' | 'annual',
  ): Promise<{ checkoutUrl: string }> {
    const sql = getDB();
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new InternalServerErrorException('Paystack not configured');

    const rows = (await sql`
      SELECT paystack_customer_code
      FROM subscriptions
      WHERE user_id = ${userId}
      LIMIT 1
    `) as CustomerCodeRow[];

    let customerCode: string;

    if (rows.length === 0 || !rows[0].paystack_customer_code) {
      const createRes = await fetch(`${PAYSTACK_BASE}/customer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      const createData = (await createRes.json()) as PaystackCustomerResponse;
      customerCode = createData.data.customer_code;

      await sql`
        INSERT INTO subscriptions (user_id, paystack_customer_code, status)
        VALUES (${userId}, ${customerCode}, 'inactive')
        ON CONFLICT (user_id) DO UPDATE SET paystack_customer_code = ${customerCode}
      `;
    } else {
      customerCode = rows[0].paystack_customer_code;
    }

    const planCode =
      plan === 'monthly'
        ? process.env.PAYSTACK_PLAN_MONTHLY
        : process.env.PAYSTACK_PLAN_ANNUAL;
    if (!planCode) throw new InternalServerErrorException('Plan code not configured');

    const initRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: 5000000,
        plan: planCode,
        callback_url: process.env.PAYSTACK_SUCCESS_URL,
        metadata: { user_id: userId },
      }),
    });
    const initData = (await initRes.json()) as PaystackTransactionResponse;

    return { checkoutUrl: initData.data.authorization_url };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new InternalServerErrorException('Paystack not configured');

    const hash = createHmac('sha512', secretKey).update(rawBody).digest('hex');
    if (hash !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString()) as WebhookEvent;
    const sql = getDB();

    if (event.event === 'subscription.create') {
      const data = event.data as SubscriptionCreateData;
      const plan = data.plan.interval === 'monthly' ? 'monthly' : 'annual';
      await sql`
        UPDATE subscriptions SET
          status = 'active',
          plan = ${plan},
          paystack_subscription_code = ${data.subscription_code},
          current_period_start = ${new Date(data.created_at).toISOString()},
          current_period_end   = ${new Date(data.next_payment_date).toISOString()},
          updated_at = NOW()
        WHERE paystack_customer_code = ${data.customer.customer_code}
      `;
    } else if (
      event.event === 'subscription.disable' ||
      event.event === 'subscription.not_renew'
    ) {
      const data = event.data as SubscriptionCancelData;
      await sql`
        UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
        WHERE paystack_customer_code = ${data.customer.customer_code}
      `;
    } else if (event.event === 'invoice.update') {
      const data = event.data as InvoiceUpdateData;
      if (!data.paid_at) return;
      await sql`
        UPDATE subscriptions SET
          status = 'active',
          current_period_start = ${new Date(data.paid_at).toISOString()},
          current_period_end   = ${new Date(data.subscription.next_payment_date).toISOString()},
          updated_at = NOW()
        WHERE paystack_customer_code = ${data.subscription.customer.customer_code}
      `;
    } else if (event.event === 'invoice.payment_failed') {
      const data = event.data as InvoicePaymentFailedData;
      await sql`
        UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
        WHERE paystack_customer_code = ${data.subscription.customer.customer_code}
      `;
    }
  }
}
