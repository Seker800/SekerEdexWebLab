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
| Fine tune the network status horizontal scale from `1.02` to `1.0215` | network status crop 1,705; whole image 51,050 | network status crop 1,670; whole image 51,015 | Accepted in two local searches and one full-image recapture |
| Restore the source terminal cell width for the welcome status through an isolated `scaleX(1.106)` and `translateX(-.75px)` | terminal status crop 1,320; whole image 51,008 | terminal status crop 805; whole image 50,494 | Accepted after source-size analysis, local search and full-image recapture without changing flex geometry |
| Reduce the terminal top-frame overlay from two rows to one, alongside the existing inset frame | terminal tabs 3,084; whole image 50,500 | terminal tabs 1,848; whole image 49,264 | Accepted after row-by-row evidence showed the combined Chromium frame had three rows while the source capture has two |
| Fine tune the network traffic chart's shared vertical scale from `1.01` to `1.008` | chart crop 2,632; whole image 49,256 | chart crop 2,402; whole image 49,026 | Accepted by a two-dimensional local search and full-image recapture |
| Restore the Powerline prompt segment and align it independently with `translate(-4.5px, -.5px)` | prompt crop 566; whole image 49,028 | prompt crop 426; whole image 48,884 | Accepted from the captured shell structure; restores the black segment, bold directory name and wedge while preserving input geometry |
| Restore the xterm-equivalent footer cell width with an isolated right-anchored `scaleX(1.108)` | footer crop 800; whole image 48,903 | footer crop 601; whole image 48,696 | Accepted by local search, visual inspection and full-image recapture |
| Restore the neofetch palette to its source-effective 21 px height and move it one pixel upward | palette crop 550 | 0 | Accepted after the candidate produced a pixel-identical palette crop |
| Fine tune the original directory/file SVG vertical transforms as one asset-family repair | file grid 5,353; whole image 48,600 | file grid 5,287; whole image 48,534 | Accepted after separate directory and file searches plus combined full-image recapture |
| Refine the source content-box spacebar scale from `.982` to `.97` | spacebar crop 1,305; whole image 48,532 | spacebar crop 1,098; whole image 48,325 | Accepted after an expanded grid search and exact bounding-box comparison |
| Fine tune the bottom keyboard row as one unit to `translateX(.15px) scaleX(1.019)` | row crop 2,664; whole image 48,326 | row crop 2,449; whole image 48,111 | Accepted by coarse position search, fine position search, scale search and full-image recapture |
| Advance the original ENCOM constellation's shared `TextureAnimator` by 648 ms to the frozen satellite phase | globe crop 5,353; whole image 48,112 | globe crop 5,332; whole image 48,091 | Accepted after isolating the satellite layer, searching all 50 source texture frames and a full-image recapture |
| Align the first and third CPU summary columns independently to `-11px` and `8px` while retaining the other calibrated columns | whole image 48,090 | whole image 48,061 | Accepted after per-column searches and independent full-image ablation captures |
| Restore default Chromium smoothing for the network and filesystem modules | whole image 48,071 | whole image 47,729 | Accepted after global rejection, per-module isolation and five-region scoring; the perceptual metric also improved |
| Restore the upstream xterm ANSI-blue semantics for the neofetch identity, separator and field labels | formal whole image 47,722; perceptual 101,279 / 4.787% | formal whole image 47,053; perceptual 100,605 / 4.755% | Accepted by the source-driven autonomous repair transaction and confirmed by the full application gate |
| Scope the screenshot-era xterm Canvas effective foreground RGB to terminal cells | terminal formal 15,186; terminal perceptual 33,329 | terminal formal 15,112; terminal perceptual 33,302 | Accepted after the autonomous whole-screen transaction and an isolated two-metric terminal recalc proved the small improvement was independent of ENCOM run-to-run variance |
| Compensate the terminal's right-anchored session timestamp block by 1 px after the shared xterm content scale | terminal perceptual 33,302; whole perceptual 100,578 / 4.754% | terminal perceptual 32,053; whole perceptual 99,366 / 4.696% | Accepted by regional candidate attribution; all other static regions were unchanged |
| Keep the source-independent terminal tab strip outside the shared xterm content compensation and offset it by `.1px` | terminal perceptual 32,053; whole perceptual 99,342 / 4.695% | terminal perceptual 31,803; whole perceptual 99,105 / 4.684% | Accepted by regional candidate attribution and transactional recapture |

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
| Replace the frozen ENCOM random seed with any of 76 prior and newly generated deterministic seeds | globe formal 5,241; perceptual 7,624 | nearest perceptual candidate 5,364 / 7,669 | A broad source-rendered search confirmed `0x1f872855` is the unique dual-metric optimum in the tested corpus |
| Change the shared system-section scale away from `1.005 × 1.01` over a 13 × 13 local grid | system crop 9,448 | nearest candidate 9,612 | Current shared scale is the unique measured optimum; use module-specific hypotheses instead |
| Set the terminal welcome status to the source's literal 15 px font size inside the compatibility layout | whole image 51,015 | 60,513 | The larger line box moved all following flex content; preserve layout height and calibrate only the glyph cell width |
| Register all terminal tabs through the synthetic-bold compatibility face | terminal tabs 3,084 | 3,161 | It made the raster less accurate; the frame-row mismatch was the dominant shared cause |
| Change the CPU chart shared transform away from `scale(.995, .99)` and `translateY(1px)` | CPU charts crop 1,410 | nearest candidate 1,415 | The current horizontal scale, vertical scale and offset are the measured local optimum |
| Switch the filesystem footer from the light compatibility face to the source medium face | footer crop 1,454; whole image 48,527 | footer crop 1,789; whole image 48,862 | Chromium's current light-face raster remains closer to the Electron capture |
| Move the two lower-band satellites into the visible bottom corners while keeping the accepted source animation phase | globe crop 5,332; whole image 48,091 | globe crop 5,369; whole image 48,128 | The inferred centers looked plausible but the frozen screenshot score regressed; retain the existing calibrated coordinates |
| Move the fourth CPU summary column 11 px farther right based on a visual center estimate | whole image 48,090 | whole image 48,097 | The full-image capture disproved the estimate; retain the existing fourth-column calibration |
| Add a `.05px` text stroke to the terminal as an Electron raster compensation | formal whole image 47,711 | 47,629 | The formal score improved, but the antialias-aware perceptual score regressed from 101,289 to 101,521; rejected because it made visible edge coverage less faithful |
| Remove the terminal's compatibility font smoothing after restoring ANSI colors | perceptual whole image 100,617 / 4.756% | 101,091 / 4.778% | The autonomous transaction recaptured the candidate and rolled it back because visible glyph edges regressed |
| Synthesize bold weight for the neofetch ASCII logo and ANSI-blue labels | terminal perceptual 33,329 | 33,356 | The source stream carries bold semantics, but modern Chromium's synthetic Fira Mono bold moved the raster farther from the captured xterm Canvas output; the autonomous transaction rolled it back |

## Use

- Do not repeat a rejected change without new evidence that changes the capture conditions or identifies a different shared cause.
- Keep accepted changes only after clean browser diagnostics, matching dimensions and a strictly lower deterministic difference.
- Add every new rejected candidate with its measured baseline and candidate result.
