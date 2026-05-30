import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { getDB } from '../database/db';

type SubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';

export interface StatusResponse {
  status: SubscriptionStatus;
  plan: 'monthly' | 'lifetime' | null;
  daysRemaining: number | null;
  currentPeriodEnd: string | null;
}

interface SubscriptionRow {
  status: string;
  plan: string | null;
  current_period_end: string | null;
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

interface PaystackVerifyCustomer {
  customer_code: string;
}

interface PaystackVerifyPlan {
  interval: string;
}

interface PaystackVerifyData {
  status: string;
  plan: PaystackVerifyPlan | null;
  customer: PaystackVerifyCustomer;
}

interface PaystackVerifyResponse {
  status: boolean;
  data: PaystackVerifyData;
}

const PAYSTACK_BASE = 'https://api.paystack.co';

@Injectable()
export class SubscriptionService {
  async getStatus(userId: string): Promise<StatusResponse> {
    const pool = getDB();
    const result = await pool.query<SubscriptionRow>(
      `SELECT status, plan, current_period_end
       FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return { status: 'inactive', plan: null, daysRemaining: null, currentPeriodEnd: null };
    }

    const row = result.rows[0];
    let daysRemaining: number | null = null;
    if (row.current_period_end) {
      daysRemaining = Math.max(
        0,
        Math.ceil((new Date(row.current_period_end).getTime() - Date.now()) / 86400000),
      );
    }

    return {
      status: row.status as SubscriptionStatus,
      plan: row.plan as 'monthly' | 'lifetime' | null,
      daysRemaining,
      currentPeriodEnd: row.current_period_end
        ? new Date(row.current_period_end).toISOString()
        : null,
    };
  }

  async verify(userId: string, reference: string): Promise<{ success: boolean }> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new InternalServerErrorException('Paystack not configured');

    const res = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );

    if (!res.ok) throw new BadRequestException('Could not reach Paystack');

    const body = (await res.json()) as PaystackVerifyResponse;
    if (!body.status || body.data.status !== 'success') {
      throw new BadRequestException('Payment not successful');
    }

    const txData = body.data;
    const isLifetime = txData.plan === null;
    const plan: 'monthly' | 'lifetime' = isLifetime ? 'lifetime' : 'monthly';
    const pool = getDB();

    if (isLifetime) {
      await pool.query(
        `INSERT INTO subscriptions (user_id, paystack_customer_code, status, plan, current_period_end, updated_at)
         VALUES ($1, $2, 'active', $3, $4, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           paystack_customer_code = $2,
           status = 'active',
           plan = $3,
           current_period_end = $4,
           updated_at = NOW()`,
        [userId, txData.customer.customer_code, plan, '2099-12-31T23:59:59.000Z'],
      );
    } else {
      await pool.query(
        `INSERT INTO subscriptions (user_id, paystack_customer_code, status, plan, updated_at)
         VALUES ($1, $2, 'active', $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           paystack_customer_code = $2,
           status = 'active',
           plan = $3,
           updated_at = NOW()`,
        [userId, txData.customer.customer_code, plan],
      );
    }

    return { success: true };
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new InternalServerErrorException('Paystack not configured');

    const hash = createHmac('sha512', secretKey).update(rawBody).digest('hex');
    if (hash !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = JSON.parse(rawBody.toString()) as WebhookEvent;
    const pool = getDB();

    if (event.event === 'subscription.create') {
      const data = event.data as SubscriptionCreateData;
      const plan = data.plan.interval === 'monthly' ? 'monthly' : 'annual';
      await pool.query(
        `UPDATE subscriptions SET
           status = 'active',
           plan = $1,
           paystack_subscription_code = $2,
           current_period_start = $3,
           current_period_end = $4,
           updated_at = NOW()
         WHERE paystack_customer_code = $5`,
        [
          plan,
          data.subscription_code,
          new Date(data.created_at).toISOString(),
          new Date(data.next_payment_date).toISOString(),
          data.customer.customer_code,
        ],
      );
    } else if (
      event.event === 'subscription.disable' ||
      event.event === 'subscription.not_renew'
    ) {
      const data = event.data as SubscriptionCancelData;
      await pool.query(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
         WHERE paystack_customer_code = $1`,
        [data.customer.customer_code],
      );
    } else if (event.event === 'invoice.update') {
      const data = event.data as InvoiceUpdateData;
      if (!data.paid_at) return;
      await pool.query(
        `UPDATE subscriptions SET
           status = 'active',
           current_period_start = $1,
           current_period_end = $2,
           updated_at = NOW()
         WHERE paystack_customer_code = $3`,
        [
          new Date(data.paid_at).toISOString(),
          new Date(data.subscription.next_payment_date).toISOString(),
          data.subscription.customer.customer_code,
        ],
      );
    } else if (event.event === 'invoice.payment_failed') {
      const data = event.data as InvoicePaymentFailedData;
      await pool.query(
        `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
         WHERE paystack_customer_code = $1`,
        [data.subscription.customer.customer_code],
      );
    }
  }
}
