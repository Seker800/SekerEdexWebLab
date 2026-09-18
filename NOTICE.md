# Source and third-party notices

SekerEdexWebLab is an unofficial browser adaptation of **eDEX-UI**. It is not affiliated with or endorsed by GitSquared or the other upstream contributors.

## eDEX-UI

- Original project: [GitSquared/eDEX-UI](https://github.com/GitSquared/edex-ui)
- Primary author: [Squared / GitSquared](https://github.com/GitSquared)
- License: GNU General Public License version 3
- Canonical source used by this port: commit [`66ba190ee5369523195c4012d0a798fbe4d43391`](https://github.com/GitSquared/edex-ui/commit/66ba190ee5369523195c4012d0a798fbe4d43391), immediately after eDEX-UI v2.2.0
- Secondary implementation reference: tag [`v2.2.8`](https://github.com/GitSquared/edex-ui/releases/tag/v2.2.8), commit `7a9205bf934914407394442f57475d4fefd3213b`

This port retains the original product name inside the reproduced interface to identify the work being adapted. It changes the runtime from Electron and host APIs to browser adapters, freezes screenshot-era data, and adds verification and repair tooling. Original eDEX-UI copyright notices and GPL rights remain intact.

The upstream credits also recognize [PixelyIon](https://github.com/PixelyIon) for early Windows compatibility work and [Seena Burns](https://github.com/seenaburns) for DEX-UI, which inspired eDEX-UI.

## Reused assets

The complete file mapping and integrity hashes are maintained in [`apps/clone/UPSTREAM_ASSETS.md`](apps/clone/UPSTREAM_ASSETS.md) and [`apps/clone/upstream-asset-hashes.json`](apps/clone/upstream-asset-hashes.json).

| Material | Credit and source | Terms recorded by source |
|---|---|---|
| eDEX-UI interface code, keyboard layout, boot log, grid data, and packaged assets | GitSquared/eDEX-UI | GPLv3; upstream license is preserved in `apps/clone/UPSTREAM_LICENSE` |
| Sound effects | [IceWolf](https://soundcloud.com/iamicewolf), credited by eDEX-UI for the v2.1.x and later sounds | Distributed as part of the GPLv3 eDEX-UI source |
| ENCOM Globe | Rob “Arscan” Scanlon, [arscan/encom-globe](https://github.com/arscan/encom-globe) | The reused bundle preserves its embedded copyright and license notices |
| Fira Mono | Mozilla Fira project and its designers | SIL Open Font License 1.1 |
| United Sans Light and Medium | Copied unmodified from the pinned eDEX-UI source | United Sans is third-party font software. This project claims no ownership of it and does not grant rights beyond those supplied with the upstream distribution |
| Selected file icon SVG data | The icon projects named in the embedded metadata of `edex-file-icons.json` | Per-icon attribution is preserved in that file |

“TRON” and related marks belong to their respective owners. References describe the visual inspiration cited by eDEX-UI and do not imply affiliation or endorsement.

## This adaptation

Browser-port code, deterministic adapters, comparison tooling, tests, and documentation added in this repository are copyright © 2026 SekerW and contributors and are licensed under GPLv3 as part of this work.
