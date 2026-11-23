# Verification runs (scenario lines only)

Extracted from the `flutter drive` output; each block ends with `N/M passed`.

| File | Content |
|---|---|
| `final.txt` | Final regression, 23 Nov 2026: for each suite v01…v08, first the iOS block, then the Android block. iOS: all suites pass. Android: v03 17/18 and v08 6/8 (see below) |
| `v03_a5.txt` | Android reader rerun after an emulator reboot: 18/18. Earlier Android reruns on the long-running emulator (load average ≈ 5 after ~3 h) lost the clipboard and a toast; the same build passed after the reboot |
| `final_android2.txt` | Android rerun of v01, v02, v04–v08 after the harness changes. v07 failed from F-ADM-08 on (this run's application card was below the 40-step scroll limit because earlier runs' approved applications fill the sandbox list; later funding scenarios depend on that campaign); v08 F-ADM-03 hit the save-button relayout race |
| `v07_commerce_a6.txt`, `v08_admin_a6.txt` | Android reruns after raising that scroll limit and making the harness tap retry its lookup: 19/19 and 8/8 |
| `ios_*_i6.txt` | iOS reruns of v03, v07 and v08 with the final harness |
| `v09_google_sign_in.txt` | Batch 9, Google sign-in without credentials (all runs, both platforms, with the plugin outcome notes) |

The harness changes were test-side only (look-up retry in `tap`, clipboard read retry, deeper scroll for one card, stack location in failure details); no assertion was relaxed and no app code changed.
