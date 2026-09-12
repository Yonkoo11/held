<!-- Comparable research done with the browser open, not from memory. Each entry names what was fetched and what rule came out of it. -->

# Design Research — OutcomeLock

Phase 1.5. Every comparable below was actually fetched or searched on 2026-09-12, not recalled.

The specific product experience being studied is **not** "crypto dashboard". It is: *money you have
already paid is being held, you are looking at what you got for it, and a clock is running on your
decision.* The comparables were chosen for that, plus craft benchmarks.

---

## 1. Stripe — manual capture / uncaptured payments
**Fetched:** <https://docs.stripe.com/payments/place-a-hold-on-a-payment-method>

The closest real-world analog: authorize now, capture later, with an expiry.

- **The state has a one-word name: `Uncaptured`.** It appears as a status on the payments list, not
  as a paragraph explaining itself.
- **The decision verbs are `Capture` and `Cancel`.** Two words. No "Are you happy with this?"
- The expiry is a concrete field — `capture_before` — not a vague "soon". Windows are stated in
  days per card brand, in a table.
- **The critical inversion for us:** in Stripe, *"If the authorization expires before you capture
  the funds, the funds are released and the payment status changes to `canceled`."* Expiry returns
  money to the **payer**. OutcomeLock does the opposite — expiry pays the **seller**.

**Steal this:** a one-word status, two-verb decisions, and an exact timestamp rather than a mood.
**Design consequence:** because we invert everyone's card-shaped intuition, the deadline cannot be
a quiet caption. It has to be the loudest live thing on the page and say who gets paid.

## 2. Stripe / Linear / Vercel craft teardown
**Fetched:** <https://mantlr.com/blog/stripe-linear-vercel-premium-ui>

- All three commit to a **single typeface family** and **4–6 sizes on a modular scale**.
- Colour restraint is the shared tell: Stripe "mostly neutrals plus measured indigo", Linear "cool
  grays plus brand indigo", Vercel "near-monochrome plus context colour". **Colour carries meaning
  (red = danger, green = success), never decoration.**
- **Six states per interactive element**: default, hover, focus (keyboard), active, disabled,
  loading — each with deliberate colour, transition and feel.
- They avoid: browser-default transitions on things users see repeatedly, unmodified component
  library installs, generic spinners (use layout-matching skeletons), decorative/mixed display
  fonts, colour-per-card decoration.

**Steal this:** six states, one family, meaning-only colour.

## 3. Linear and Mercury — measured tokens
**Searched:** design token benchmarks and teardowns, 2026-09-12

- Linear: Inter Variable with `cv01`/`ss03` on globally. **Aggressive negative tracking at display
  sizes** (-1.584px at 72px down to -1.056px at 48px). Hairlines step `#23252a → #34343a → #3e3e44`.
  *"Linear trusts surface lift and hairline borders to carry every bit of hierarchy."*
- Mercury (a bank, so the closest domain match): two custom faces, and an **intermediate weight axis
  — 360 / 420 / 480 / 530** that deliberately avoids the bold/light binary. "Confident but never
  loud."

**Steal this:** hierarchy from surface lift + hairlines rather than boxes; weights in the 400–530
band instead of 400-vs-700; real negative tracking on display type.

## 4. a studied portfolio — measured in the corpus (SR-1..SR-8), 2026-09-12
`~/.claude/skills/design-taste/studied-references.md`

Rows with hairlines instead of cards (SR-1). Type ratio 4.5× (SR-2). Right-aligned metadata forming
a second vertical edge (SR-3). Mono for metadata only, sans for prose (SR-4). One accent used
exactly three times (SR-5). Content at ~45% viewport width (SR-6). A status element carrying live
information, not a decorative badge (SR-7). Quantified copy, no adjectives (SR-8).

---

## Common patterns — table stakes

- One typeface family, 4–6 sizes, modular scale.
- One accent colour, used for meaning only, three times or fewer per viewport.
- Hierarchy from surface elevation and hairlines, not from bordered boxes.
- Six states on every interactive element.
- Exact values — timestamps, ids, amounts — never approximations.

## Differentiation opportunities

1. **Nobody in this space designs the deadline as the subject.** Stripe's expiry is an API field
   in a docs table. Ours is the single most surprising fact about the product (silence pays the
   seller) and it is genuinely live. That is the signature element.
2. **Light, not dark.** Every comparable in crypto is dark; `forbidden-patterns.md` bans the
   Crypto/DeFi template outright and `style.config.md` says dark must re-earn its place. A payment
   under review is a *financial record*. Paper is the honest metaphor and, at this event, the
   differentiating one.
3. **The escrow line itself.** `payTo` pointing at an escrow account rather than the seller is the
   entire product, and it appears nowhere in any comparable, because no comparable does it.

## Anti-patterns to avoid (seen in the field, banned by the corpus)

- Dark near-black + neon accent + mono-everything. Named cliché. It is what the current page is.
- Identical bordered cards in a grid. Flat-box violation, CF-2.
- Hover that changes colour only. CF-4.
- Decorative badges with no information in them. SR-7.
- Adjective-led copy. Model-written headlines. copy-rules 1 and SR-8.

## Stolen elements — adopt and adapt

| from | element |
|---|---|
| Stripe | one-word status; two-verb decisions; an exact expiry, not a mood |
| Linear | hierarchy from surface lift + hairline steps; real negative tracking on display type |
| Mercury | weight axis in the 400–530 band; "confident but never loud" |
| a studied portfolio | hairline rows instead of cards; ~4.5× type ratio; right-aligned metadata edge; one accent, three uses |

---

## 5. Christian Baroni — the named bar, measured 2026-09-12 (not recalled)

**Fetched:** <https://baroni.co/> and <https://rainbow.me/>
Second designer at Stripe, co-founder of Rainbow. Swiss-influenced, New York.

### What baroni.co actually is
White ground. **Single centred column at roughly 80% width. Five sections. No cards, no borders,
no shadows, no dates, no metadata chips, no badges.** Emphasis is carried by bold weight alone,
never by colour. Images sit between sections and do the visual work.

Opening line, verbatim: *"My name is Christian Baroni and I'm a designer from New York."*

### BR-1 — The restraint is the signature
There is no signature *object* on baroni.co. The absence of every decoration a generated page
reaches for IS the signal. Measured against our page: we are carrying a noise overlay, two radial
glows, an accent-glow box-shadow, seven uppercase mono micro-labels and roughly ten accent
placements. He carries none of those and reads more expensive.

### BR-2 — Plain first-person prose, not slogans
No rhetorical construction anywhere. No antithesis, no triadic parallelism, no "X is the new Y".
A sentence a person would actually say out loud, in the order they would say it.

**This is the specific tell in our current copy.** "A card authorisation expires backwards. This
one expires forwards" and "Approve and it goes right. Reject and it comes back left. Say nothing
and it still goes right" are both machine rhythms: balanced antithesis and three-beat parallelism.
They read clever, which is exactly the problem. A person writing at speed does not produce them.

### BR-3 — Rainbow: the headline describes, it does not sell
*"The easiest way to trade any market from your phone."* A description of the product, in one
sentence, with no metaphor. Uppercase micro-labels exist there but only as **category names**
(CRYPTO, PREDICTIONS, PERPS), never as decorative eyebrow text above a heading.

### Rules taken from this
| # | rule |
|---|---|
| BR-a | Uppercase mono labels name a category or a data field. Never an eyebrow above a heading. Cap: 3 per viewport. |
| BR-b | No rhetorical figures in UI copy. No antithesis, no triads, no reversals. Say the thing once. |
| BR-c | Decoration must be removed until something breaks. Noise overlays and accent glows are the first two to go. |
| BR-d | Emphasis by weight before emphasis by colour. Never both on the same phrase. |

### Not found: "Belle Murray"
Searched; no designer by that name is findable. The closest result is Heather Murray (game UI).
Recorded as unidentified rather than guessed at. A link would fix this in one pass.
