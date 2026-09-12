import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, Scene } from "../constants";
import { DISPLAY, MONO } from "../fonts";
import { useEnter } from "../components/motion";

/** Opening and closing cards: paper, the name in the display face, one line under a hairline. */
export const Card: React.FC<{ scene: Extract<Scene, { kind: "card" }> }> = ({ scene }) => {
  const name = useEnter(0, 18);
  const rule = useEnter(8, 0);
  const line = useEnter(12, 10);
  return (
    <AbsoluteFill style={{ background: COLORS.paper, color: COLORS.ink, justifyContent: "center", padding: "0 160px" }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: 200, lineHeight: 0.95, letterSpacing: "-0.045em", ...name }}>{scene.lines[0]}</div>
      <div style={{ width: 120, height: 2, background: COLORS.accent, margin: "44px 0 36px", ...rule }} />
      {scene.small && (
        <div style={{ fontFamily: MONO, fontWeight: 400, fontSize: 24, lineHeight: 1.5, color: COLORS.ink2, maxWidth: 1400, ...line }}>{scene.small}</div>
      )}
    </AbsoluteFill>
  );
};
