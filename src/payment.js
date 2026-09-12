// Builds the X-PAYMENT payload. Shared by the buyer CLI and the proof script so there is exactly
// one place where a payment is constructed.
import { settlementTier, HEDERA_CAIP2 } from './config.js';

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

  const { ExactHederaScheme } = await import('@x402/hedera/exact/client');
  const { createClientHederaSigner } = await import('@x402/hedera');
  const { PrivateKey } = await import('@hiero-ledger/sdk');
  const { accountKeyInfo, parsePrivateKey } = await import('./hedera-key.js');

  const buyerId = process.env.HEDERA_BUYER_ID;
  if (!buyerId || !process.env.HEDERA_BUYER_KEY) {
    throw new Error('no buyer account configured — run: npm run go-live');
  }

  // createClientHederaSigner takes POSITIONAL arguments and a PrivateKey OBJECT:
  //   createClientHederaSigner(accountId: string, privateKey: PrivateKey, config?)
  // Passing a single config object instead fails as "t.startsWith is not a function", which says
  // nothing useful about the cause. Checked against the installed signer type definition.
  const info = await accountKeyInfo(buyerId);
  const { key } = parsePrivateKey(PrivateKey, process.env.HEDERA_BUYER_KEY, info.type);
  // The config's `network` is the CAIP-2 identifier, not the SDK's short name: 'testnet' is
  // rejected as "Unsupported Hedera network" even though the type's doc comment calls it the default.
  const signer = createClientHederaSigner(buyerId, key, { network: HEDERA_CAIP2 });

  const scheme = new ExactHederaScheme(signer);
  const result = await scheme.createPaymentPayload(2, accepted);
  return { x402Version: 2, accepted, payload: result.payload };
}
