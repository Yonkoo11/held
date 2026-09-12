# OutcomeLock — proof of a live run

Run at 2026-09-12T07:11:11.991Z
Settlement tier: **hedera-testnet** — Hedera testnet — real USDC, real escrow account
Asset: HBAR (0.0.0)

**Every transaction below was confirmed by an independent read of the Hedera mirror node.**

## Cases exercised

| case | job | state | settlement tx | decision tx |
|---|---|---|---|---|
| buyer approves | `119fc801` | released | `0.0.7162784@1789197001.078284715` | `0.0.10491999@1789197020.861348778` |
| buyer rejects | `29a8489d` | refunded | `0.0.7162784@1789197029.111958138` | `0.0.10491999@1789197051.882020405` |

## Independent mirror-node verification

| job | what | transaction | found | result |
|---|---|---|---|---|
| `119fc801` | settlement | `0.0.7162784@1789197001.078284715` | yes | SUCCESS |
| `119fc801` | decision | `0.0.10491999@1789197020.861348778` | yes | SUCCESS |
| `29a8489d` | settlement | `0.0.7162784@1789197029.111958138` | yes | SUCCESS |
| `29a8489d` | decision | `0.0.10491999@1789197051.882020405` | yes | SUCCESS |

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
```
