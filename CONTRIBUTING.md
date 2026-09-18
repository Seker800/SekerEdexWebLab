# Contributing

Thank you for helping improve SekerEdexWebLab.

## Before making a change

1. Read `NORTH_STAR.md`, `ARCHITECTURE.md`, and `docs/VISUAL_NORTH_STAR.md`.
2. Keep the upstream source, frozen screenshot, acceptance thresholds, and generated run evidence unchanged.
3. Fix shared causes in shared modules. Avoid page-specific exceptions and unbounded retry behavior.
4. Preserve the upstream attribution in `README.md`, `NOTICE.md`, the browser startup gate, and `apps/clone/UPSTREAM_ASSETS.md`.
5. Do not commit private photos, credentials, browser data, unauthorized works, or material of unclear origin.
6. Keep `.reference-assets/` local-only; never force-add its fonts or copy them into public assets.

## Development

```bash
npm install
npm run install:browsers
npm run upstream:sync
npm run app:dev
```

The implementation lives in `apps/clone`. The observation, comparison, judging, and repair boundaries live under `src` and must remain separate. Maintain one-way boundaries between input, state, rendering, sound, and content. Never present simulated telemetry as real device data.

## Validation

Run the complete project gates before opening a pull request:

```bash
npm run check
npm test
npm run demo
npm run app:verify
npm run replicate:verify
```

Changes to copied assets must also pass `npm run assets:verify`. Do not update hashes merely to make an unexplained asset change pass; document the source and reason first.

## Commits and pull requests

Use the Chinese commit types `新增`, `修复`, `重构`, `清理`, `测试`, or `文档`, and sign commits for the Developer Certificate of Origin:

```bash
git commit -s
```

Describe the user-visible change, source evidence, commands run, visual evidence, performance/accessibility/mobile impact, third-party licensing changes, known limitations, and rollback strategy. By contributing, you agree that your contribution is distributed under GPLv3 with the rest of the project.
