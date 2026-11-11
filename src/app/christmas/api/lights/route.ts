import { json, lightsFor, viewer } from "../../_server/lights";

export const dynamic = "force-dynamic";

/** Published pins, and the asker's own pending ones. Anyone may read. */
export async function GET() {
  const v = await viewer();
  const { pins, ready } = await lightsFor(v);
  return json({
    pins,
    ready,
    viewer: { signedIn: v.signedIn, reviewer: v.reviewer },
  });
}
