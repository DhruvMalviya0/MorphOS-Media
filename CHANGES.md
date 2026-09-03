# Changelog

## 2026-09-03 — Hardware-Aware Auto-Routing

**What changed:** Gatekeeper now reads live VRAM/CPU/RAM headroom and computes a real routing decision (resolution, precision, batch size) with human-readable reasoning before a job runs, surfaced in the UI on the Photo Engine screen.

**Placeholder inputs used:** Default job spec op type ("photo-gen") when none is specified by the caller. All detection and decision logic is real.

**How to try it:** Photo Engine → start a generation → routing panel shows a decision reflecting the current machine's actual headroom.

## 2026-09-03 — Cross-Engine Pipeline Chaining (Manga to Photo)

**What changed:** Defined a unified `MediaAsset` standard. Built an endpoint `POST /api/manga/panels/send-to-photo` that turns an extracted manga panel into a MediaAsset and computes a smart edge mask. The Manga Studio UI now features a "Send to Photo Engine" button that bridges state, instantly loading the panel and mask into the Photo Engine for inpainting.

**Placeholder inputs used:** Only the smart mask generation logic (currently Canny edge-based mask) is acting as a rapid placeholder for SAM object detection, but it is a real CV output.

**How to try it:** Upload an image in Manga Motion Engine -> Initialize Panels -> Select a panel -> Click "Send to Photo Engine". You will instantly land in Photo Engine with the mask pre-loaded.

## 2026-09-03 — Generation Recipes

**What changed:** Implemented a new `Recipe` standard that tracks the state of generation parameters per engine (photo vs audio). Built `POST /api/recipes` and `GET /api/recipes` to persist recipes into a local `recipes.json` file. The StudioWorkspace UI now includes "Save Recipe" buttons that serialize your prompt, sampling passes, etc., and a "Load Recipe" dropdown that instantly hot-swaps all configuration state to match the saved recipe.

**Placeholder inputs used:** None. The JSON file tracks all actual values set in the React UI state.

**How to try it:** In Photo Engine or Audio Engine, adjust some settings (prompt, steps, etc.). Click "Save Recipe", give it a name, and hit Save. The recipe will immediately appear under "Load Recipe". Click it to instantly apply those settings back to the canvas.

## 2026-09-03 — Layer-Based Photo Editor

**What changed:** Photo Engine screen now has a full layer stack (add, reorder, blend mode, opacity, lock, visibility) and a real tool palette with undo/redo, client-side canvas compositing, and a two-way bridge to AI generation (send composite/selection as input, receive results as a new layer). Projects save/load with the full layer stack intact.

**Tools shipped:** Move, Marquee Selection, Brush, Eraser, Shape (Rectangle/Ellipse), Text, Eyedropper.
**Tools deliberately deferred:** None. All requested tools shipped.
**How to try it:** Open Photo Engine → layers panel is in the sidebar → draw, move, and edit layers. Send to AI and see it append a new layer with the result!
