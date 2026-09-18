# Upstream eDEX-UI assets

The browser replica directly reuses selected assets from [GitSquared/eDEX-UI](https://github.com/GitSquared/edex-ui) tag `v2.2.8`, commit [`7a9205bf934914407394442f57475d4fefd3213b`](https://github.com/GitSquared/edex-ui/commit/7a9205bf934914407394442f57475d4fefd3213b). The rendered interface itself follows the earlier screenshot-era commit [`66ba190ee5369523195c4012d0a798fbe4d43391`](https://github.com/GitSquared/edex-ui/commit/66ba190ee5369523195c4012d0a798fbe4d43391), as recorded in `references/edex-ui-v2.2.8/provenance.json`.

| Local path | Upstream source |
|---|---|
| `public/audio/*.wav` | `src/assets/audio/*.wav` |
| `public/fonts/*.woff2` | `src/assets/fonts/*.woff2` |
| `public/boot_log.txt` | `src/assets/misc/boot_log.txt` |
| `public/icons/edex-file-icons.json` | selected entries from `src/assets/icons/file-icons.json` |
| `public/keyboard/en-US.json` | `src/assets/kb_layouts/en-US.json` |
| `public/encom-globe.js` | `src/assets/vendor/encom-globe.js` |
| `public/grid.json` | `src/assets/misc/grid.json` |

`UPSTREAM_LICENSE` contains the complete upstream GPLv3 license. `licenses/FIRA-OFL-1.1.txt` preserves the Fira font license, and `licenses/ENCOM-GLOBE-MIT.txt` preserves the ENCOM Globe license. The globe bundle retains embedded notices for its bundled dependencies. The icon JSON carries embedded per-icon attribution where supplied by upstream.

The United Sans files are unmodified copies from the pinned eDEX-UI distribution. United Sans is third-party font software: this project claims no ownership and grants no rights beyond those supplied with that upstream distribution. See the repository-level `NOTICE.md` before redistributing the asset bundle.

`upstream-asset-hashes.json` freezes the SHA-256 digest of every copied or derived asset. Run `npm run assets:verify` from the repository root to detect accidental replacements or transformations.
