// Builds the X-PAYMENT payload. Shared by the buyer CLI and the proof script so there is exactly
// one place where a payment is constructed.
import { settlementTier } from './config.js';

export async function buildPaymentFor(accepted) {
  const tier = settlementTier();

  if (tier.name !== 'hedera-testnet') {
    // Local stand-in. Marked simulated so only the local facilitator will take it — a payload like
    // this is rejected outright by the real Blocky402 facilitator.
    return {
      x402Version: 2,
      accepted,
      payload: { simulated: true, payer: 'local-buyer', amount: accepted.amount, asset: accepted.asset },
    };
  }

  // UNRUN as of 2026-09-12 — needs a funded testnet buyer account. scripts/go-live.js creates one.
  const { ExactHederaScheme } = await import('@x402/hedera/exact/client');
  const { createClientHederaSigner } = await import('@x402/hedera');
  const signer = createClientHederaSigner({
    accountId: process.env.HEDERA_BUYER_ID,
    privateKey: process.env.HEDERA_BUYER_KEY,
    network: 'testnet',
  });
  const scheme = new ExactHederaScheme(signer);
  const result = await scheme.createPaymentPayload(2, accepted);
  return { x402Version: 2, accepted, payload: result.payload ?? result };
}
