import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BAND, COLORS, Title } from "../constants";
import { DISPLAY, MONO } from "../fonts";

/** The title strip: paper, a hairline on top, the beat in the display face, the step in mono.
 *  Titles cross-fade at their own second marks. */
export const Strip: React.FC<{ titles: Title[]; step: string }> = ({ titles, step }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const IN = 12;
  const OUT = 8;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: BAND, background: COLORS.paper, borderTop: `1px solid ${COLORS.ruleStrong}` }}>
      <div style={{ position: "absolute", left: 56, right: 56, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
        <div style={{ position: "relative", flex: 1, height: "100%" }}>
          {titles.map((t, i) => {
            const at = Math.round(t.at * fps);
            const next = titles[i + 1] ? Math.round(titles[i + 1].at * fps) : Infinity;
            const fadeIn = interpolate(frame, [at, at + IN], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const fadeOut = next === Infinity ? 1 : interpolate(frame, [next - OUT, next], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const rise = interpolate(fadeIn, [0, 1], [8, 0]);
            const opacity = Math.min(fadeIn, fadeOut);
            if (opacity <= 0) return null;
            return (
              <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", opacity, transform: `translateY(${rise}px)` }}>
                <span style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: 36, lineHeight: 1.15, letterSpacing: "-0.02em", color: COLORS.ink, maxWidth: 1480 }}>{t.text}</span>
              </div>
            );
          })}
        </div>
        <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 15, letterSpacing: "0.16em", textTransform: "uppercase", color: COLORS.ink3, whiteSpace: "nowrap" }}>{step}</span>
      </div>
    </div>
  );
};
