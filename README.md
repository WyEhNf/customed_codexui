# Custom Codex UI

## Intro

A collection of nine character themes for the official Codex desktop app on Windows. Each theme includes character artwork, matching colors and icons, avatar frames, and an animated opening. The built-in character switcher lets you change themes from any theme while preserving the original Codex layout.

Special thanks to [fengye337/sandrone-codex](https://github.com/fengye337/sandrone-codex) for the original Sandrone project and the UI and opening-animation foundation used in this project.

## Installation

You need Windows x64, Git, and the official Codex desktop app installed. Open the official app at least once before installing the themes.

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

4. Create the desktop shortcuts:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Setup.ps1
   ```

Open the `codexui` folder on your desktop and launch a character shortcut, or run `CodexUI.exe` directly. Use the character switcher in the title bar to change themes. Each switch plays the selected character's opening animation.

The themed client uses a separate profile shared by all themes. You may need to sign in on first launch.

To restore the original appearance, use the restore shortcut in the desktop `codexui` folder, or run:

```powershell
.\CodexUI.exe --restore
```
