import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { addCredits, getUserByEmail, getUserById, updateUser } from '@/lib/db';

const CREDITS_PRICE_ID =
  process.env.NEXT_PUBLIC_PADDLE_CREDITS_PRICE_ID || 'pri_01m74dmhw68kw11nq225g0rkpr';
const CREATOR_YEARLY_PRICE_ID =
  process.env.NEXT_PUBLIC_PADDLE_CREATOR_YEARLY_PRICE_ID || 'pri_01m74dfsy5vxssam0b31mypsbt';
const AGENCY_MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_AGENCY_MONTHLY_PRICE_ID || '';
const AGENCY_YEARLY_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_AGENCY_YEARLY_PRICE_ID || '';

function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  const parts = signatureHeader.split(';');
  let ts = '';
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, val] = part.trim().split('=');
    if (key === 'ts' && val) ts = val;
    if (key === 'h1' && val) signatures.push(val);
  }

  if (!ts || signatures.length === 0) return false;

  // Reject stale webhook timestamps older than 5 minutes
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
    return false;
  }

  const signedPayload = `${ts}:${rawBody}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSig, 'hex');

  return signatures.some((sig) => {
    try {
      const sigBuf = Buffer.from(sig, 'hex');
      if (sigBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  });
}

interface PaddleWebhookItem {
  price_id?: string;
  price?: { id?: string };
  quantity?: number;
}

interface PaddleWebhookEvent {
  event_type?: string;
  event_id?: string;
  data?: {
    id?: string;
    status?: string;
    subscription_id?: string;
    items?: PaddleWebhookItem[];
    custom_data?: {
      userId?: string;
      userEmail?: string;
      purchaseType?: string;
      videoCredits?: number | string;
      quantityVideos?: number | string;
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

    if (webhookSecret) {
      const sigHeader = req.headers.get('paddle-signature') || '';
      if (!verifyPaddleSignature(rawBody, sigHeader, webhookSecret)) {
        return NextResponse.json({ ok: false, error: 'Firma de Paddle inválida' }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody) as PaddleWebhookEvent;
    const eventType = event.event_type || 'unknown';
    const data = event.data;

    if (data) {
      const customData = data.custom_data || {};
      const userId = typeof customData.userId === 'string' ? customData.userId.trim() : '';
      const userEmail = typeof customData.userEmail === 'string' ? customData.userEmail.trim() : '';

      let user = userId ? await getUserById(userId) : null;
      if (!user && userEmail) {
        user = await getUserByEmail(userEmail);
      }

      if (user) {
        const items = Array.isArray(data.items) ? data.items : [];
        const priceIds = items
          .map((it) => it.price_id || it.price?.id || '')
          .filter(Boolean);

        const isCreditsPurchase =
          customData.purchaseType === 'credits' ||
          customData.purchaseType === 'pay_per_use' ||
          priceIds.includes(CREDITS_PRICE_ID);

        if (eventType === 'transaction.completed' && isCreditsPurchase) {
          const itemQty = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
          const rawCredits =
            Number(customData.videoCredits) ||
            Number(customData.quantityVideos) ||
            itemQty ||
            5;
          const creditsToAdd = Math.max(1, Math.floor(rawCredits));
          await addCredits(user.id, creditsToAdd, data.id || event.event_id);
        } else if (
          eventType === 'transaction.completed' ||
          eventType === 'subscription.activated' ||
          eventType === 'subscription.updated'
        ) {
          const isAgency = priceIds.some(
            (id) => id === AGENCY_MONTHLY_PRICE_ID || id === AGENCY_YEARLY_PRICE_ID
          );
          const isCreatorAnnual = priceIds.includes(CREATOR_YEARLY_PRICE_ID);
          const newPlan = isAgency ? 'agency' : 'creator';
          await updateUser(user.id, {
            plan: newPlan,
            subscriptionId: data.subscription_id || data.id || user.subscriptionId,
            subscriptionPlan: isAgency
              ? 'agency'
              : isCreatorAnnual
              ? 'creator_annual'
              : 'creator_monthly',
            subscriptionStatus: data.status || 'active',
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      received: eventType,
      eventId: event.event_id || null,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Payload inválido' }, { status: 400 });
  }
}
