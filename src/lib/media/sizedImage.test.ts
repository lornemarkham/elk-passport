import { describe, expect, it } from "vitest";
import { CARD_WIDTHS, THUMB_WIDTHS, sizedImage } from "./sizedImage";

const WM =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Jack_O_Lantern.jpg/1280px-Jack_O_Lantern.jpg";

describe("sizedImage", () => {
  it("asks Wikimedia for the widths a card is drawn at", () => {
    const image = sizedImage(WM);
    expect(image.srcSet).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Jack_O_Lantern.jpg/500px-Jack_O_Lantern.jpg 500w, https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Jack_O_Lantern.jpg/960px-Jack_O_Lantern.jpg 960w",
    );
    expect(image.src).toContain("/960px-");
  });

  it("never asks a thumbnail to grow, and drops the widths it cannot honour", () => {
    const narrow = WM.replace(/1280px/g, "960px");
    const image = sizedImage(narrow);
    expect(image.srcSet).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Jack_O_Lantern.jpg/500px-Jack_O_Lantern.jpg 500w",
    );
    expect(image.srcSet).not.toContain("960w");
  });

  it("leaves a Wikimedia original (not a /thumb/) alone", () => {
    const original =
      "https://upload.wikimedia.org/wikipedia/commons/9/90/Jack_O_Lantern.jpg";
    expect(sizedImage(original)).toEqual({ src: original });
  });

  it("caps the width of a Cloudinary transformation and scales its height with it", () => {
    const url =
      "https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,h_801,q_75,w_1200/v1/clients/kelowna/a.jpg";
    const image = sizedImage(url, [500, 960]);
    expect(image.srcSet).toContain(
      "/upload/c_fill,h_334,q_75,w_500/v1/clients/kelowna/a.jpg 500w",
    );
    expect(image.srcSet).toContain(
      "/upload/c_fill,h_641,q_75,w_960/v1/clients/kelowna/a.jpg 960w",
    );
  });

  it("adds a width limit where Cloudinary has no transformation", () => {
    const url =
      "http://res.cloudinary.com/simpleview/image/upload/v1494261016/clients/kelowna/a.jpg";
    expect(sizedImage(url).src).toBe(
      "http://res.cloudinary.com/simpleview/image/upload/c_limit,w_960/v1494261016/clients/kelowna/a.jpg",
    );
  });

  it("leaves a Cloudinary transformation that is already small", () => {
    const url =
      "https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,f_jpg,h_784,q_65,w_639/v1/clients/kelowna/a.jpg";
    const image = sizedImage(url);
    expect(image.srcSet).toBe(
      "https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,f_jpg,h_613,q_65,w_500/v1/clients/kelowna/a.jpg 500w",
    );
  });

  it("reads Cloudinary's fetch form, which wraps another address after the transformation", () => {
    const url =
      "https://assets.simpleviewinc.com/simpleview/image/fetch/c_fill,h_800,q_75,w_1200/https://assets.simpleviewinc.com/simpleview/image/upload/v1/clients/kelowna/a.jpg";
    expect(sizedImage(url).srcSet).toContain(
      "/image/fetch/c_fill,h_333,q_75,w_500/https://assets.simpleviewinc.com/simpleview/image/upload/v1/clients/kelowna/a.jpg 500w",
    );
  });

  it("asks Squarespace for a fixed width", () => {
    const url =
      "https://images.squarespace-cdn.com/content/v1/a/b/pumpkins.png";
    expect(sizedImage(url).srcSet).toBe(
      `${url}?format=500w 500w, ${url}?format=960w 960w`,
    );
    expect(
      sizedImage(`${url}?format=500w`, CARD_WIDTHS).srcSet,
    ).toBeUndefined();
  });

  it("scales both of Widen's dimensions", () => {
    const url =
      "https://hfe.widen.net/content/abc/web/x.jpg?w=1080&h=1080&keep=c&quality=100";
    const image = sizedImage(url, THUMB_WIDTHS);
    expect(image.srcSet).toContain("w=250&h=250");
    expect(image.srcSet).toContain("w=500&h=500");
  });

  it("scales a Wix fill rendition and leaves an already small one", () => {
    const big =
      "https://static.wixstatic.com/media/a~mv2.jpg/v1/fill/w_2500,h_1662,al_c/a.jpg";
    expect(sizedImage(big).srcSet).toContain(
      "/fill/w_500,h_332,al_c/a.jpg 500w",
    );
    const small =
      "https://static.wixstatic.com/media/a~mv2.jpg/v1/crop/x_0,y_0,w_3456,h_3456/fill/w_406,h_406,al_c,q_80/a.jpg";
    expect(sizedImage(small)).toEqual({ src: small });
  });

  it("returns an address it does not know exactly as it came", () => {
    const url =
      "https://www.tourismvernon.com/sites/default/files/a.jpg?itok=Zx";
    expect(sizedImage(url)).toEqual({ src: url });
    expect(sizedImage("not a url")).toEqual({ src: "not a url" });
  });
});
