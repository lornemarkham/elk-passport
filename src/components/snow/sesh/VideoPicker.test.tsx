// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VideoPicker, formatSize } from "./VideoPicker";

const clip = new File([new Uint8Array(2 * 1048576)], "jump.mov", {
  type: "video/quicktime",
});

describe("VideoPicker", () => {
  it("formats sizes", () => {
    expect(formatSize(200)).toBe("1 KB");
    expect(formatSize(2 * 1048576)).toBe("2.0 MB");
  });

  it("offers camera capture and library as separate inputs", () => {
    render(
      <VideoPicker
        file={null}
        preview={null}
        mode="demo"
        onPick={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByTestId("video-record-input")).toHaveAttribute(
      "capture",
      "environment",
    );
    expect(screen.getByTestId("video-record-input")).toHaveAttribute(
      "accept",
      "video/*",
    );
    expect(screen.getByTestId("video-upload-input")).not.toHaveAttribute(
      "capture",
    );
    expect(screen.getByRole("button", { name: /record video/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /upload video/i })).toBeTruthy();
  });

  it("returns a recorded clip to the form", () => {
    const onPick = vi.fn();
    render(
      <VideoPicker
        file={null}
        preview={null}
        mode="demo"
        onPick={onPick}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("video-record-input"), {
      target: { files: [clip] },
    });
    expect(onPick).toHaveBeenCalledWith(clip);
  });

  it("says demo clips stay on the phone, and real ones are shared", () => {
    const { rerender } = render(
      <VideoPicker
        file={null}
        preview={null}
        mode="demo"
        onPick={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByTestId("video-destination").textContent).toMatch(
      /not uploaded/,
    );
    rerender(
      <VideoPicker
        file={null}
        preview={null}
        mode="real"
        onPick={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByTestId("video-destination").textContent).toMatch(
      /uploaded and shared/,
    );
  });

  it("previews with name, size, Replace and Remove", () => {
    const onRemove = vi.fn();
    render(
      <VideoPicker
        file={clip}
        preview="blob:x"
        mode="demo"
        onPick={vi.fn()}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByTestId("video-name").textContent).toBe("jump.mov");
    expect(screen.getByTestId("video-size").textContent).toBe("2.0 MB");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalled();
    const click = vi.spyOn(
      screen.getByTestId("video-upload-input") as HTMLInputElement,
      "click",
    );
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(click).toHaveBeenCalled();
  });
});
