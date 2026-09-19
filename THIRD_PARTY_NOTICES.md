# Third-party notices

## eDEX-UI

This project is inspired by eDEX-UI:

- Project: <https://github.com/GitSquared/edex-ui>
- Copyright: Gabriel “Squared” Saillard and contributors
- License: GNU General Public License version 3

Copied upstream materials, their exact source paths, retained notices, and integrity hashes are listed
in `apps/clone/UPSTREAM_ASSETS.md`, `apps/clone/upstream-asset-hashes.json`, and `NOTICE.md`.

Future third-party imports must list exact versions, source paths, destination paths, licenses, and
local modifications here or in a linked machine-readable inventory.

## markdown-it

- Project: <https://github.com/markdown-it/markdown-it>
- Version: 15.0.2
- License: MIT
- Use: safe CommonMark parsing and renderer hooks in `apps/clone/src/content/markdown-renderer.ts` and build-time content reference validation.
- Local modifications: none; raw HTML is disabled and local links are resolved through the typed content manifest.

## yaml

- Project: <https://github.com/eemeli/yaml>
- Version: 2.9.1
- License: ISC
- Use: build-time frontmatter parsing in `apps/clone/src/content/content-registry.ts` through `apps/clone/vite.config.ts`.
- Local modifications: none; parsed values are validated by the local strict Zod schema before entering the manifest.
