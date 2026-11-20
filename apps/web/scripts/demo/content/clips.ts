import type { ClipDef } from "./types";

/**
 * Placeholder video clips. The real story videos do not exist yet, so every module plays one of these. To swap in a
 * real video, change that clip's entry (url, mimeType, duration, sizeBytes) and re-run `pnpm --filter web seed:demo --yes`;
 * question timestamps are stored as fractions of the duration, so they follow automatically.
 *
 * Both clips are the open movie "Big Buck Bunny" (cartoon, child-appropriate). Credit it wherever the demo is shown:
 *   "Big Buck Bunny" (c) copyright 2008, Blender Foundation | www.bigbuckbunny.org, licensed CC BY 3.0
 *   https://creativecommons.org/licenses/by/3.0/
 * Duration of the film: 9 min 56 s = 596 s.
 */
const BBB_ATTRIBUTION = "Big Buck Bunny (c) 2008 Blender Foundation | www.bigbuckbunny.org";
const BBB_LICENCE = "CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)";

export const CLIPS: Record<string, ClipDef> = {
  "bbb-mp4": {
    id: "bbb-mp4",
    title: "Big Buck Bunny (mp4, archive.org)",
    url: "https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4",
    mimeType: "video/mp4",
    duration: 596,
    sizeBytes: 61_878_609,
    licence: BBB_LICENCE,
    attribution: BBB_ATTRIBUTION,
  },
  "bbb-webm": {
    id: "bbb-webm",
    title: "Big Buck Bunny (webm 480p, Wikimedia Commons)",
    url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.480p.vp9.webm",
    mimeType: "video/webm",
    duration: 596,
    sizeBytes: 96_645_673,
    licence: BBB_LICENCE,
    attribution: BBB_ATTRIBUTION,
  },
};
