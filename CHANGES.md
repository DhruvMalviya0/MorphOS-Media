# Changelog

## 2026-09-03 — Hardware-Aware Auto-Routing

**What changed:** Gatekeeper now reads live VRAM/CPU/RAM headroom and computes a real routing decision (resolution, precision, batch size) with human-readable reasoning before a job runs, surfaced in the UI on the Photo Engine screen.

**Placeholder inputs used:** Default job spec op type ("photo-gen") when none is specified by the caller. All detection and decision logic is real.

**How to try it:** Photo Engine → start a generation → routing panel shows a decision reflecting the current machine's actual headroom.

## 2026-09-03 — Cross-Engine Pipeline Chaining (Manga to Photo)

**What changed:** Defined a unified `MediaAsset` standard. Built an endpoint `POST /api/manga/panels/send-to-photo` that turns an extracted manga panel into a MediaAsset and computes a smart edge mask. The Manga Studio UI now features a "Send to Photo Engine" button that bridges state, instantly loading the panel and mask into the Photo Engine for inpainting.

**Placeholder inputs used:** Only the smart mask generation logic (currently Canny edge-based mask) is acting as a rapid placeholder for SAM object detection, but it is a real CV output.

**How to try it:** Upload an image in Manga Motion Engine -> Initialize Panels -> Select a panel -> Click "Send to Photo Engine". You will instantly land in Photo Engine with the mask pre-loaded.
