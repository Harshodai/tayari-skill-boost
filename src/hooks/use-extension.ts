// Chrome runtime is injected by the browser extension; its ambient typings are not available in the web build.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const chrome: any;
import { useEffect, useCallback, useState } from "react";

const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID || "tayari-extension-id";
const PAGE_BRIDGE_SOURCE = "jobtayari-extension-page-bridge-v1";
const PAGE_BRIDGE_ACTIONS = new Set(["get_version", "omnisave_preferences_get", "omnisave_preferences_set", "omnisave_sync_now", "extension_session_handoff"]);

function sendPageBridgeMessage(action: string, payload: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  if (!PAGE_BRIDGE_ACTIONS.has(action)) return Promise.resolve({ success: false, error: "Unsupported browser-companion action." });
  return new Promise<Record<string, unknown>>((resolve) => {
    const requestId = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let settled = false;
    const finish = (response: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      resolve(response);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.source !== PAGE_BRIDGE_SOURCE || data.responseTo !== requestId) return;
      finish(data.response && typeof data.response === "object" ? data.response : { success: false, error: "Invalid browser-companion response." });
    };
    const timer = window.setTimeout(() => finish({ success: false, error: "Browser companion request timed out." }), 1500);
    window.addEventListener("message", onMessage);
    window.postMessage({ source: PAGE_BRIDGE_SOURCE, requestId, action, ...payload }, window.location.origin);
  });
}

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

      const directResult = await Promise.race([checkPromise, timeout]);
      if (directResult.installed) {
        setStatus(directResult);
      } else {
        const bridgeResult = await sendPageBridgeMessage("get_version");
        setStatus(bridgeResult?.version ? { installed: true, version: String(bridgeResult.version), features: Array.isArray(bridgeResult.features) ? bridgeResult.features.map(String) : [] } : { installed: false, version: null, features: [] });
      }
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


  const sendOmniSaveMessage = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    if (!status.installed) return { success: false, error: "Browser companion is not installed." };
    const directResult = await new Promise<Record<string, unknown>>((resolve) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ success: false, error: "Browser companion request timed out." });
      }, 1500);
      try {
        chrome.runtime.sendMessage(EXTENSION_ID, { action, ...payload }, (response) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message || "Browser companion did not respond." });
            return;
          }
          resolve(response || { success: false, error: "Browser companion did not respond." });
        });
      } catch (error) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve({ success: false, error: error instanceof Error ? error.message : "Browser companion is unavailable." });
      }
    });
    if (directResult.success === false) return sendPageBridgeMessage(action, payload);
    return directResult;
  }, [status.installed]);
  const getOmniSavePreferences = useCallback(() => sendOmniSaveMessage("omnisave_preferences_get"), [sendOmniSaveMessage]);
  const setOmniSavePreferences = useCallback((preferences: Record<string, unknown>) => sendOmniSaveMessage("omnisave_preferences_set", { preferences }), [sendOmniSaveMessage]);
  const omnisaveSyncNow = useCallback(() => sendOmniSaveMessage("omnisave_sync_now"), [sendOmniSaveMessage]);
  const handoffExtensionSession = useCallback((code: string) => sendOmniSaveMessage("extension_session_handoff", { code }), [sendOmniSaveMessage]);
  useEffect(() => {
    checkExtension();
  }, [checkExtension]);

  return {
    status,
    isChecking,
    checkExtension,
    syncToken,
    getExtensionToken,
    getOmniSavePreferences,
    setOmniSavePreferences,
    omnisaveSyncNow,
    handoffExtensionSession,
  };
}
