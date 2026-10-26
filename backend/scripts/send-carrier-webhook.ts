/**
 * Sends a signed carrier webhook to the local backend, the way a carrier
 * would: a tracking update for one shipment.
 *
 *   npm run webhook:carrier -- <trackingId> <status> "<location>" [eventId]
 *   npm run webhook:carrier -- TRK-4A6F90 in_transit "Lyon hub"
 *
 * Reuse an eventId to see a redelivery logged as a duplicate. Reads
 * CARRIER_WEBHOOK_SECRET and PORT from backend/.env.
 */
import { createHmac, randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

async function main(): Promise<void> {
  const [trackingId, status, location, eventId = `evt_${randomUUID()}`] =
    process.argv.slice(2);
  const secret = process.env.CARRIER_WEBHOOK_SECRET;
  if (!trackingId || !status || !location) {
    console.error(
      'Usage: npm run webhook:carrier -- <trackingId> <in_transit|out_for_delivery|delivered> "<location>" [eventId]',
    );
    process.exit(1);
  }
  if (!secret) {
    console.error('Set CARRIER_WEBHOOK_SECRET in backend/.env first.');
    process.exit(1);
  }

  const body = JSON.stringify({
    eventId,
    type: 'tracking.updated',
    data: { trackingId, status, location },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  const url = `http://localhost:${process.env.PORT ?? 3000}/api/webhooks/carrier`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Carrier-Signature': `t=${timestamp},v1=${signature}`,
    },
    body,
  });
  console.log(`${response.status} ${await response.text()}`);
  console.log(`eventId: ${eventId}`);
}

void main();
