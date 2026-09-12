import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, H, Scene, W } from "../constants";
import { MONO } from "../fonts";
import { Mark } from "../components/Mark";
import { Strip } from "../components/Strip";
import { Segments } from "./Clip";
import { useEnter } from "../components/motion";

/** An outside page (HashScan) shown inset on paper with a hairline frame, so it reads as evidence
 *  rather than as our own screen. */
export const Proof: React.FC<{ scene: Extract<Scene, { kind: "proof" }> }> = ({ scene }) => {
  const w = 1440;
  const h = 810;
  const enter = useEnter(0, 12);
  const cap = useEnter(10, 6);
  const top = 96;
  return (
    <AbsoluteFill style={{ background: COLORS.paper }}>
      <div style={{ position: "absolute", left: (W - w) / 2, top, width: w, height: h, overflow: "hidden", boxShadow: `0 0 0 1px ${COLORS.ruleStrong}`, background: "#ffffff", ...enter }}>
        <div style={{ transform: `scale(${w / W})`, transformOrigin: "top left", width: W, height: H }}>
          <Segments file={scene.file} segments={scene.segments} width={W} height={H} />
        </div>
      </div>
      <div style={{ position: "absolute", left: (W - w) / 2, top: top + h + 14, fontFamily: MONO, fontSize: 15, letterSpacing: "0.04em", color: COLORS.ink3, ...cap }}>{scene.caption}</div>
      <Mark />
      <Strip titles={scene.titles} step={scene.step} />
    </AbsoluteFill>
  );
};
