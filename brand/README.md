# The Held mark

**The signature element is a rail with one solid block arrested on it, past the midpoint.**
It encodes a payment caught in transit whose resting state is forward: more path behind the block
than ahead of it, so if nobody intervenes it continues to the seller. A card authorisation does
the opposite, and a mark that sat the block dead-centre would be drawing that product instead.

The page's wire diagram (`you ——[pod]—— the seller`) is the same object at full scale. The logo is
not a separate piece of art placed beside it.

| file | what it is |
|---|---|
| `public/logo.svg` | the mark. Rail bleeds edge to edge, slab at 64%. |
| `public/favicon.svg` | **a second, deliberate drawing** for 16–32px: thicker rail, larger slab. One file cannot do both jobs well, and this is normal practice rather than a shortcut. |
| `public/logo-mono.svg` | single-ink variant for contexts where the accent cannot be trusted |
| `public/favicon-16/32/48.png`, `apple-touch-icon.png`, `logo-512.png` | rendered natively at each size. **Nothing is upscaled.** |
| `public/og.png` | 2400×1260, a 2× render of the 1200×630 spec |
| `brand.json` | tokens + paths. `demo-video` reads this; it had been falling back to text-only because it did not exist. |

## Honest notes

- At exactly **16px the asymmetry is marginal** against a centred block. From 24px up it reads
  clearly. The favicon drawing compensates with heavier proportions; the concept still relies on
  sizes above the floor to land fully.
- Six candidates were drawn and rejected before this one, then four more in a steering round. The
  paper trail is in `explore/`, including `F-centred` and `K-ctrl`, which exist only to test
  whether the asymmetry was doing any work. It was not, at the floor, in round one. That finding
  is why the mark changed shape between rounds.
- Route was vector, so no image model was involved and nothing was generated.
