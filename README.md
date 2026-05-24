# Presence Detector

An uncanny, camera-based AI experience that makes users question what they're seeing.

> *"Maybe it's a bug… or maybe not…"*

---

## What it does

A minimal surveillance-style app that uses your webcam and real face detection, then subtly introduces **ghost detections** — bounding boxes that appear in empty areas of the frame. The experience is designed to feel like a real (but slightly broken) AI system.

- ✅ Real face detection via MediaPipe
- 👻 Fake presence engine with randomized timing
- 📺 Cinematic dark UI (IBM Plex Mono + Syne fonts)
- 🔴 Subtle scanline overlay and status HUD
- ⚡ Smooth Framer Motion animations

---

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Then open `http://localhost:5173` and click **Start Detection**.

Grant camera permission when prompted.

---

## Build for Production

```bash
npm run build
npm run preview
```

---

## How the Fake Presence Engine works

The `FakePresenceEngine` class controls all ghost detections:

| Parameter | Value |
|-----------|-------|
| First appearance delay | 6–12 seconds |
| Visible duration | 1.2–3.5 seconds |
| Cycle gap | 8–22 seconds |
| Escalation (second ghost) | After 45s, ~12% chance per cycle |
| Confidence range | 70%–97%, fluctuating |
| Jitter | ±0.5% with slow drift |

Ghost boxes appear in 5 psychological zones:
- Behind/beside the user (left edge)
- Far right edge
- Lower corner
- Shoulder area
- Background center-high (feels like someone standing behind you)

---

## Project Structure

```
src/
├── components/
│   ├── CameraFeed.jsx          — Live video + MediaPipe integration
│   ├── DetectionOverlay.jsx    — Bounding box rendering
│   └── FakePresenceEngine.js   — Ghost detection logic
├── hooks/
│   └── useCamera.js            — getUserMedia management
├── utils/
│   └── detectionHelpers.js     — Geometry & randomness utilities
├── App.jsx                     — App shell & state machine
├── main.jsx                    — React entry point
└── index.css                   — Design tokens, scanlines, animations
```

---

## Notes

- MediaPipe loads from CDN on first use (may take a moment)
- If MediaPipe fails to load, a fallback simulation runs instead
- The experience is designed to work best in a **dim room**
- Best viewed fullscreen in a browser that supports getUserMedia

---

*Built as a psychological experiment in perceptual uncertainty.*
