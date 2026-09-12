// Dumps each scene's real frame count so the timing check can never drift from constants.ts.
import fs from "node:fs";
import { SCENES, FPS, TOTAL_FRAMES } from "../src/constants.js";
const out: Record<string, number> = {};
for (const s of SCENES) out[s.key] = s.frames;
fs.writeFileSync(new URL("../src/scene-frames.json", import.meta.url),
  JSON.stringify({ fps: FPS, total: TOTAL_FRAMES, scenes: out }, null, 2) + "\n");
console.log(`scene-frames.json written — ${Object.keys(out).length} scenes, ${(TOTAL_FRAMES / FPS).toFixed(1)}s total`);
