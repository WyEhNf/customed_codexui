# Custom Codex UI

## Intro

A collection of nine character themes for the official Codex desktop app on Windows. Each theme includes character artwork, matching colors and icons, avatar frames, and an animated opening. The built-in character switcher lets you change themes from any theme while preserving the original Codex layout.

Special thanks to [fengye337/sandrone-codex](https://github.com/fengye337/sandrone-codex) for the original Sandrone project and the UI and opening-animation foundation used in this project.

## Installation

You need Windows x64 and the official Codex desktop app installed. Open the official app at least once before installing the themes.

1. Download the Windows x64 ZIP from [Releases](https://github.com/WyEhNf/customed_codexui/releases/latest). You can verify the download against `SHA256SUMS.txt` on the same release page.
2. If Windows shows an **Unblock** checkbox in the ZIP's Properties, select it before extracting. Extract the ZIP to a permanent, writable local folder outside OneDrive, other cloud-sync folders, Program Files and Windows. Network paths and directory links are rejected. Then run `Setup.ps1` with PowerShell to create the desktop shortcuts:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Setup.ps1
   ```

Open the `codexui` folder on your desktop and launch a character shortcut, or run `CodexUI.exe` directly. Use the character switcher in the title bar to change themes. Each switch plays the selected character's opening animation.

Opening or returning to a conversation starts at its latest messages. Scrolling, dragging or paging through history cancels the initial automatic positioning. Switching window focus or reapplying a theme preserves your reading position.

The themed client uses a separate `profile/` for desktop sign-in and a separate `codex-home/` for agent configuration, credentials, sessions and SQLite state. All nine themes share these two directories. The launcher sets [`CODEX_HOME` and `CODEX_SQLITE_HOME`](https://learn.chatgpt.com/docs/config-file/environment-variables) only for its child process; it does not copy your existing `~/.codex` or change the parent environment. You may need to sign in and configure tools again. Existing sessions from older releases must be closed with the restore entry before using the new isolation policy. These directories and `state/` receive Windows permissions for the current user, SYSTEM and administrators, and are excluded from releases.

To reuse an existing conversation history, save `state/agent-storage.json` with `schemaVersion: 1`, `agentHome` and `sqliteHome` set to the absolute paths of the existing agent and database directories, then fully quit and reopen the themed client. For a normal Codex home both paths point to that same directory. This saved choice takes priority on every launch and applies to all characters; `profile/` remains separate. An unavailable or invalid saved directory stops launch instead of silently creating an empty history. Back up and merge any conversations from `codex-home/` before changing directories. The launcher itself never deletes, copies or overwrites conversation databases.

The theme requires an **unauthenticated CDP debugging listener** while it runs. Each new session receives an OS-selected random port bound to `127.0.0.1`. **Loopback and randomization are not authentication: other local Windows users and processes may discover the port and control that themed session, including its agent and accessible files. Use only on a trusted computer; do not forward this port.** File permissions and a separate `CODEX_HOME` do not make this a security sandbox. Restoring quits the verified themed client and checks that its process and debugger listener have exited before opening the ordinary official client. Save or finish active work before restoring.

The launcher reads the actual Codex Appx package version and Electron PE version. Theme injection currently supports Codex packages **26.1021.2667.0** and **26.1021.3705.0**; unverified app updates are blocked until compatibility is tested. After a Store update, new launches prefer the current registered installation. Existing verified sessions retain their own recovery path, even if Store has removed their old manifest. Dream Skin's framework version is checked separately. Restoring remains available even when the app version is unsupported.

The launcher checks free space on the runtime and selected history volumes before starting a client; keep at least 1 GB available for normal operation. Theme temporary files stay in `state/temp/`. The sidebar opens by default and can then be collapsed manually. Character artwork and decorative frames fit inside the main workspace beside it.

To build from source instead, install Git and follow these steps:

1. Clone the repository:

   ```powershell
   git clone https://github.com/WyEhNf/customed_codexui.git
   cd customed_codexui
   ```

2. Download the official [Node.js 24 Windows x64 ZIP](https://nodejs.org/dist/latest-v24.x/). Extract it and copy `node.exe` into this repository's `runtime` folder. Keep the accompanying Node.js license as `runtime/LICENSE-node.txt`.

3. Build the launchers and theme packages:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Build-From-Source.ps1
   ```

   The build uses the Windows .NET Framework C# compiler. Character artwork, videos, and lettering are already included; no image or video generation tools are needed.

4. Run `Setup.ps1` as shown above to create the desktop shortcuts.

To restore the original appearance, use the restore shortcut in the desktop `codexui` folder, or run:

```powershell
.\CodexUI.exe --restore
```

Both `CodexUI.exe --restore` and `SandroneCodex.exe --restore` use the same recovery controller. If a graphical launcher is unavailable, run `powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Theme-Actions.ps1 -Action Restore`. Restoration normally exits the themed client; it never force-kills an unrelated process or migrates account data.
