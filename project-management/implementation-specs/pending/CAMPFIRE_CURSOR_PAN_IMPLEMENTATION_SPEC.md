# Implementation Spec: Cursor-Panned Campfire Video Card

## Goal

Use the wide `campfire-summer.mp4` video inside a portrait-style Passport card. As the user moves their cursor horizontally across the card, the visible area of the video should pan left and right.

The effect should feel subtle, premium, and responsive — like the user is looking around within a living scene.

---

## Asset

```text
src/assets/video/campfire-summer.mp4
```

---

## Core Behaviour

1. The video fills the entire card.
2. The card crops the wide 16:9 video using `object-fit: cover`.
3. Horizontal cursor position controls the video's `object-position-x`.
4. Cursor at the left edge reveals more of the video's left side.
5. Cursor at the centre returns the video to its centred composition.
6. Cursor at the right edge reveals more of the video's right side.
7. Movement must be smoothed so the video does not snap or jitter.
8. When the cursor leaves the card, the view gently returns to centre.
9. The video loops continuously, remains muted, and plays inline.
10. The card must still work when autoplay is unavailable.

---

## Interaction Model

Normalize the cursor's horizontal position inside the card:

```text
left edge   = -1
centre      =  0
right edge  =  1
```

Map that value to a restrained `object-position-x` range:

```text
minimum = 35%
centre  = 50%
maximum = 65%
```

Do not expose the full width of the source video. A narrow range will preserve the composition and prevent empty or undesirable edges from appearing.

Initial recommended range:

```ts
const MIN_POSITION = 35;
const MAX_POSITION = 65;
```

These values should be easy to tune after viewing the card in the browser.

---

## Smoothing

Do not directly assign the raw cursor position to the video.

Use one of these approaches:

### Preferred

Use `requestAnimationFrame` with interpolation:

```ts
current += (target - current) * 0.08;
```

This produces smooth, slightly delayed motion.

### Acceptable Alternative

Update a CSS custom property and use a short transition:

```css
transition: object-position 180ms ease-out;
```

The `requestAnimationFrame` approach is preferred because it feels more physical and avoids restarting a CSS transition on every mouse event.

---

## Component Structure

Suggested component:

```text
src/components/passport/PassportVideoCard.tsx
```

Suggested props:

```ts
type PassportVideoCardProps = {
  title: string;
  videoSrc: string;
  posterSrc?: string;
  className?: string;
};
```

Usage:

```tsx
import campfireVideo from "../../assets/video/campfire-summer.mp4";

<PassportVideoCard title="Campfire" videoSrc={campfireVideo} />;
```

---

## Suggested React Implementation

```tsx
import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";

type PassportVideoCardProps = {
  title: string;
  videoSrc: string;
  posterSrc?: string;
  className?: string;
};

const CENTRE_POSITION = 50;
const MIN_POSITION = 35;
const MAX_POSITION = 65;
const EASING = 0.08;

export default function PassportVideoCard({
  title,
  videoSrc,
  posterSrc,
  className = "",
}: PassportVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentPositionRef = useRef(CENTRE_POSITION);
  const targetPositionRef = useRef(CENTRE_POSITION);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = () => {
      const current = currentPositionRef.current;
      const target = targetPositionRef.current;
      const next = current + (target - current) * EASING;

      currentPositionRef.current = next;

      if (videoRef.current) {
        videoRef.current.style.objectPosition = `${next}% center`;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width;
    const clampedX = Math.min(1, Math.max(0, relativeX));

    targetPositionRef.current =
      MIN_POSITION + clampedX * (MAX_POSITION - MIN_POSITION);
  };

  const handleMouseLeave = () => {
    targetPositionRef.current = CENTRE_POSITION;
  };

  return (
    <article
      className={`passport-video-card ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-label={title}
    >
      <video
        ref={videoRef}
        className="passport-video-card__video"
        src={videoSrc}
        poster={posterSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />

      <div className="passport-video-card__overlay" />

      <div className="passport-video-card__content">
        <h3>{title}</h3>
      </div>
    </article>
  );
}
```

---

## Suggested CSS

```css
.passport-video-card {
  position: relative;
  overflow: hidden;
  aspect-ratio: 4 / 5;
  border-radius: 24px;
  background: #111;
  isolation: isolate;
}

.passport-video-card__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% center;
  pointer-events: none;
  user-select: none;
  z-index: -2;
}

.passport-video-card__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.72) 0%,
    rgba(0, 0, 0, 0.12) 55%,
    rgba(0, 0, 0, 0.08) 100%
  );
  pointer-events: none;
  z-index: -1;
}

.passport-video-card__content {
  position: absolute;
  inset: auto 0 0;
  padding: 24px;
  color: white;
}

@media (prefers-reduced-motion: reduce) {
  .passport-video-card__video {
    object-position: 50% center !important;
  }
}
```

---

## Touch and Mobile Behaviour

There is no hover cursor on touch devices.

For the first version:

- Keep the video centred at `50%`.
- Do not add touch dragging yet.
- Preserve normal page scrolling.
- Do not intercept swipe gestures.

A later enhancement could use device orientation or a deliberate horizontal drag interaction, but that is outside this first implementation.

---

## Accessibility

- Respect `prefers-reduced-motion`.
- Keep the scene centred when reduced motion is enabled.
- The video is decorative and should not contain critical information.
- Important text must remain regular HTML over the video.
- The card must remain understandable if the video fails to load.
- Do not add audio.
- Avoid rapid or exaggerated panning.

If the video is purely decorative, consider adding:

```tsx
aria-hidden="true"
```

to the `<video>` element while keeping the card's visible title available to assistive technology.

---

## Performance Requirements

- Use the existing 720p, 4-second MP4 for the prototype.
- Set `preload="metadata"` rather than downloading every card video immediately.
- Only autoplay cards that are visible or near the viewport once Passport contains many cards.
- A future version should use `IntersectionObserver` to play visible cards and pause off-screen cards.
- Avoid React state updates during mouse movement; use refs and direct style updates.
- Cancel every animation frame when the component unmounts.

---

## Acceptance Criteria

- [ ] The Campfire card displays the video in a 4:5 card.
- [ ] The video completely fills the card without distortion.
- [ ] Moving the cursor left pans the visible scene left.
- [ ] Moving the cursor right pans the visible scene right.
- [ ] The movement is smooth and does not jitter.
- [ ] The maximum pan is restrained and never exposes blank space.
- [ ] Leaving the card smoothly returns the view to centre.
- [ ] The video loops, remains muted, and plays inline.
- [ ] Mobile users see a stable centred scene.
- [ ] Reduced-motion users do not receive cursor-driven panning.
- [ ] The implementation does not trigger React rerenders on every mouse movement.
- [ ] The card remains readable if the video cannot autoplay.

---

## First Test

Apply this behaviour to **only the Campfire card**.

Do not generalize the entire Passport card system until the interaction has been tested and tuned in the browser.

Tune these three values first:

```ts
const MIN_POSITION = 35;
const MAX_POSITION = 65;
const EASING = 0.08;
```

The likely tuning questions are:

- Does the pan travel too far?
- Does the motion feel too quick?
- Does the centred position frame the fire correctly?
- Does the crop still look good at the card's final dimensions?

---

## Future Enhancements — Not Part of This Build

- Vertical cursor panning.
- Proximity-based glow around the fire.
- Slight scale increase on hover.
- Cursor-driven parallax for text and overlays.
- IntersectionObserver-based playback management.
- Poster image generation.
- Touch dragging.
- Device tilt.
- Dynamic pan ranges per card.
- Atlas-controlled card emphasis in Discovery Mode.
