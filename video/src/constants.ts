// Every string, colour and duration in the video lives here. Cut points on the recordings come
// from the marker files the filming scripts write (seconds since the recording started), so a
// re-film needs no edits in the scene code.
import take1 from "../public/video/take1.json";
import take2 from "../public/video/take2.json";

export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const CROSSFADE = 15;
/** Height of the title strip at the bottom of every recorded scene. */
export const BAND = 136;
/** Height of the header band (mark left, network strip right) at the top of every recorded scene. */
export const HEAD = 66;
/** What the page's own nav says, read off public/index.html and /health. */
export const NAV_STRIP = `hedera testnet · x402 via Blocky402 · escrow ${"0.0.10495061"}`;

// public/index.html tokens. One accent, hairlines, paper. Nothing else.
export const COLORS = {
  paper: "#faf8f4",
  paperSunk: "#f1eee6",
  surface: "#fdfbf6",
  ink: "#17150f",
  ink2: "rgba(23,21,15,0.64)",
  ink3: "rgba(23,21,15,0.44)",
  rule: "rgba(23,21,15,0.11)",
  ruleStrong: "rgba(23,21,15,0.24)",
  accent: "#b0431c",
  paid: "#2f6b43",
};

// Read off the page and the ledger (public/index.html nav, /health, PROOF.md). Never typed from memory.
export const ESCROW = "0.0.10495061";
export const TOPIC = "0.0.10495064";
// The service ran behind a tunnel that has already expired twice, so nothing on screen depends on
// a live URL. The terminal uses the shell variable a developer would actually type, and the close
// card carries the escrow account, which anyone can verify on the mirror node for as long as the
// testnet exists.
export const PUBLIC_URL = "$HELD_URL";
export const PRODUCT = "Held";

const sec = (s: number) => Math.round(s * FPS);
export const M1 = take1.marks;
export const M2 = take2.marks;

export type Title = { at: number; text: string }; // at: seconds into the scene
export type Segment = { from: number; to: number }; // seconds in the source recording

export type Scene =
  | { key: string; kind: "card"; frames: number; step: string; lines: string[]; small?: string }
  | { key: string; kind: "clip"; frames: number; step: string; file: string; segments: Segment[]; titles: Title[]; cropTop?: number }
  | { key: string; kind: "terminal"; frames: number; step: string; titles: Title[] }
  | { key: string; kind: "proof"; frames: number; step: string; file: string; segments: Segment[]; titles: Title[]; caption: string };

const clipFrames = (segments: Segment[]) => segments.reduce((a, s) => a + sec(s.to - s.from), 0);

// Take 1 (re-filmed 2026-09-13 against the rebuilt site). The buy lives on /ask now and the wire
// on /, so the take navigates between them; the marks below are measured, never guessed.
//
// The old edit cut a hole in the middle because settlement took 44 seconds and ETHGlobal's guidance
// is to cut waiting rather than sit in it. On this take the same wait is 9 seconds, so there is no
// dead time left to remove and the three scenes are one contiguous run. What is NOT free to change
// is their length: the narration is recorded per scene against fixed durations, so these segments
// are anchored to the END of the recording and sized to the exact figures the old edit produced
// (21.51s, 16.04s, 11.22s). Re-film and the numbers move; the durations must not.
// The end mark is taken when the script stops, a hair after the last frame ffmpeg wrote. Reading
// right up to it renders a black tail, so back off 50ms. The scene lengths are unaffected.
const T1_END = M1.end - 0.05;
const PAY_LEN = 21.51, ROW_LEN = 16.04, APPROVE_LEN = 11.22;
const T1_START = +(T1_END - (PAY_LEN + ROW_LEN + APPROVE_LEN)).toFixed(2);

const paySeg: Segment[] = [{ from: T1_START, to: +(T1_START + PAY_LEN).toFixed(2) }];
const rowSeg: Segment[] = [{ from: paySeg[0].to, to: +(paySeg[0].to + ROW_LEN).toFixed(2) }];
const approveSeg: Segment[] = [{ from: rowSeg[0].to, to: +(rowSeg[0].to + APPROVE_LEN).toFixed(2) }];

// Take 2: the last nine seconds of the countdown through "releasing", then a cut to the flip.
// Take 2 (re-filmed 2026-09-13). Twelve seconds of the countdown running out, then eight of the
// flip. The tail sits at released-2.1 rather than released-1.5 because released+6.5 would have read
// 0.5s past the end of this recording, and a clip that runs off the end of its source renders black.
// Lengths are unchanged at 12s + 8s, because the narration is cut to 20s.
const deadlineSeg: Segment[] = [
  { from: M2.zero - 9, to: M2.zero + 3 },
  { from: M2.released - 2.1, to: M2.released + 5.9 },
];

export const SCENES: readonly Scene[] = [
  {
    key: "open", kind: "card", frames: sec(8), step: "",
    lines: ["Held."], small: "You pay first. The money waits until you have read what you bought.",
  },
  {
    key: "claim", kind: "clip", frames: sec(12), step: "1 of 7 · the claim", file: "video/top.mp4",
    segments: [{ from: 0.2, to: 12.2 }], cropTop: HEAD, // the page's own nav sits under the header band
    titles: [
      { at: 0, text: "x402 pays the seller the instant the response is written." },
      { at: 4, text: "For agent work that is backwards." },
      { at: 8, text: "Held changes one field. payTo is an escrow account." },
    ],
  },
  {
    key: "quote", kind: "terminal", frames: sec(23), step: "2 of 7 · the 402",
    titles: [
      { at: 0, text: "Here is the actual 402. Hedera testnet, priced in HBAR." },
      { at: 5, text: "payTo is the escrow account, not the seller's." },
      { at: 9.5, text: "The facilitator pays the gas, so the buying agent needs none." },
      { at: 15, text: "And the extension states all three endings up front, before you pay." },
    ],
  },
  {
    key: "pay", kind: "clip", frames: clipFrames(paySeg), step: "3 of 7 · pay", file: "video/take1.mp4",
    segments: paySeg,
    titles: [
      { at: 0, text: "Ask the agent something, then Pay and ask." },
      { at: M1.pay - paySeg[0].from + 0.4, text: "That is a real payment settling on Hedera testnet right now." },
      { at: M1.pay - paySeg[0].from + 6, text: "Blocky402 verifies it, the agent does the work, then it settles." },
      { at: M1.pay - paySeg[0].from + 12, text: "The money lands in escrow, not with the seller." },
    ],
  },
  {
    key: "row", kind: "clip", frames: clipFrames(rowSeg), step: "4 of 7 · held", file: "video/take1.mp4",
    segments: rowSeg, cropTop: HEAD, // this scene visits / , whose own nav would double the header band
    titles: [
      { at: 0, text: "The answer arrives at once. The money does not." },
      { at: 4, text: "That clock is a Hedera scheduled transaction." },
      { at: M1.wire - rowSeg[0].from, text: "The wire up top shows the same clock." },
      // row2 lands in the approve scene on the new take, so this is timed against the scene
      // itself: it reads over the wire, which is exactly what the line is about.
      { at: 12.2, text: "If I do nothing, it still pays the seller." },
    ],
  },
  {
    key: "approve", kind: "clip", frames: clipFrames(approveSeg), step: "5 of 7 · approve", file: "video/take1.mp4",
    segments: approveSeg,
    titles: [
      { at: 0, text: "I approve, and the escrow pays the seller." },
      { at: M1.released - approveSeg[0].from + 0.6, text: "RELEASED, with a real transaction id. Reject instead and the same escrow refunds me." },
    ],
  },
  {
    key: "deadline", kind: "clip", frames: clipFrames(deadlineSeg), step: "6 of 7 · the deadline", file: "video/take2.mp4",
    segments: deadlineSeg,
    titles: [
      { at: 0, text: "A second server with a 90 second window. Nobody clicks anything here." },
      { at: 8.5, text: "The window runs out." },
      { at: 12.5, text: "Hedera executed the scheduled transaction and paid the seller. The service only watched." },
    ],
  },
  {
    key: "proof-account", kind: "proof", frames: sec(8.9), step: "7 of 7 · proof", file: "video/take3-account.mp4",
    segments: [{ from: 0.05, to: 8.95 }], caption: `hashscan.io · escrow account ${ESCROW}`,
    titles: [
      { at: 0, text: "None of this needs you to trust the service." },
      { at: 3.5, text: "Every payment, release and refund is on the public ledger." },
    ],
  },
  {
    key: "proof-topic", kind: "proof", frames: sec(7), step: "7 of 7 · proof", file: "video/take3-topic.mp4",
    segments: [{ from: 0.0, to: 7.0 }], caption: `hashscan.io · evidence topic ${TOPIC}`,
    titles: [
      { at: 0, text: "And the evidence trail is on a consensus topic anyone can read." },
    ],
  },
  {
    key: "close", kind: "card", frames: sec(11), step: "",
    lines: ["Held."], small: `Escrow for agent work, settled on Hedera  ·  escrow ${ESCROW}  ·  topic ${TOPIC}`,
  },
];

export const TOTAL_FRAMES = SCENES.reduce((a, s) => a + s.frames, 0) - CROSSFADE * (SCENES.length - 1);

// The 402, as returned by POST /work on the public URL (public/402.json), trimmed to fourteen lines.
export const TERMINAL_LINES: { text: string; hot?: boolean; cont?: boolean }[] = [
  { text: `$ curl -s -i -X POST "$HELD_URL/work" -d '{"question":"..."}'` },
  { text: "HTTP/2 402 Payment Required" },
  { text: '{ "accepts": [{ "scheme": "exact",' },
  { text: '    "network": "hedera:testnet",', hot: true },
  { text: '    "asset": "0.0.0",', hot: true },
  { text: '    "amount": "5000000",' },
  { text: `    "payTo": "${ESCROW}",`, hot: true },
  { text: '    "extra": { "feePayer": "0.0.7162784" }' },
  { text: "  }]," },
  { text: '  "extensions": { "held": {' },
  { text: `    "escrow": "${ESCROW}",` },
  { text: '    "reviewWindowMinutes": 20,' },
  { text: '    "releasePolicy": "approve pays the seller, reject refunds you,', hot: true },
  { text: '                     silence pays the seller at the deadline"', hot: true, cont: true },
  { text: "  }}}" },
];
export const TERMINAL_CPS = 60; // characters per second

// Social clip, 1080x1920, silent.
export const SOCIAL_FRAMES = sec(11);
export const SOCIAL = {
  hook: "You pay first.",
  line: "The money waits until you have read what you bought.",
  tail: "Held · escrow for agent work on Hedera",
};
