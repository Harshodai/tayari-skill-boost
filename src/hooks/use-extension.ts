declare const chrome: any;
declare const process: { env: Record<string, string | undefined> };

import { useEffect, useCallback, useState } from "react";

const EXTENSION_ID = process.env.VITE_EXTENSION_ID || "tayari-extension-id";

interface ExtensionStatus {
  installed: boolean;
  version: string | null;
  features: string[];
}

export function useExtension() {
  const [status, setStatus] = useState<ExtensionStatus>({
    installed: false,
    version: null,
    features: [],
  });
  const [isChecking, setIsChecking] = useState(true);

  const checkExtension = useCallback(async () => {
    setIsChecking(true);
    try {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        setStatus({ installed: false, version: null, features: [] });
        setIsChecking(false);
        return;
      }

      // Use a timeout to handle cases where extension doesn't respond
      const timeout = new Promise<ExtensionStatus>((resolve) => {
        setTimeout(() => resolve({ installed: false, version: null, features: [] }), 1500);
      });

      const checkPromise = new Promise<ExtensionStatus>((resolve) => {
        try {
          chrome.runtime.sendMessage(
            EXTENSION_ID,
            { action: "get_version" },
            (response) => {
              if (chrome.runtime.lastError) {
                resolve({ installed: false, version: null, features: [] });
                return;
              }
              if (response && response.version) {
                resolve({
                  installed: true,
                  version: response.version,
                  features: response.features || [],
                });
              } else {
                resolve({ installed: false, version: null, features: [] });
              }
            }
          );
        } catch (e) {
          resolve({ installed: false, version: null, features: [] });
        }
      });

      const result = await Promise.race([checkPromise, timeout]);
      setStatus(result);
    } catch (e) {
      setStatus({ installed: false, version: null, features: [] });
    } finally {
      setIsChecking(false);
    }
  }, []);

  const syncToken = useCallback(
    async (token: string | null) => {
      if (!status.installed) return false;
      try {
        return new Promise<boolean>((resolve) => {
          chrome.runtime.sendMessage(
            EXTENSION_ID,
            { action: token ? "set_token" : "clear_token", token },
            (response) => {
              if (chrome.runtime.lastError) {
                resolve(false);
                return;
              }
              resolve(!!response?.success);
            }
          );
        });
      } catch (e) {
        return false;
      }
    },
    [status.installed]
  );

  const getExtensionToken = useCallback(async () => {
    if (!status.installed) return null;
    try {
      return new Promise<string | null>((resolve) => {
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          { action: "get_token" },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve(null);
              return;
            }
            resolve(response?.token || null);
          }
        );
      });
    } catch (e) {
      return null;
    }
  }, [status.installed]);

  useEffect(() => {
    checkExtension();
  }, [checkExtension]);

  return {
    status,
    isChecking,
    checkExtension,
    syncToken,
    getExtensionToken,
  };
}
