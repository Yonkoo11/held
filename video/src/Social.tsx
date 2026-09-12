import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, M1, PRODUCT, SOCIAL, SOCIAL_FRAMES } from "./constants";
import { DISPLAY, MONO, SANS } from "./fonts";
import { useEnter } from "./components/motion";

export const SOCIAL_W = 1080;
export const SOCIAL_H = 1920;

/** Vertical clip: the hook in the display face, then the real row edge from Take 1, the clock ticking. */
export const Social: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = useEnter(0, 6);
  const hook = useEnter(4, 18);
  const line = useEnter(14, 12);
  const inset = useEnter(26, 16);
  const tail = useEnter(40, 8);
  const exit = interpolate(frame, [SOCIAL_FRAMES - 20, SOCIAL_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // The crop: the right edge of the newest row (amount, HELD, the clock, the button).
  const crop = { x: 1180, y: 385, w: 740, h: 250 };
  const boxW = 960;
  const k = boxW / crop.w;
  const boxH = Math.round(crop.h * k);
  return (
    <AbsoluteFill style={{ background: COLORS.paper, color: COLORS.ink, opacity: exit }}>
      <div style={{ position: "absolute", left: 72, top: 84, fontFamily: SANS, fontWeight: 500, fontSize: 30, letterSpacing: "-0.015em", ...mark }}>{PRODUCT}</div>
      <div style={{ position: "absolute", left: 72, right: 72, top: 260 }}>
        <div style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: 168, lineHeight: 0.95, letterSpacing: "-0.045em", ...hook }}>{SOCIAL.hook}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: 60, lineHeight: 1.12, letterSpacing: "-0.025em", color: COLORS.ink2, marginTop: 44, ...line }}>{SOCIAL.line}</div>
      </div>
      <div style={{ position: "absolute", left: (SOCIAL_W - boxW) / 2, top: 820, width: boxW, height: boxH, overflow: "hidden", boxShadow: `0 0 0 1px ${COLORS.ruleStrong}`, background: COLORS.paper, ...inset }}>
        <div style={{ transform: `translate(${-crop.x * k}px, ${-crop.y * k}px) scale(${k})`, transformOrigin: "top left", width: 1920, height: 1080 }}>
          <OffthreadVideo src={staticFile("video/take1.mp4")} muted startFrom={Math.round((M1.row + 0.3) * fps)} endAt={Math.round((M1.row + 0.3) * fps) + SOCIAL_FRAMES} style={{ width: 1920, height: 1080, display: "block" }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 72, right: 72, top: 820 + boxH + 40, fontFamily: MONO, fontSize: 24, lineHeight: 1.5, color: COLORS.ink3, ...tail }}>{SOCIAL.tail}</div>
    </AbsoluteFill>
  );
};
