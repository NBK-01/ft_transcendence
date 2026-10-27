/**
 * Sends a signed carrier webhook to the running app, the way a carrier
 * would: a tracking update for one shipment, over HTTPS (through nginx).
 *
 *   npm run webhook:carrier -- <trackingId> <status> "<location>" [eventId] [occurredAt]
 *   npm run webhook:carrier -- TRK-4A6F90 in_transit "Lyon hub"
 *
 * Reuse an eventId to see a redelivery logged as a duplicate. Give an
 * occurredAt (ISO 8601, e.g. 2026-10-27T09:00:00Z) to send events out of
 * order: one older than an event already applied is skipped (SUPERSEDED).
 *
 * Reads from backend/.env:
 *  - CARRIER_WEBHOOK_SECRET, to sign the request;
 *  - CARRIER_WEBHOOK_URL, default https://localhost/api/webhooks/carrier;
 *  - CARRIER_CA_CERT, the path of a certificate to trust: nginx's
 *    self-signed one, which isn't trusted otherwise. Copy it out once:
 *      docker compose cp nginx:/etc/nginx/certs/server.crt /tmp/shiptrack-localhost.crt
 *    then CARRIER_CA_CERT=/tmp/shiptrack-localhost.crt. Certificates are
 *    always checked; there is no way to skip that.
 */
import { createHmac, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { request } from 'https';
import { config } from 'dotenv';

config();

const DEFAULT_URL = 'https://localhost/api/webhooks/carrier';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** POST over HTTPS, trusting `ca` too when given. Resolves with the status and body. */
function post(
  url: URL,
  headers: Record<string, string>,
  body: string,
  ca?: Buffer,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'POST', headers, ca }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (text += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

async function main(): Promise<void> {
  const [
    trackingId,
    status,
    location,
    eventId = `evt_${randomUUID()}`,
    occurredAt = new Date().toISOString(),
  ] = process.argv.slice(2);
  const secret = process.env.CARRIER_WEBHOOK_SECRET;
  if (!trackingId || !status || !location) {
    fail(
      'Usage: npm run webhook:carrier -- <trackingId> <in_transit|out_for_delivery|delivered> "<location>" [eventId] [occurredAt]',
    );
  }
  if (!secret) {
    fail('Set CARRIER_WEBHOOK_SECRET in backend/.env first.');
  }
  const url = new URL(process.env.CARRIER_WEBHOOK_URL || DEFAULT_URL);
  if (url.protocol !== 'https:') {
    fail(`CARRIER_WEBHOOK_URL must be https:// (got ${url.protocol}//).`);
  }
  const caPath = process.env.CARRIER_CA_CERT;
  const ca = caPath ? readFileSync(caPath) : undefined;

  const body = JSON.stringify({
    eventId,
    type: 'tracking.updated',
    data: { trackingId, status, location, occurredAt },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  try {
    const response = await post(
      url,
      {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(body)),
        'Carrier-Signature': `t=${timestamp},v1=${signature}`,
      },
      body,
      ca,
    );
    console.log(`${response.status} ${response.text}`);
    console.log(`eventId: ${eventId}`);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? '';
    if (code.includes('CERT') || code.includes('SELF_SIGNED')) {
      fail(
        `${code}: the certificate isn't trusted. Set CARRIER_CA_CERT to nginx's certificate (see the top of this script).`,
      );
    }
    throw error;
  }
}

void main();
