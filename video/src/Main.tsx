import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile } from "remotion";
import narration from "./narration.json";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { COLORS, CROSSFADE, SCENES, Scene } from "./constants";
import { Card } from "./scenes/Card";
import { Clip } from "./scenes/Clip";
import { Proof } from "./scenes/Proof";
import { Terminal } from "./scenes/Terminal";

type Clip = { file: string; seconds: number; frames: number };
const NARRATION = narration as Record<string, Clip>;

/**
 * Dami's own voice, one clip per scene. Never sped up: ETHGlobal names "sped up to fit the time
 * limit" as a reason to reject a video, so playbackRate stays at 1 and the edit is cut to fit
 * instead. A short fade at each end keeps two scenes' audio from overlapping across the crossfade.
 */
const SceneVoice: React.FC<{ clip: Clip }> = ({ clip }) => (
  <Audio
    src={staticFile(clip.file)}
    volume={(f) => {
      const inF = interpolate(f, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      const outF = interpolate(f, [clip.frames - 24, clip.frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      return Math.min(inF, outF);
    }}
  />
);

const One: React.FC<{ scene: Scene }> = ({ scene }) => {
  switch (scene.kind) {
    case "card": return <Card scene={scene} />;
    case "clip": return <Clip file={scene.file} segments={scene.segments} titles={scene.titles} step={scene.step} cropTop={scene.cropTop} />;
    case "terminal": return <Terminal scene={scene} />;
    case "proof": return <Proof scene={scene} />;
  }
};

export const Main: React.FC = () => {
  const timing = linearTiming({ durationInFrames: CROSSFADE });
  return (
    <AbsoluteFill style={{ background: COLORS.paper }}>
      <TransitionSeries>
        {SCENES.flatMap((scene, i) => {
          const items = [
            <TransitionSeries.Sequence key={scene.key} durationInFrames={scene.frames}>
              <One scene={scene} />
              {NARRATION[scene.key] ? <SceneVoice clip={NARRATION[scene.key]} /> : null}
            </TransitionSeries.Sequence>,
          ];
          if (i < SCENES.length - 1) {
            items.push(<TransitionSeries.Transition key={`t-${scene.key}`} presentation={fade()} timing={timing} />);
          }
          return items;
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
