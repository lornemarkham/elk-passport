import type { StaticImageData } from "next/image";
import type { WayId } from "@/domain/christmas/ways";
import lights from "./lights.jpg";
import date from "./date.jpg";
import family from "./family.jpg";
import friends from "./friends.jpg";
import cozy from "./cozy.jpg";
import events from "./events.jpg";

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

export const WAY_PHOTOS: Readonly<Partial<Record<WayId, WayPhoto>>> = {
  lights: {
    image: lights,
    alt: "Snow-covered evergreen branch in front of a small-town main street glowing with Christmas lights at night",
    focus: "40% 55%",
    title: "White Christmas In Woodstock Vermont (192715377).jpeg",
    page: "https://commons.wikimedia.org/wiki/File:White_Christmas_In_Woodstock_Vermont_(192715377).jpeg",
    author: "Jesse Collins",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0",
  },
  date: {
    image: date,
    alt: "A couple seen from behind walking hand in hand under umbrellas on a snowy path beneath golden Christmas lights",
    focus: "50% 60%",
    title:
      "Couple holding hands under Christmas lights in Krupanj. January 2026.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Couple_holding_hands_under_Christmas_lights_in_Krupanj._January_2026.jpg",
    author: "Ljiljana Krupanj",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0",
  },
  family: {
    image: family,
    alt: "Two children in winter hats seen from behind, sitting together at the top of a sunny snowy hill",
    focus: "50% 60%",
    title: "Together (Unsplash).jpg",
    page: "https://commons.wikimedia.org/wiki/File:Together_(Unsplash).jpg",
    author: "Michal Janek",
    license: "CC0",
    licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
  },
  friends: {
    image: friends,
    alt: "Two friends sitting at the edge of a busy outdoor skating rink at night, Christmas-lit trees beyond",
    focus: "50% 60%",
    title: "Ice skating London Ontario 2010.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Ice_skating_London_Ontario_2010.jpg",
    author: "Loozrboy from Toronto, Canada",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    cropped: true,
  },
  cozy: {
    image: cozy,
    alt: "An open book and a mug of something warm on a low table, a fire glowing in the stove behind",
    focus: "60% 60%",
    title: "Cozy Den (Unsplash).jpg",
    page: "https://commons.wikimedia.org/wiki/File:Cozy_Den_(Unsplash).jpg",
    author: "Pavan Trikutam",
    license: "CC0",
    licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
  },
  events: {
    image: events,
    alt: "People in winter coats browsing lit wooden Christmas market stalls at night under trees wrapped in lights",
    focus: "50% 65%",
    title: "Christmas markets in Quebec City 2.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Christmas_markets_in_Quebec_City_2.jpg",
    author: "Wilfredor",
    license: "CC0",
    licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    cropped: true,
  },
};
