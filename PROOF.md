# OutcomeLock — proof of a live run

Run at 2026-09-12T07:25:52.456Z
Settlement tier: **hedera-testnet** — Hedera testnet — real USDC, real escrow account
Asset: HBAR (0.0.0)

**Every transaction below was confirmed by an independent read of the Hedera mirror node.**

## Cases exercised

| case | job | state | settlement tx | decision tx |
|---|---|---|---|---|
| buyer approves | `94377e51` | released | `0.0.7162784@1789197739.434402391` | `0.0.10491999@1789197768.214338977` |
| buyer rejects | `7b60fc28` | refunded | `0.0.7162784@1789197772.798259066` | `0.0.10491999@1789197798.052587092` |
| buyer says nothing | `37b24025` | released | `0.0.7162784@1789197814.115347085` | `0.0.10491999-1789197836-101370207` |

## Independent mirror-node verification

| job | what | transaction | found | result |
|---|---|---|---|---|
| `94377e51` | settlement | `0.0.7162784@1789197739.434402391` | yes | SUCCESS |
| `94377e51` | decision | `0.0.10491999@1789197768.214338977` | yes | SUCCESS |
| `7b60fc28` | settlement | `0.0.7162784@1789197772.798259066` | yes | SUCCESS |
| `7b60fc28` | decision | `0.0.10491999@1789197798.052587092` | yes | SUCCESS |
| `37b24025` | settlement | `0.0.7162784@1789197814.115347085` | yes | SUCCESS |
| `37b24025` | decision | `0.0.10491999-1789197836-101370207` | yes | SUCCESS |

## The deadline case

The buyer was not asked and did nothing. Hedera's own scheduled transaction
`0.0.10495601` released the escrow at expiry — the service only observed it.
Look it up: https://hashscan.io/testnet/schedule/0.0.10495601

## Look it up yourself

- escrow account: https://hashscan.io/testnet/account/0.0.10495061
- evidence topic: https://hashscan.io/testnet/topic/0.0.10495064

## Evidence trail as recorded on consensus

```
2026-09-12T07:04:09.082Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789196629.457205
2026-09-12T07:04:09.871Z  delivered          {"questionHash":"669228ea403a917a7c7f61abc342ef5dc19dda521453d32c02c7c61b54a978a0","deliverableHash"
2026-09-12T07:04:10.150Z  escrow-scheduled   {"scheduleId":"0.0.10495250","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:14:02.800Z"}
2026-09-12T07:04:28.432Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789196652.214456
2026-09-12T07:04:28.980Z  delivered          {"questionHash":"9d84d03dc8621bb15938cf5562e30ffbaee6e828c9bb4def3d0d4fc57c771ffc","deliverableHash"
2026-09-12T07:04:29.981Z  escrow-scheduled   {"scheduleId":"0.0.10495256","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:14:26.311Z"}
2026-09-12T07:06:04.881Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789196742.987399
2026-09-12T07:06:05.608Z  delivered          {"questionHash":"669228ea403a917a7c7f61abc342ef5dc19dda521453d32c02c7c61b54a978a0","deliverableHash"
2026-09-12T07:06:06.199Z  escrow-scheduled   {"scheduleId":"0.0.10495286","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:16:02.850Z"}
2026-09-12T07:07:45.321Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789196845.480763
2026-09-12T07:07:46.708Z  delivered          {"questionHash":"669228ea403a917a7c7f61abc342ef5dc19dda521453d32c02c7c61b54a978a0","deliverableHash"
2026-09-12T07:07:48.788Z  escrow-scheduled   {"scheduleId":"0.0.10495324","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:17:39.089Z"}
2026-09-12T07:07:53.269Z  released           {"reason":"answered the question","tx":"SUCCESS","by":"buyer"}
2026-09-12T07:08:07.210Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789196870.701449
2026-09-12T07:08:07.888Z  delivered          {"questionHash":"9d84d03dc8621bb15938cf5562e30ffbaee6e828c9bb4def3d0d4fc57c771ffc","deliverableHash"
2026-09-12T07:08:10.184Z  escrow-scheduled   {"scheduleId":"0.0.10495332","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:18:05.519Z"}
2026-09-12T07:08:14.569Z  refunded           {"reason":"not specific enough","tx":"SUCCESS","by":"buyer"}
2026-09-12T07:10:25.490Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789197001.078284
2026-09-12T07:10:26.378Z  delivered          {"questionHash":"669228ea403a917a7c7f61abc342ef5dc19dda521453d32c02c7c61b54a978a0","deliverableHash"
2026-09-12T07:10:27.088Z  escrow-scheduled   {"scheduleId":"0.0.10495378","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:20:17.749Z"}
2026-09-12T07:10:30.289Z  released           {"reason":"answered the question","tx":"0.0.10491999@1789197020.861348778","by":"buyer"}
2026-09-12T07:10:53.459Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789197029.111958
2026-09-12T07:10:54.169Z  delivered          {"questionHash":"9d84d03dc8621bb15938cf5562e30ffbaee6e828c9bb4def3d0d4fc57c771ffc","deliverableHash"
2026-09-12T07:10:54.888Z  escrow-scheduled   {"scheduleId":"0.0.10495384","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:20:51.658Z"}
2026-09-12T07:10:57.706Z  refunded           {"reason":"not specific enough","tx":"0.0.10491999@1789197051.882020405","by":"buyer"}
2026-09-12T07:12:58.641Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789197153.221430
2026-09-12T07:12:59.800Z  delivered          {"questionHash":"38a93ef46f868e38a9842b095cc6edfb29728a25287124a5820fd50bbbec1e0d","deliverableHash"
2026-09-12T07:13:00.388Z  escrow-scheduled   {"scheduleId":"0.0.10495418","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:13:53.308Z"}
2026-09-12T07:13:34.059Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789197193.521657
2026-09-12T07:13:34.628Z  delivered          {"questionHash":"38a93ef46f868e38a9842b095cc6edfb29728a25287124a5820fd50bbbec1e0d","deliverableHash"
2026-09-12T07:13:34.998Z  escrow-scheduled   {"scheduleId":"0.0.10495429","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:14:30.639Z"}
2026-09-12T07:13:59.245Z  released           {"reason":"review window expired","tx":"0.0.10491999@1789197230.326390396","by":"deadline"}
2026-09-12T07:14:45.017Z  released           {"reason":"review window expired","tx":"0.0.10491999@1789197275.096514563","by":"deadline"}
2026-09-12T07:17:11.499Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789197400.340600
2026-09-12T07:17:15.696Z  delivered          {"questionHash":"8a3713d05fa7f8ef2093696c336d2c93e8c59686cc6236fff30cfafda0fdfb94","deliverableHash"
2026-09-12T07:17:16.095Z  escrow-scheduled   {"scheduleId":"0.0.10495482","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:18:03.255Z"}
2026-09-12T07:18:12.180Z  released           {"reason":"review window expired","tx":"0.0.10491999-1789197422-138920296","by":"hedera-scheduled-tr
2026-09-12T07:22:50.514Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789197739.434402
2026-09-12T07:22:51.455Z  delivered          {"questionHash":"669228ea403a917a7c7f61abc342ef5dc19dda521453d32c02c7c61b54a978a0","deliverableHash"
2026-09-12T07:22:51.855Z  escrow-scheduled   {"scheduleId":"0.0.10495579","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:23:44.205Z"}
2026-09-12T07:22:55.042Z  released           {"reason":"answered the question","tx":"0.0.10491999@1789197768.214338977","by":"buyer"}
2026-09-12T07:23:20.233Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789197772.798259
2026-09-12T07:23:21.067Z  delivered          {"questionHash":"9d84d03dc8621bb15938cf5562e30ffbaee6e828c9bb4def3d0d4fc57c771ffc","deliverableHash"
2026-09-12T07:23:21.977Z  escrow-scheduled   {"scheduleId":"0.0.10495587","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:24:17.906Z"}
2026-09-12T07:23:26.177Z  refunded           {"reason":"not specific enough","tx":"0.0.10491999@1789197798.052587092","by":"buyer"}
2026-09-12T07:24:02.858Z  paid               {"payer":"0.0.10495063","amount":"5000000","asset":"0.0.0","settleTx":"0.0.7162784@1789197814.115347
2026-09-12T07:24:03.766Z  delivered          {"questionHash":"ede12e02b252dd702d3ac24ce3efdd9c0aa8373e15f9d5d900469c65091a57dc","deliverableHash"
2026-09-12T07:24:04.615Z  escrow-scheduled   {"scheduleId":"0.0.10495601","releasesTo":"0.0.10491999","deadline":"2026-09-12T07:24:59.235Z"}
2026-09-12T07:25:11.977Z  released           {"reason":"review window expired","tx":"0.0.10491999-1789197836-101370207","by":"hedera-scheduled-tr
```
