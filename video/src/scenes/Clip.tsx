import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import { BAND, COLORS, H, HEAD, Segment, W } from "../constants";
import { Mark } from "../components/Mark";
import { Strip } from "../components/Strip";
import { Title } from "../constants";

/** A recorded scene: the live page full-bleed, the title strip covering its bottom edge, the mark
 *  pinned top-left. Segments play back to back as straight cuts. */
export const Segments: React.FC<{ file: string; segments: Segment[]; width: number; height: number }> = ({ file, segments, width, height }) => {
  const { fps } = useVideoConfig();
  let offset = 0;
  return (
    <>
      {segments.map((s, i) => {
        const from = offset;
        const frames = Math.round((s.to - s.from) * fps);
        offset += frames;
        return (
          <Sequence key={i} from={from} durationInFrames={frames}>
            <OffthreadVideo
              src={staticFile(file)}
              muted
              startFrom={Math.round(s.from * fps)}
              endAt={Math.round(s.to * fps)}
              style={{ width, height, objectFit: "cover", objectPosition: "top", display: "block" }}
            />
          </Sequence>
        );
      })}
    </>
  );
};

export const Clip: React.FC<{ file: string; segments: Segment[]; titles: Title[]; step: string; cropTop?: number }> = ({ file, segments, titles, step, cropTop = 0 }) => (
  <AbsoluteFill style={{ background: COLORS.paper }}>
    <div style={{ position: "absolute", left: 0, top: HEAD, width: W, height: H - BAND - HEAD, overflow: "hidden" }}>
      {/* Sequence lays its children out absolutely, so the offset has to be a positioned box. */}
      <div style={{ position: "absolute", left: 0, top: -cropTop, width: W, height: H }}>
        <Segments file={file} segments={segments} width={W} height={H} />
      </div>
    </div>
    <Mark />
    <Strip titles={titles} step={step} />
  </AbsoluteFill>
);
