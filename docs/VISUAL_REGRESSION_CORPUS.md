# Visual regression corpus

This file records source-plausible changes that deterministic capture disproved. Read it before proposing another visual repair. The frozen target, comparison settings and accepted application baseline remain unchanged; scores are formal pixelmatch results unless a region is named explicitly.

## Accepted baseline changes

| Change | Before | After | Decision |
|---|---:|---:|---|
| Expand the terminal frame 3 px to the right and 1 px downward, then compensate terminal child content by 1 px upward | 97,826 pixels / 4.624% | 95,053 pixels / 4.493% | Accepted |
| Remove the file grid's 1 px browser compatibility offset on the x axis | filesystem 13,462 | filesystem 13,421 | Accepted in two independent captures |
| Apply one shared process-list transform: `translate(-.25px, 5px) scaleX(.999)` | system 9,199 | system 9,159 | Accepted in two independent captures |
| Restore separate source ruler/tick baselines, Electron-era terminal framing, and remove invented outer dividers | whole image 94,965 / 4.488% | 87,328 / 4.127% | Accepted by transactional recapture |
| Preserve the terminal's second top-frame raster row and restore source keyboard content-box sizing | whole image 87,334 / 4.128% | 87,028 / 4.113% | Accepted by transactional recapture |
| Restore the canonical neofetch logo indentation and calibrate the two terminal timestamps as one shared block | whole image 87,023 / 4.113% | 86,224 / 4.075% | Accepted by source comparison, local grid search and full-image recapture |
| Preserve the screenshot-era Electron window alpha ramp in application rendering and browser collection | whole image 86,213 / 4.075% | 51,880 / 2.452% | Accepted after channel analysis found 42,196 reference pixels whose RGB already matched but whose alpha had been flattened by collection |
| Fine tune the shared terminal child transform to `translateX(-1.9px) scaleX(.9963)` | terminal 18,875; whole image 51,892 | terminal 18,031; whole image 51,050 | Accepted by coarse search, fine search and full-image recapture |

## Rejected changes

| Change | Baseline | Candidate | Reason |
|---|---:|---:|---|
| Register United Sans Medium as CSS weight 400 for ordinary UI text | 97,826 / 4.624% | 99,657 / 4.710% | Chromium raster moved farther from the Electron 4 screenshot |
| Add source-literal `0.18vh` terminal border width and `0.278vh` corner radius after the accepted terminal frame correction | 95,043 / 4.492% | 100,311 / 4.741% | Current browser compatibility layer already matches the captured frame more closely |
| Replace the browser terminal renderer with screenshot-era `xterm@3.12.2` Canvas | terminal 22,289; neofetch 12,069; logo 5,572 | terminal 40,280; neofetch 30,057; logo 10,027 | Exact legacy renderer produced substantially worse Chromium raster output |
| Set keyboard width to the source-literal `56vw` | whole image 97,847 | 105,578 | Browser grid geometry diverged from the Electron capture |
| Set active terminal tab scale to source-literal `1.2` | terminal 22,289 | 22,407 | Region score regressed |
| Remove terminal compatibility scaling | terminal 22,289 | 25,416 | Region score regressed |
| Remove keyboard compatibility scaling | keyboard 16,129 | 20,081 | Region score regressed |
| Move the ENCOM globe canvas horizontally from its current centered position | globe crop 5,639 | best shifted candidate 5,831 | Horizontal translation regressed |
| Change the frozen ENCOM camera angle away from `6.260` by 0.005-radian steps | globe crop 5,655 | nearest candidates 5,678 and 5,769 | Current angle is the measured local optimum |

## Use

- Do not repeat a rejected change without new evidence that changes the capture conditions or identifies a different shared cause.
- Keep accepted changes only after clean browser diagnostics, matching dimensions and a strictly lower deterministic difference.
- Add every new rejected candidate with its measured baseline and candidate result.
