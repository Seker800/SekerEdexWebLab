# SekerEdexWebLab Development Rules

## Mission

Build a repeatable, evidence driven system that observes a target web experience, creates or repairs a local replica, and verifies equivalence with deterministic checks.

## Required reading

Before changing implementation code, read:

1. `NORTH_STAR.md`
2. `ARCHITECTURE.md`
3. `docs/VISUAL_NORTH_STAR.md`

## Engineering rules

- Keep orchestration deterministic. Codex may propose and implement changes; executable gates decide whether a scenario passes.
- Preserve target evidence and run artifacts. Never rewrite evidence to make an implementation pass.
- Add every discovered counterexample to the regression corpus.
- Fix shared causes in shared modules instead of adding page specific exceptions.
- Keep browser collection, comparison, judging, and Codex execution behind separate interfaces.
- Use typed structured data at every process boundary.
- Do not let two writers modify the same checkout concurrently.
- Keep credentials outside prompts, logs, screenshots, and committed files.

## Validation

Run these checks after implementation changes:

```bash
npm run check
npm test
npm run demo
npm run app:verify
npm run replicate:verify
```

`npm run demo` must produce a passing report for the bundled reference scenario. `npm run app:verify` must validate the command deck regions and interactions without browser errors. `npm run replicate:verify` must pass against the frozen eDEX-UI screenshot threshold.

## Code review rules

- Flag any path that lets the development agent alter target evidence, acceptance thresholds, or the judge during a repair attempt.
- Flag unbounded retry loops.
- Flag shell execution assembled from untrusted target content.
- Flag modules that combine browser observation, code modification, and pass/fail judgment.
