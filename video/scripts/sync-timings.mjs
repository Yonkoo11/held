// Reads the narration clips Dami records into video/public/audio/<scene>.m4a, measures each one,
// and writes src/narration.json so the render picks them up.
//
// It does not stretch scenes to fit. A clip scene is bounded by its footage, and stretching it
// would mean freezing a frame, which reads as a stall. Instead this reports any scene where the
// narration runs past the picture and says exactly how many seconds to cut. That keeps the edit
// honest and keeps the runtime inside ETHGlobal's 2:00-4:00 window.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const audioDir = path.join(root, "public", "audio");
const FPS = 30;

const seconds = (file) => Number(execFileSync("ffprobe", [
  "-v", "error", "-show_entries", "format=duration",
  "-of", "default=noprint_wrappers=1:nokey=1", file,
], { encoding: "utf8" }).trim());

// Frame counts come from scene-frames.json, which `npm run frames` regenerates by importing
// constants.ts itself. Nothing here re-derives the timing, so the two cannot drift apart.
const framesFile = path.join(root, "src", "scene-frames.json");
if (!fs.existsSync(framesFile)) {
  console.error("run `npm run frames` first (or just use `npm run timings`, which does both)");
  process.exit(1);
}
const { scenes: sceneFrames, total } = JSON.parse(fs.readFileSync(framesFile, "utf8"));
const scenes = Object.keys(sceneFrames);

const out = {};
const rows = [];
let overflow = 0;

for (const key of scenes) {
  const file = ["m4a", "mp3", "wav", "aac"].map((e) => path.join(audioDir, `${key}.${e}`)).find(fs.existsSync);
  if (!file) { rows.push([key, "-", "no clip yet", ""]); continue; }
  const raw = seconds(file);
  out[key] = { file: `audio/${path.basename(file)}`, seconds: raw, frames: Math.round(raw * FPS) };
  rows.push([key, raw.toFixed(1) + "s", "", ""]);
}

fs.writeFileSync(path.join(root, "src", "narration.json"), JSON.stringify(out, null, 2) + "\n");

const frameOf = Object.fromEntries(Object.entries(sceneFrames).map(([k, f]) => [k, f / FPS]));

console.log("\n  scene            picture   narration   verdict");
console.log("  " + "-".repeat(52));
for (const [key] of rows) {
  const pic = frameOf[key];
  const nar = out[key]?.seconds;
  const picTxt = pic.toFixed(1) + "s";
  if (nar === undefined) { console.log(`  ${key.padEnd(16)} ${picTxt.padEnd(9)} ${"-".padEnd(11)} no clip recorded yet`); continue; }
  const over = nar - pic;
  const verdict = over > 0.3 ? `OVER by ${over.toFixed(1)}s, cut a sentence` : "fits";
  if (over > 0.3) overflow += 1;
  console.log(`  ${key.padEnd(16)} ${picTxt.padEnd(9)} ${(nar.toFixed(1) + "s").padEnd(11)} ${verdict}`);
}

const runtime = total / FPS;
console.log("\n  runtime " + Math.floor(runtime / 60) + ":" + String(Math.round(runtime % 60)).padStart(2, "0")
  + (runtime >= 120 && runtime <= 240 ? "  (inside ETHGlobal's 2:00-4:00 window)" : "  OUT OF RANGE — the upload will reject this"));

const have = Object.keys(out).length;
console.log("\n  " + `${have} of ${scenes.length} scenes have narration.`);
if (overflow) console.log(`  ${overflow} scene(s) run long. Trim those and run this again.`);
else if (have === scenes.length) console.log("  All scenes fit. Run: npm run render");
