import React from "react";
import { Composition, registerRoot } from "remotion";
import { Main } from "./Main";
import { Social, SOCIAL_H, SOCIAL_W } from "./Social";
import { FPS, H, SOCIAL_FRAMES, TOTAL_FRAMES, W } from "./constants";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Main" component={Main} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="Social" component={Social} durationInFrames={SOCIAL_FRAMES} fps={FPS} width={SOCIAL_W} height={SOCIAL_H} />
  </>
);

registerRoot(RemotionRoot);
