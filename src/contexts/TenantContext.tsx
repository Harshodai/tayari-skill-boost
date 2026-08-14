import { apiFetchResponse } from "@/api";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface Tenant {
  id: string | null;
  name: string;
  domain: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

interface TenantContextValue {
  tenant: Tenant | null;
  isLoading: boolean;
  refreshBranding: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);


function hexToHsl(hex: string): string {
  // Clean up hex
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) {
    return "239 84% 60%"; // Fallback
  }

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranding = async () => {
    // Only attempt branding fetch when the self-hosted Go backend is wired up.
    // On Lovable preview/prod we don't ship a tenant API, so skip silently
    // instead of polluting the console with HTML-parse errors.
    if (!import.meta.env.VITE_API_URL) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await apiFetchResponse(`/v1/tenants/branding`, {
        headers: { "X-Tenant-Domain": window.location.host },
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("application/json")) {
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      setTenant(data);
      const root = document.documentElement;
      if (data.primary_color) {
        const hslPrimary = hexToHsl(data.primary_color);
        root.style.setProperty("--primary", hslPrimary);
        root.style.setProperty("--ring", hslPrimary);
      }
      if (data.secondary_color) {
        root.style.setProperty("--secondary", hexToHsl(data.secondary_color));
      }
    } catch {
      // Network/backend not available — leave defaults in place.
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, isLoading, refreshBranding: fetchBranding }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return ctx;
}
