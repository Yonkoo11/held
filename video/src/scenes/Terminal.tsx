import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, Scene, TERMINAL_CPS, TERMINAL_LINES, W } from "../constants";
import { MONO } from "../fonts";
import { Mark } from "../components/Mark";
import { Strip } from "../components/Strip";
import { useEnter } from "../components/motion";

/** The real 402, typed out. Sunk paper panel, hairline, mono. The four fields that matter turn
 *  accent once their line is complete. */
export const Terminal: React.FC<{ scene: Extract<Scene, { kind: "terminal" }> }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = useEnter(0, 12);
  const visible = Math.floor(Math.max(0, frame - 6) * (TERMINAL_CPS / fps));
  let used = 0;
  const panelW = 1560;
  return (
    <AbsoluteFill style={{ background: COLORS.paper }}>
      <div style={{ position: "absolute", left: (W - panelW) / 2, top: 120, width: panelW, padding: "36px 44px", background: COLORS.paperSunk, boxShadow: `inset 0 0 0 1px ${COLORS.rule}`, borderRadius: 12, ...enter }}>
        <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.16em", textTransform: "uppercase", color: COLORS.ink3, marginBottom: 22 }}>
          POST /work · no payment header
        </div>
        {TERMINAL_LINES.map((l, i) => {
          const start = used;
          used += l.text.length + 1;
          const shown = Math.max(0, Math.min(l.text.length, visible - start));
          if (shown <= 0) return <div key={i} style={{ height: 40 }} />;
          const done = shown >= l.text.length;
          const colon = l.cont ? 0 : l.text.indexOf(": ");
          const hot = l.hot && done && colon >= 0;
          const head = hot ? l.text.slice(0, colon + (l.cont ? 0 : 2)) : l.text.slice(0, shown);
          const tail = hot ? l.text.slice(colon + (l.cont ? 0 : 2)) : "";
          return (
            <div key={i} style={{ fontFamily: MONO, fontSize: 24, lineHeight: "40px", whiteSpace: "pre", color: i === 0 ? COLORS.ink2 : COLORS.ink }}>
              {head}
              {hot && <span style={{ color: COLORS.accent, fontWeight: 500 }}>{tail}</span>}
            </div>
          );
        })}
      </div>
      <Mark />
      <Strip titles={scene.titles} step={scene.step} />
    </AbsoluteFill>
  );
};
