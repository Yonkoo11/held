import React from "react";
import { COLORS, HEAD, NAV_STRIP, PRODUCT } from "../constants";
import { MONO, SANS } from "../fonts";

/** The header band on every recorded scene: paper, the mark pinned at the same place on the left,
 *  the page's own network strip on the right, a hairline underneath. The recording sits below it,
 *  so the mark never covers scrolled content. */
export const Mark: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: HEAD, background: COLORS.paper, borderBottom: `1px solid ${COLORS.rule}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 56px" }}>
    <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 22, letterSpacing: "-0.015em", color: COLORS.ink }}>{PRODUCT}</span>
    <span style={{ fontFamily: MONO, fontSize: 15, color: COLORS.ink3 }}>{NAV_STRIP}</span>
  </div>
);
