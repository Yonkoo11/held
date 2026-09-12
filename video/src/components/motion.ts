import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/** The one entrance used everywhere: opacity from 0, scale from 0.96, a small rise. Nothing pops. */
export const useEnter = (delay = 0, rise = 14) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 120 } });
  return {
    opacity: interpolate(p, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
    transform: `translateY(${interpolate(p, [0, 1], [rise, 0])}px) scale(${interpolate(p, [0, 1], [0.96, 1])})`,
  };
};
