# Changelog

## 2026-09-03 — Hardware-Aware Auto-Routing

**What changed:** Gatekeeper now reads live VRAM/CPU/RAM headroom and computes a real routing decision (resolution, precision, batch size) with human-readable reasoning before a job runs, surfaced in the UI on the Photo Engine screen.

**Placeholder inputs used:** Default job spec op type ("photo-gen") when none is specified by the caller. All detection and decision logic is real.

**How to try it:** Photo Engine → start a generation → routing panel shows a decision reflecting the current machine's actual headroom.
