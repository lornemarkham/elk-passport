import type { StaticImageData } from "next/image";
import type { WayId } from "@/domain/christmas/ways";

/**
 * **Inspirational photographs for the six ways** (owner brief M1128). Each is
 * openly licensed from Wikimedia Commons and credited as its licence asks;
 * none depicts a place Passport recommends. A way missing here keeps its
 * designed artwork — never a borrowed picture of something else.
 */
export interface WayPhoto {
  readonly image: StaticImageData;
  readonly alt: string;
  /** `object-position`, where the subject sits. */
  readonly focus: string;
  readonly title: string;
  readonly page: string;
  readonly author: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly cropped?: boolean;
}

export const WAY_PHOTOS: Readonly<Partial<Record<WayId, WayPhoto>>> = {};
