// The product's own three faces, loaded before any frame renders. Never the CDN link.
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadSpline } from "@remotion/google-fonts/SplineSans";
import { loadFont as loadSplineMono } from "@remotion/google-fonts/SplineSansMono";

export const { fontFamily: DISPLAY } = loadFraunces("normal", { weights: ["400", "500"], subsets: ["latin"] });
loadFraunces("italic", { weights: ["400"], subsets: ["latin"] });
export const { fontFamily: SANS } = loadSpline("normal", { weights: ["400", "500"], subsets: ["latin"] });
export const { fontFamily: MONO } = loadSplineMono("normal", { weights: ["400", "500"], subsets: ["latin"] });
