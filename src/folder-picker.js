import { execFile } from 'node:child_process';
import os from 'node:os';

function run(command, args) {
  return new Promise((resolve, reject) => execFile(command, args, { windowsHide: true }, (error, stdout) => {
    if (error) reject(error); else resolve(stdout.trim());
  }));
}

/** Opens the host OS folder chooser. The local dashboard is the only caller. */
export async function pickDirectory(platform = os.platform()) {
  if (platform === 'win32') {
    const script = "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; if($d.ShowDialog() -eq 'OK') { [Console]::Write($d.SelectedPath) }";
    // WinForms dialogs require a single-threaded apartment. Explicitly using
    // -STA avoids a silent no-window/hanging picker on some Node-launched shells.
    return run('powershell.exe', ['-NoProfile', '-STA', '-Command', script]);
  }
  if (platform === 'darwin') return run('osascript', ['-e', 'POSIX path of (choose folder with prompt "Choose a folder to share")']);
  return run('zenity', ['--file-selection', '--directory', '--title=Choose a folder to share']);
}
