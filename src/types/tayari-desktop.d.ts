export {};

declare global {
  interface Window {
    tayariDesktop?: {
      status: () => Promise<{ platform: string; apiBaseUrl: string; apiReachable: boolean; apiStatus: number | null; dockerAvailable: boolean; runtimeDirectory: string }>;
      pickFiles: () => Promise<Array<{ name: string; path: string }>>;
      revealFile: (filePath: string) => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      openAuth: (url: string) => Promise<void>;
      onAuthCallback: (callback: (url: string) => void) => () => void;
      onTaskDeepLink: (callback: (path: string) => void) => () => void;
      startServices: () => Promise<{ stdout: string; stderr: string }>;
      stopServices: () => Promise<{ stdout: string; stderr: string }>;
      settings: (next?: { apiBaseUrl?: string }) => Promise<{ apiBaseUrl: string }>;
    };
  }
}
