# Notes for agents

Read these before changing anything:

- [docs/ROADMAP.md](docs/ROADMAP.md): Chrome Web Store checklist, the robustness plan for the
  no-AI features, and the feature briefs (what to build next).
- [docs/REFERENCE.md](docs/REFERENCE.md): voice and copy, the rename plan, and the security and
  permissions review.

Standing rules:

- US English only, in code, copy and docs ("tire", "color").
- Keep the flat "Graphite" Tread Dot look: design tokens live in `lib/theme.js`. No gloss, no 3D.
- The extension must work in Vivaldi as well as Chrome.
- No background polling for alerts. Alerts come only from open tabs and the user-pressed
  "Check my saved searches" button.
- Add new plans as sections in `docs/ROADMAP.md` or `docs/REFERENCE.md`, not as new files.
- Never submit to the Chrome Web Store without dabloonery's OK.
- One PR per change, with `deno task test` green.
