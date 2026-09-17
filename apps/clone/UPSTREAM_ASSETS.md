# Upstream eDEX-UI assets

The browser replica directly reuses selected assets from GitSquared/eDEX-UI tag `v2.2.8`, commit `7a9205bf934914407394442f57475d4fefd3213b`.

| Local path | Upstream source |
|---|---|
| `public/audio/*.wav` | `src/assets/audio/*.wav` |
| `public/fonts/*.woff2` | `src/assets/fonts/*.woff2` |
| `public/boot_log.txt` | `src/assets/misc/boot_log.txt` |
| `public/icons/edex-file-icons.json` | selected entries from `src/assets/icons/file-icons.json` |
| `public/keyboard/en-US.json` | `src/assets/kb_layouts/en-US.json` |
| `public/encom-globe.js` | `src/assets/vendor/encom-globe.js` |
| `public/grid.json` | `src/assets/misc/grid.json` |

`UPSTREAM_LICENSE` contains the upstream project license. The icon JSON also carries embedded per-icon attribution where supplied by upstream.

`upstream-asset-hashes.json` freezes the SHA-256 digest of every copied or derived asset. Run `npm run assets:verify` from the repository root to detect accidental replacements or transformations.
