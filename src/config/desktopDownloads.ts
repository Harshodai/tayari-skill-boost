export type DesktopDownload = {
  id: "macos" | "windows" | "linux";
  platform: string;
  title: string;
  description: string;
  filename: string;
  architecture: string;
  requirements: string;
};

export const CHROME_EXTENSION_DOWNLOAD_URL = "https://github.com/Harshodai/tayari-skill-boost/releases/latest/download/Job-Tayari-Chrome-Extension.zip";

export const DESKTOP_RELEASE_URL = "https://github.com/Harshodai/tayari-skill-boost/releases/latest";
const DESKTOP_RELEASE_DOWNLOAD_URL = `${DESKTOP_RELEASE_URL}/download`;

export const DESKTOP_DOWNLOADS: DesktopDownload[] = [
  { id: "macos", platform: "macOS", title: "Apple Silicon installer", description: "A native DMG for modern Mac computers with Apple Silicon.", filename: "Job Tayari Desktop-0.1.0-arm64.dmg", architecture: "arm64", requirements: "macOS 14 or newer" },
  { id: "windows", platform: "Windows", title: "Windows installer", description: "The guided Windows installer with Start menu and desktop shortcuts.", filename: "Job Tayari Desktop-0.1.0-x64.exe", architecture: "x64", requirements: "Windows 10 or newer" },
  { id: "linux", platform: "Linux", title: "Linux AppImage", description: "A portable Linux package that runs without a system installation step.", filename: "Job Tayari Desktop-0.1.0-x64.AppImage", architecture: "x86_64", requirements: "64-bit Linux with FUSE support" },
];

export function desktopDownloadUrl(filename: string) {
  return `${DESKTOP_RELEASE_DOWNLOAD_URL}/${encodeURIComponent(filename)}`;
}
