# Runtime maintenance

Keep changes reviewable by separating lifecycle/security fixes, artwork changes,
and release packaging. Do not rewrite published commits to hide their original
scope. Run the corresponding isolated regressions before integrating each change.

## Version boundaries

- `vendor/dream-skin/SOURCE.json` records the frozen upstream revision and its
  actual framework version. Theme `minClientVersion` is a Dream Skin requirement.
- `engine/client-compatibility.json` lists tested Codex **Appx package versions**.
  The controller reads `AppxManifest.xml` from the verified official installation.
  EXE `FileVersionInfo` identifies Electron and is retained separately.
- An unknown Codex package version stops theme launch. Never add versions merely
  to bypass this check. Validate selectors, theme application/removal, opening,
  account/settings surfaces, and graceful recovery against that client first.
- A successful fixture/CI run does not demonstrate installed-client compatibility.

Store upgrades can remove an old package manifest while its browser process is
still alive. New launches prefer the current registered, signed package. A
previously verified live session may recover its version from the signed Store
executable's package path; that exception never permits a cold launch from a
retired path. Restore verifies the recorded owner independently of the current
installation, so an update cannot redirect a quit request to another instance.

Desktop launch success requires the actual main app surface to be visible.
Detached/overlay hosts and healthy hidden renderers do not establish readiness.
The fixed native `open-current-main-window` message restores the main window
before trying the same-profile executable entry point. A retired executable is
never respawned. Failed graceful quit preserves state and restores the watcher.

Cold launches check the volumes containing the runtime and selected agent/database
homes for at least 64 MiB free. Saved history paths are never changed to avoid a
full volume. Theme child processes place transient files under `state/temp/`;
the caller's environment and official client launches keep their existing values.

## Data and generated outputs

| Location | Purpose | Shared in portable release |
| --- | --- | --- |
| `launcher/`, `engine/`, `integration/`, `tests/` | Sources and isolated regressions | Runtime allowlist only |
| `characters/` | Approved character inputs and reproducible packages | Explicit active-file manifests |
| `dist/releases/` | Default ZIP, release metadata and checksums output | Download artifacts only |
| `evidence/`, `.local-evidence/`, `.build-deps/`, `node_modules/` | Local test/authoring output and dependencies | No |
| `profile/`, `codex-home/`, `state/` | Private desktop, agent and launcher state | No |
| Root EXEs, `integrity.json`, active `assets/` and `themes/` | Generated local runtime required by the portable entry points | Contract-generated files |

`integration/package.py` reads only `integration/runtime-files.json`; it does not
archive the working directory. Preserve separate source and portable integrity
manifests. Generated binaries and private data stay untracked. Do not put ZIPs,
test captures or authoring caches in the repository root.

Validation staging is owned only by `state/validate-<32 lowercase hex digits>/`.
The controller removes it in `finally`, including validation failures. Recovery
never removes a profile or agent home. Recursive cleanup checks the exact parent
and rejects reparse points, including descendants.

## Checks

Build with `Build-From-Source.ps1`, then run `npm test`, `npm run test:powershell`
with both Windows PowerShell 5.1 and PowerShell 7, and `npm run test:browser` for UI
changes. All automatic tests use isolated fixtures. Package to `dist/releases/`
and run `node tests/portable-package.mjs <zip>` to verify every packaged role.

Keep the loopback CDP boundary visible in README. Random ports and file ACLs do
not authenticate CDP. Restoration must verify the process identity, request a
graceful quit, and observe process/listener exit before reporting success.
