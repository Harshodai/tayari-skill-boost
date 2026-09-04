# Dimension 9: Enterprise / White-Label & Mobile Expansion

## Executive Summary

The Enterprise and Mobile expansion represents Tayari's **path to sustainable revenue** and **massive reach multiplication**. While the B2C job search market is crowded, the **B2B career services market** (universities, bootcamps, coaching firms, workforce development agencies) is underserved, with existing solutions like JobWinner.ai and Rezi Enterprise charging $99-$500+/month per institution.

Tayari's unique advantages for B2B:
1. **Full-stack platform** — Not just resume builder, but end-to-end job search system
2. **Local-first AI** — Ollama integration means institutions can run on-premise for data privacy (critical for universities)
3. **Built-in analytics** — Career center dashboards, placement tracking, employer engagement
4. **White-label ready** — React frontend makes branding easy; Go backend makes multi-tenancy straightforward

For mobile, a **Progressive Web App (PWA)** is the fastest path to market — leveraging the existing React codebase, adding offline capability, push notifications, and add-to-home-screen functionality without building a separate native app.

**Revenue potential:**
- B2C: Freemium ($0) → Premium ($9-19/month)
- B2B (Universities): $500-2,000/month per institution (100-2,000 students)
- B2B (Coaches): $99-299/month per coach (10-50 clients)
- B2B (Bootcamps): $200-500/month per cohort (20-100 students)

**Implementation estimate:** 8-12 weeks for multi-tenant foundation + white-label + PWA; 12-16 weeks for full enterprise features (university portal, employer partnerships, alumni network).

---

## Market Research

### B2B Customer Segments

| Segment | Size (Global) | Average Budget | Key Needs | Decision Maker | Sales Cycle |
|---------|-------------|---------------|-----------|---------------|-------------|
| **Universities** | 25,000+ | $500-5,000/mo | Student tracking, placement reports, employer portal, career center dashboard | Career Center Director | 3-6 months |
| **Bootcamps** | 10,000+ | $200-1,000/mo | Job placement guarantee, cohort tracking, employer partnerships, placement ROI | Founder/CEO | 1-3 months |
| **Career Coaches** | 100,000+ | $50-300/mo | Client management, white-label branding, progress tracking, analytics | Individual coach | 1-2 weeks |
| **Outplacement Firms** | 5,000+ | $1,000-10,000/mo | Bulk user onboarding, employer network, rapid placement, reporting | VP Services | 2-4 months |
| **Government Workforce** | 5,000+ | $500-2,000/mo | Compliance tracking, outcome metrics, skills training integration, reporting | Program Director | 6-12 months |
| **Corporate L&D** | 50,000+ | $2,000-20,000/mo | Internal mobility, skills gap analysis, learning paths, succession planning | L&D Director | 3-6 months |

### Competitor Pricing Analysis

| Competitor | Target Segment | Pricing Model | Price Point | White-Label? | Key Features |
|------------|--------------|--------------|-------------|--------------|-------------|
| **JobWinner.ai** | Coaches, universities | Per institution | $199-499/mo | ✅ Full | Resume builder, job matching, interview prep, client tracking |
| **Rezi Enterprise** | Universities, firms | Per 100 users | $249/mo | ✅ Full | AI resume builder, cover letters, resume scanner, admin dashboard |
| **WriteSea** | Job boards, coaches | Revenue share (80/20) | $0 upfront + 20% | ✅ Embedded | Resume builder, job matching, career guidance, multi-language |
| **Rocky.ai** | Coaches, corporations | Per seat | $99/mo (5 users) | ✅ Branded app | Coaching chatbot, goal tracking, journaling, engagement analytics |
| **Resoume** | Coaches, agencies | Per user tier | Custom | ✅ Full | Resume + portfolio builder, coach review system, mobile-responsive |
| **Tayari (planned)** | All segments | Tiered: Free/Pro/Enterprise | $0-2,000/mo | ✅ Full | **Full job search loop + local AI + analytics + white-label** |

**Tayari's B2B Differentiation:**
1. **Only platform** with full job search loop (resume → jobs → apply → interviews → analytics)
2. **Only platform** with local AI option (Ollama) for on-premise privacy compliance
3. **Only platform** with predictive analytics and A/B testing for placement optimization
4. **Only platform** with voice interview AI + real-time coaching
5. **Only platform** with career intelligence engine (market data, skill gaps, learning paths)

---

## Multi-Tenant Architecture Design

### Architecture Pattern Decision: Shared Schema with tenant_id + RLS

After evaluating all options (shared schema, schema-per-tenant, database-per-tenant, hybrid), the recommendation is **shared schema with tenant_id columns + PostgreSQL Row Level Security (RLS)** for the following reasons:

1. **Lowest operational overhead** — One database, one connection pool, one migration path
2. **Scales to 10,000+ tenants** — Notion uses this pattern at 480 logical shards on 32 physical DBs
3. **Easiest cross-tenant analytics** — Aggregate data for market intelligence, benchmarking
4. **Simplest migration** — From single-tenant to multi-tenant: add tenant_id column, enable RLS
5. **Strong security** — RLS policies prevent cross-tenant data leakage at the database level

```
Single-Tenant → Multi-Tenant Migration Path

Step 1: Add tenant_id to all tables
Step 2: Create default tenant (tayari_default) for existing users
Step 3: Update all queries to include tenant_id filter
Step 4: Enable RLS policies on all tables
Step 5: Add tenant middleware to extract tenant from subdomain/header
Step 6: Deploy and verify isolation
Step 7: Add tenant management UI (admin dashboard)
```

### Go Backend Multi-Tenancy Implementation

```go
// backend/go/internal/tenant/tenant.go
package tenant

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

// TenantContextKey is the key for tenant ID in context
const TenantContextKey = "tenant_id"

// Tenant represents a tenant/organization
type Tenant struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Subdomain   string `json:"subdomain"`
	CustomDomain string `json:"custom_domain,omitempty"`
	Plan        string `json:"plan"` // free, pro, enterprise
	Features    map[string]bool `json:"features"`
	Branding    TenantBranding `json:"branding"`
	Settings    TenantSettings `json:"settings"`
	IsActive    bool `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

type TenantBranding struct {
	LogoURL     string `json:"logo_url,omitempty"`
	PrimaryColor string `json:"primary_color,omitempty"`
	SecondaryColor string `json:"secondary_color,omitempty"`
	FaviconURL  string `json:"favicon_url,omitempty"`
	CustomCSS   string `json:"custom_css,omitempty"`
}

type TenantSettings struct {
	AllowedDomains []string `json:"allowed_domains,omitempty"` // For email domain restrictions
	MaxUsers       int      `json:"max_users,omitempty"`
	MaxResumes     int      `json:"max_resumes,omitempty"`
	CustomLLMEndpoint string `json:"custom_llm_endpoint,omitempty"`
	EnableSSO      bool     `json:"enable_sso,omitempty"`
}

// TenantStore manages tenant data
type TenantStore struct {
	db *sql.DB
	// Cache: map[tenantID]Tenant — use Redis for production
	cache map[string]Tenant
}

func NewTenantStore(db *sql.DB) *TenantStore {
	return &TenantStore{db: db, cache: make(map[string]Tenant)}
}

func (s *TenantStore) GetTenant(ctx context.Context, id string) (*Tenant, error) {
	// Check cache first
	if tenant, ok := s.cache[id]; ok {
		return &tenant, nil
	}
	
	// Fetch from database
	var tenant Tenant
	err := s.db.QueryRowContext(ctx, 
		"SELECT id, name, subdomain, custom_domain, plan, features, branding, settings, is_active, created_at FROM tenants WHERE id = $1",
		id,
	).Scan(
		&tenant.ID, &tenant.Name, &tenant.Subdomain, &tenant.CustomDomain,
		&tenant.Plan, &tenant.Features, &tenant.Branding, &tenant.Settings,
		&tenant.IsActive, &tenant.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	
	if !tenant.IsActive {
		return nil, fmt.Errorf("tenant is not active")
	}
	
	// Cache tenant
	s.cache[id] = tenant
	return &tenant, nil
}

func (s *TenantStore) GetTenantBySubdomain(ctx context.Context, subdomain string) (*Tenant, error) {
	var tenant Tenant
	err := s.db.QueryRowContext(ctx, 
		"SELECT id, name, subdomain, custom_domain, plan, features, branding, settings, is_active, created_at FROM tenants WHERE subdomain = $1",
		subdomain,
	).Scan(
		&tenant.ID, &tenant.Name, &tenant.Subdomain, &tenant.CustomDomain,
		&tenant.Plan, &tenant.Features, &tenant.Branding, &tenant.Settings,
		&tenant.IsActive, &tenant.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &tenant, nil
}

func (s *TenantStore) GetTenantByDomain(ctx context.Context, domain string) (*Tenant, error) {
	var tenant Tenant
	err := s.db.QueryRowContext(ctx, 
		"SELECT id, name, subdomain, custom_domain, plan, features, branding, settings, is_active, created_at FROM tenants WHERE custom_domain = $1",
		domain,
	).Scan(
		&tenant.ID, &tenant.Name, &tenant.Subdomain, &tenant.CustomDomain,
		&tenant.Plan, &tenant.Features, &tenant.Branding, &tenant.Settings,
		&tenant.IsActive, &tenant.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &tenant, nil
}

// TenantMiddleware extracts tenant from request and adds to context
func (s *TenantStore) TenantMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		
		// 1. Try to extract tenant from custom domain
		host := r.Host
		if strings.Contains(host, ".") && !strings.HasPrefix(host, "tayari.app") && !strings.HasPrefix(host, "localhost") {
			// Custom domain: careers.university.edu
			tenant, err := s.GetTenantByDomain(ctx, host)
			if err == nil && tenant != nil {
				ctx = context.WithValue(ctx, TenantContextKey, tenant.ID)
				r = r.WithContext(ctx)
				next.ServeHTTP(w, r)
				return
			}
		}
		
		// 2. Try to extract tenant from subdomain
		// Format: university.tayari.app
		parts := strings.Split(host, ".")
		if len(parts) >= 3 && parts[len(parts)-2] == "tayari" && parts[len(parts)-1] == "app" {
			subdomain := parts[0]
			if subdomain != "www" && subdomain != "app" && subdomain != "api" {
				tenant, err := s.GetTenantBySubdomain(ctx, subdomain)
				if err == nil && tenant != nil {
					ctx = context.WithValue(ctx, TenantContextKey, tenant.ID)
					r = r.WithContext(ctx)
					next.ServeHTTP(w, r)
					return
				}
			}
		}
		
		// 3. Try to extract tenant from header (for API requests)
		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID != "" {
			tenant, err := s.GetTenant(ctx, tenantID)
			if err == nil && tenant != nil {
				ctx = context.WithValue(ctx, TenantContextKey, tenant.ID)
				r = r.WithContext(ctx)
			}
		}
		
		// 4. Default to public tenant (single-tenant fallback)
		if ctx.Value(TenantContextKey) == nil {
			ctx = context.WithValue(ctx, TenantContextKey, "tayari_default")
			r = r.WithContext(ctx)
		}
		
		next.ServeHTTP(w, r)
	})
}

// GetTenantID retrieves tenant ID from context
func GetTenantID(ctx context.Context) string {
	if id, ok := ctx.Value(TenantContextKey).(string); ok {
		return id
	}
	return "tayari_default"
}

// RequireTenant middleware ensures tenant is set (for protected routes)
func RequireTenant(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if GetTenantID(r.Context()) == "" {
			http.Error(w, "Tenant not found", http.StatusBadRequest)
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

### PostgreSQL RLS Policies

```sql
-- Step 1: Add tenant_id to all existing tables (gradual migration)

-- Users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tayari_default';
CREATE INDEX idx_users_tenant_id ON users(tenant_id);

-- Resumes table
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tayari_default';
CREATE INDEX idx_resumes_tenant_id ON resumes(tenant_id);

-- All other tables...
ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tayari_default';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tayari_default';
ALTER TABLE saved_jobs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tayari_default';
ALTER TABLE autopilot_runs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tayari_default';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tayari_default';
ALTER TABLE autopilot_schedules ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tayari_default';

-- Step 2: Create function to set tenant context (safe for transaction poolers)
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- Using set_config with is_local=true ensures transaction-scoped setting
    -- This is safe with PgBouncer in transaction mode
    PERFORM set_config('app.current_tenant_id', tenant_id, true);
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create RLS policies for all tables

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners (even for superusers, bypass with BYPASSRLS)
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE resumes FORCE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE applications FORCE ROW LEVEL SECURITY;

-- Create RLS policy: users can only see data from their tenant
CREATE POLICY tenant_isolation_users ON users
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_resumes ON resumes
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_saved_jobs ON saved_jobs
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_applications ON applications
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Step 4: Create composite indexes with tenant_id as leading column
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX idx_resumes_tenant_user ON resumes(tenant_id, user_id);
CREATE INDEX idx_applications_tenant_user ON applications(tenant_id, user_id);
CREATE INDEX idx_saved_jobs_tenant_user ON saved_jobs(tenant_id, user_id);

-- Step 5: Update all queries to set tenant context before operations
-- In Go, before each query:
-- _, err := db.Exec("SELECT set_tenant_context($1)", tenantID)
-- Then proceed with normal query — RLS will filter automatically

-- Step 6: Create tenants table for managing tenant metadata
CREATE TABLE tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE,
    custom_domain VARCHAR(255) UNIQUE,
    plan VARCHAR(50) NOT NULL DEFAULT 'free', -- free, pro, enterprise
    features JSONB DEFAULT '{}',
    branding JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Step 7: Create admin users table (tenant-scoped admins)
CREATE TABLE tenant_admins (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'admin', -- admin, manager, viewer
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);
```

### Go Database Helper (Tenant-Aware Queries)

```go
// backend/go/internal/db/tenant_db.go
package db

import (
	"context"
	"database/sql"
	"fmt"

	"tayari/internal/tenant"
)

// TenantDB wraps sql.DB with automatic tenant context
type TenantDB struct {
	*sql.DB
}

func NewTenantDB(db *sql.DB) *TenantDB {
	return &TenantDB{DB: db}
}

// QueryContext automatically sets tenant context before querying
func (db *TenantDB) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	tenantID := tenant.GetTenantID(ctx)
	if tenantID != "" && tenantID != "tayari_default" {
		// Set tenant context for RLS
		_, err := db.DB.ExecContext(ctx, "SELECT set_tenant_context($1)", tenantID)
		if err != nil {
			return nil, fmt.Errorf("failed to set tenant context: %w", err)
		}
	}
	return db.DB.QueryContext(ctx, query, args...)
}

func (db *TenantDB) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	tenantID := tenant.GetTenantID(ctx)
	if tenantID != "" && tenantID != "tayari_default" {
		db.DB.ExecContext(ctx, "SELECT set_tenant_context($1)", tenantID)
	}
	return db.DB.QueryRowContext(ctx, query, args...)
}

func (db *TenantDB) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	tenantID := tenant.GetTenantID(ctx)
	if tenantID != "" && tenantID != "tayari_default" {
		db.DB.ExecContext(ctx, "SELECT set_tenant_context($1)", tenantID)
	}
	return db.DB.ExecContext(ctx, query, args...)
}

// WithTenant adds tenant_id to INSERT queries automatically
func (db *TenantDB) WithTenant(ctx context.Context, query string, args ...interface{}) (string, []interface{}) {
	tenantID := tenant.GetTenantID(ctx)
	if tenantID == "" || tenantID == "tayari_default" {
		return query, args
	}
	
	// For INSERT queries, add tenant_id to columns and values
	// This is a simplified approach; production would use query parsing
	if len(args) > 0 && query starts with "INSERT" {
		// Add tenant_id as first argument
		newArgs := append([]interface{}{tenantID}, args...)
		return query, newArgs
	}
	
	return query, args
}
```

---

## White-Label Frontend Implementation

### Dynamic Theme Configuration

```typescript
// src/context/TenantContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';

interface TenantBranding {
  logoURL?: string;
  primaryColor: string;
  secondaryColor: string;
  faviconURL?: string;
  customCSS?: string;
}

interface TenantFeatures {
  resumeOptimizer: boolean;
  jobSearch: boolean;
  interviewPrep: boolean;
  coverLetter: boolean;
  communicationHub: boolean;
  browserExtension: boolean;
  careerIntelligence: boolean;
  voiceInterview: boolean;
  analytics: boolean;
}

interface TenantConfig {
  id: string;
  name: string;
  plan: string;
  branding: TenantBranding;
  features: TenantFeatures;
  customDomain?: string;
}

interface TenantContextType {
  tenant: TenantConfig | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType>({ tenant: null, isLoading: true });

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTenant() {
      // Extract tenant from subdomain or custom domain
      const host = window.location.host;
      const parts = host.split('.');
      
      let tenantId = 'tayari_default';
      
      if (parts.length >= 3 && parts[parts.length - 2] === 'tayari' && parts[parts.length - 1] === 'app') {
        const subdomain = parts[0];
        if (subdomain !== 'www' && subdomain !== 'app') {
          tenantId = subdomain;
        }
      } else if (!host.includes('tayari.app') && !host.includes('localhost')) {
        // Custom domain
        tenantId = await resolveCustomDomain(host);
      }
      
      // Fetch tenant config from API
      const response = await fetch(`/api/v1/tenant/config?tenant=${tenantId}`);
      if (response.ok) {
        const config = await response.json();
        setTenant(config);
        
        // Apply branding
        applyBranding(config.branding);
      } else {
        setTenant(null);
      }
      
      setIsLoading(false);
    }
    
    loadTenant();
  }, []);

  function applyBranding(branding: TenantBranding) {
    // Set CSS variables
    const root = document.documentElement;
    root.style.setProperty('--tenant-primary', branding.primaryColor || '#3b82f6');
    root.style.setProperty('--tenant-secondary', branding.secondaryColor || '#10b981');
    
    // Set favicon
    if (branding.faviconURL) {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) favicon.href = branding.faviconURL;
    }
    
    // Inject custom CSS
    if (branding.customCSS) {
      const style = document.createElement('style');
      style.textContent = branding.customCSS;
      document.head.appendChild(style);
    }
    
    // Update title
    if (tenant?.name) {
      document.title = `${tenant.name} - Career Platform`;
    }
  }

  return (
    <TenantContext.Provider value={{ tenant, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

// Feature flag hook
export function useFeatureFlag(feature: keyof TenantFeatures): boolean {
  const { tenant } = useTenant();
  if (!tenant) return true; // Default: all features enabled for single-tenant
  return tenant.features[feature] ?? true;
}
```

### Dynamic Logo Component

```tsx
// src/components/TenantLogo.tsx
import { useTenant } from '@/context/TenantContext';

export function TenantLogo({ className }: { className?: string }) {
  const { tenant } = useTenant();
  
  if (tenant?.branding?.logoURL) {
    return <img src={tenant.branding.logoURL} alt={tenant.name} className={className} />;
  }
  
  // Default Tayari logo
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-lg">T</span>
      </div>
      <span className="font-bold text-xl text-gray-900">Tayari</span>
    </div>
  );
}
```

### Tenant-Aware Navigation

```tsx
// src/components/NavBar.tsx (simplified with tenant support)
import { useTenant, useFeatureFlag } from '@/context/TenantContext';

export function NavBar() {
  const { tenant } = useTenant();
  const hasResumeOptimizer = useFeatureFlag('resumeOptimizer');
  const hasJobSearch = useFeatureFlag('jobSearch');
  const hasInterviewPrep = useFeatureFlag('interviewPrep');
  const hasCareerIntelligence = useFeatureFlag('careerIntelligence');
  
  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <TenantLogo className="h-8" />
          
          <div className="flex items-center gap-6">
            {hasResumeOptimizer && <Link to="/resume">Resume</Link>}
            {hasJobSearch && <Link to="/jobs">Jobs</Link>}
            {hasInterviewPrep && <Link to="/interview">Interview</Link>}
            {hasCareerIntelligence && <Link to="/career-intelligence">Intelligence</Link>}
            
            {/* Always show these core features */}
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/profile">Profile</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

---

## Mobile Strategy: PWA Implementation

### PWA vs React Native Decision Matrix

| Criteria | PWA | React Native | Winner |
|----------|-----|-------------|--------|
| **Time to market** | 2-3 weeks | 8-12 weeks | PWA |
| **Code reuse** | 100% (same React codebase) | ~60% (separate codebase) | PWA |
| **Team skills** | Same team (React/TS) | Need mobile specialists | PWA |
| **App store presence** | No (web-only) | Yes (App Store/Play Store) | React Native |
| **Native features** | Limited (camera, push, mic) | Full access | React Native |
| **Offline capability** | Good (Service Worker) | Excellent | React Native |
| **Performance** | Good (modern browsers) | Better (native UI) | React Native |
| **iOS limitations** | Push notifications limited | Full support | React Native |
| **Update deployment** | Instant (no app store) | App store review | PWA |
| **Cost** | Low | High | PWA |

**Recommendation:** Start with **PWA** for immediate mobile reach (2-3 weeks). Add **React Native** later if App Store presence becomes critical (Phase 2, 6+ months).

### PWA Configuration

```typescript
// vite.config.ts (add PWA plugin)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Tayari - Job Search Companion',
        short_name: 'Tayari',
        description: 'Your AI-powered job search companion',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/dashboard',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.tayari\.app\/api\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
          {
            urlPattern: /^https:\/\/api\.tayari\.app\/api\/v1\/(jobs|resumes|profile)/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'data-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
      },
    }),
  ],
});

// src/service-worker.ts (custom service worker for offline support)
/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

// Push notification handler
sw.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  
  event.waitUntil(
    sw.registration.showNotification(data.title || 'Tayari', {
      body: data.body || 'You have a new notification',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: data.tag || 'default',
      data: data.payload,
      actions: data.actions || [],
      requireInteraction: data.requireInteraction || false,
    })
  );
});

// Notification click handler
sw.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  let url = '/dashboard';
  
  if (data?.type === 'job_match') {
    url = `/jobs?match=${data.jobId}`;
  } else if (data?.type === 'interview_reminder') {
    url = `/interview-board`;
  } else if (data?.type === 'follow_up') {
    url = `/communication-hub`;
  } else if (data?.type === 'learning_reminder') {
    url = `/career-intelligence/learning-path`;
  }
  
  event.waitUntil(
    sw.clients.openWindow(url)
  );
});

// Background sync for offline form submissions
sw.addEventListener('sync', (event) => {
  if (event.tag === 'application-sync') {
    event.waitUntil(syncPendingApplications());
  } else if (event.tag === 'resume-sync') {
    event.waitUntil(syncPendingResumes());
  }
});

async function syncPendingApplications() {
  const db = await openDB('tayari-offline', 1);
  const pending = await db.getAll('pending_applications');
  
  for (const app of pending) {
    try {
      await fetch('/api/v1/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(app),
      });
      await db.delete('pending_applications', app.id);
    } catch (e) {
      console.error('Failed to sync application:', e);
    }
  }
}
```

### Push Notification Architecture

```go
// backend/go/internal/notifications/push.go
package notifications

import (
	"encoding/json"
	"fmt"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// PushNotificationService handles Web Push notifications
type PushNotificationService struct {
	vapidPublicKey  string
	vapidPrivateKey string
	vapidSubject    string
}

func NewPushNotificationService(publicKey, privateKey, subject string) *PushNotificationService {
	return &PushNotificationService{
		vapidPublicKey:  publicKey,
		vapidPrivateKey: privateKey,
		vapidSubject:    subject,
	}
}

// PushSubscription represents a user's push subscription
type PushSubscription struct {
	ID        int    `json:"id"`
	UserID    int    `json:"user_id"`
	Endpoint  string `json:"endpoint"`
	P256dh    string `json:"p256dh"`
	Auth      string `json:"auth"`
	UserAgent string `json:"user_agent"`
	CreatedAt string `json:"created_at"`
}

// NotificationPayload is the push notification content
type NotificationPayload struct {
	Title              string            `json:"title"`
	Body               string            `json:"body"`
	Icon               string            `json:"icon"`
	Badge              string            `json:"badge"`
	Tag                string            `json:"tag"`
	RequireInteraction bool              `json:"requireInteraction"`
	Actions            []NotificationAction `json:"actions,omitempty"`
	Data               NotificationData    `json:"data,omitempty"`
}

type NotificationAction struct {
	Action string `json:"action"`
	Title  string `json:"title"`
	Icon   string `json:"icon,omitempty"`
}

type NotificationData struct {
	Type   string `json:"type"`
	JobID  int    `json:"jobId,omitempty"`
	URL    string `json:"url,omitempty"`
}

func (s *PushNotificationService) SendNotification(subscription *PushSubscription, payload *NotificationPayload) error {
	// Convert subscription to webpush format
	wpSub := &webpush.Subscription{
		Endpoint: subscription.Endpoint,
		Keys: webpush.Keys{
			P256dh: subscription.P256dh,
			Auth:   subscription.Auth,
		},
	}
	
	// Marshal payload
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}
	
	// Send push notification
	resp, err := webpush.SendNotification(payloadJSON, wpSub, &webpush.Options{
		Subscriber:      s.vapidSubject,
		VAPIDPublicKey:  s.vapidPublicKey,
		VAPIDPrivateKey: s.vapidPrivateKey,
		TTL:             60 * 60 * 24, // 24 hours
	})
	if err != nil {
		return fmt.Errorf("failed to send notification: %w", err)
	}
	defer resp.Body.Close()
	
	// Check if subscription is expired (410 Gone)
	if resp.StatusCode == 410 {
		return fmt.Errorf("subscription expired")
	}
	
	return nil
}

// Notification types for different scenarios
func (s *PushNotificationService) NewJobMatchNotification(jobTitle, company string) *NotificationPayload {
	return &NotificationPayload{
		Title:              "New Job Match!",
		Body:               fmt.Sprintf("%s at %s matches your profile", jobTitle, company),
		Icon:               "/pwa-192x192.png",
		Badge:              "/pwa-64x64.png",
		Tag:                "job-match",
		RequireInteraction: false,
		Data: NotificationData{
			Type: "job_match",
		},
	}
}

func (s *PushNotificationService) InterviewReminderNotification(interviewTime, company string) *NotificationPayload {
	return &NotificationPayload{
		Title:              "Interview Reminder",
		Body:               fmt.Sprintf("Your interview with %s is in 1 hour", company),
		Icon:               "/pwa-192x192.png",
		Badge:              "/pwa-64x64.png",
		Tag:                "interview-reminder",
		RequireInteraction: true,
		Actions: []NotificationAction{
			{Action: "open", Title: "Open App"},
			{Action: "prep", Title: "Prep Now"},
		},
		Data: NotificationData{
			Type: "interview_reminder",
		},
	}
}

func (s *PushNotificationService) FollowUpReminderNotification(company, daysSince string) *NotificationPayload {
	return &NotificationPayload{
		Title:              "Follow-Up Reminder",
		Body:               fmt.Sprintf("It's been %s since you applied to %s. Send a follow-up?", daysSince, company),
		Icon:               "/pwa-192x192.png",
		Badge:              "/pwa-64x64.png",
		Tag:                "follow-up",
		RequireInteraction: true,
		Actions: []NotificationAction{
			{Action: "follow-up", Title: "Send Follow-Up"},
			{Action: "dismiss", Title: "Dismiss"},
		},
		Data: NotificationData{
			Type: "follow_up",
		},
	}
}

func (s *PushNotificationService) LearningReminderNotification(skill string, dayStreak int) *NotificationPayload {
	return &NotificationPayload{
		Title:              fmt.Sprintf("🔥 %d Day Streak!", dayStreak),
		Body:               fmt.Sprintf("Continue learning %s today. You're making great progress!", skill),
		Icon:               "/pwa-192x192.png",
		Badge:              "/pwa-64x64.png",
		Tag:                "learning-reminder",
		RequireInteraction: false,
		Data: NotificationData{
			Type: "learning_reminder",
		},
	}
}
```

### React Push Notification Hook

```typescript
// src/hooks/usePushNotifications.ts
import { useEffect, useState, useCallback } from 'react';

interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check if push notifications are supported
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Check existing subscription
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((sub) => {
          setSubscription(sub);
        });
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) return;

    const registration = await navigator.serviceWorker.ready;
    
    // Request permission
    const permissionResult = await Notification.requestPermission();
    setPermission(permissionResult);
    
    if (permissionResult !== 'granted') {
      throw new Error('Permission denied');
    }

    // Get VAPID public key from server
    const response = await fetch('/api/v1/notifications/vapid-public-key');
    const { publicKey } = await response.json();

    // Subscribe
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    setSubscription(sub);

    // Send subscription to server
    const subscriptionData: PushSubscriptionData = {
      endpoint: sub.endpoint,
      p256dh: arrayBufferToBase64(sub.getKey('p256dh')!),
      auth: arrayBufferToBase64(sub.getKey('auth')!),
    };

    await fetch('/api/v1/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscriptionData),
    });

    return sub;
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;

    await subscription.unsubscribe();
    setSubscription(null);

    // Tell server to remove subscription
    await fetch('/api/v1/notifications/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  }, [subscription]);

  return { isSupported, subscription, permission, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
```

---

## University / Bootcamp Specific Features

### Career Center Dashboard

```typescript
// src/pages/enterprise/CareerCenterDashboard.tsx
// Admin dashboard for university career center staff

// Features:
// 1. Student Overview (total students, active job seekers, placement rate)
// 2. Placement Funnel (applied → interview → offer → accepted)
// 3. Top Employers (companies hiring most students)
// 4. Skills Gap Analysis (aggregate: what skills are most students missing?)
// 5. Salary Outcomes (median salary by program/major)
// 6. Engagement Metrics (active users, resume optimizations, interview practices)
// 7. Employer Network (companies that have posted jobs, attended career fairs)
// 8. Cohort Comparison (compare placement rates across semesters/years)
// 9. Export Reports (PDF/CSV for accreditation, board meetings)

// Route: /admin/career-center (tenant-scoped)
// Access: tenant_admins with role='admin' or 'manager'
```

### Bulk Student Onboarding

```python
# backend/python/app/api/enterprise.py
from fastapi import APIRouter, UploadFile, File
import csv
import io

router = APIRouter(prefix="/api/v1/enterprise")

@router.post("/students/bulk-import")
async def bulk_import_students(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_tenant_id),
    admin_user: User = Depends(require_admin_role),
):
    """Bulk import students from CSV file"""
    
    # Validate CSV format
    content = await file.read()
    csv_file = io.StringIO(content.decode('utf-8'))
    reader = csv.DictReader(csv_file)
    
    required_fields = ['email', 'first_name', 'last_name']
    optional_fields = ['student_id', 'major', 'graduation_year', 'program']
    
    # Validate headers
    if not all(field in reader.fieldnames for field in required_fields):
        raise HTTPException(400, f"CSV must contain: {required_fields}")
    
    results = {'created': 0, 'existing': 0, 'errors': []}
    
    for row in reader:
        try:
            # Check if user already exists
            existing = await db.fetchrow(
                "SELECT id FROM users WHERE email = $1 AND tenant_id = $2",
                row['email'], tenant_id
            )
            
            if existing:
                results['existing'] += 1
                continue
            
            # Create user with temporary password (send welcome email)
            temp_password = generate_temp_password()
            
            user = await create_user(
                email=row['email'],
                first_name=row['first_name'],
                last_name=row['last_name'],
                tenant_id=tenant_id,
                role='student',
                metadata={
                    'student_id': row.get('student_id'),
                    'major': row.get('major'),
                    'graduation_year': row.get('graduation_year'),
                    'program': row.get('program'),
                    'imported_at': datetime.utcnow().isoformat(),
                },
                password_hash=hash_password(temp_password),
            )
            
            # Send welcome email with login credentials
            await send_welcome_email(
                to=row['email'],
                name=f"{row['first_name']} {row['last_name']}",
                login_url=f"https://{tenant_id}.tayari.app/login",
                temp_password=temp_password,
            )
            
            results['created'] += 1
            
        except Exception as e:
            results['errors'].append({'row': row, 'error': str(e)})
    
    return results
```

### Employer Portal

```typescript
// src/pages/enterprise/EmployerPortal.tsx
// Portal for employers to post jobs, view student profiles, schedule interviews

// Features:
// 1. Job Posting (create, edit, manage job listings)
// 2. Student Search (search by skills, major, graduation year, GPA)
// 3. Profile View (view anonymized or consented student profiles)
// 4. Interview Scheduling (schedule on-campus or virtual interviews)
// 5. Application Review (review applications, shortlist candidates)
// 6. Event Management (career fairs, info sessions, workshops)
// 7. Analytics (application volume, hiring pipeline, time-to-hire)
// 8. Messaging ( communicate with career center, students)

// Route: /employer (separate subdomain or path, e.g., employer.tayari.app)
// Access: employer accounts approved by tenant admin
```

---

## Implementation Roadmap

### Phase 1: Multi-Tenant Foundation (Weeks 1-3)
- **Tasks:**
  - Add tenant_id to all database tables
  - Implement PostgreSQL RLS policies
  - Build tenant middleware (Go) for subdomain/header extraction
  - Create TenantStore (CRUD for tenants)
  - Update all queries to be tenant-aware
  - Build tenant admin API (create, update, delete tenants)
  - Add backward compatibility (single-tenant users default to 'tayari_default')
- **Deliverable:** Multi-tenant backend with data isolation

### Phase 2: White-Label Frontend (Weeks 4-5)
- **Tasks:**
  - Build TenantContext (React context for tenant config)
  - Implement dynamic theming (CSS variables, logo, colors)
  - Add feature flags per tenant
  - Build TenantLogo component (dynamic logo replacement)
  - Create tenant config API endpoint
  - Add custom domain support (DNS routing)
  - Build admin dashboard for tenant branding settings
- **Deliverable:** White-label frontend with customizable branding and features

### Phase 3: PWA Mobile App (Weeks 6-8)
- **Tasks:**
  - Add Vite PWA plugin with manifest configuration
  - Implement Service Worker with caching strategies
  - Add offline support (cache API responses, queue offline actions)
  - Build push notification system (Web Push API + Go backend)
  - Create push notification settings UI (user preferences)
  - Add add-to-home-screen prompt
  - Optimize mobile UX (touch targets, mobile navigation, responsive layouts)
  - Test on iOS Safari, Android Chrome, desktop browsers
- **Deliverable:** Installable PWA with offline support and push notifications

### Phase 4: Enterprise Admin Features (Weeks 9-12)
- **Tasks:**
  - Build career center dashboard (student overview, placement funnel, analytics)
  - Implement bulk student onboarding (CSV upload, email invites)
  - Add student progress tracking (aggregate analytics per cohort)
  - Build reporting system (PDF/CSV export for accreditation)
  - Create employer portal (job posting, student search, interview scheduling)
  - Add role-based access control (admin, manager, viewer, student, employer)
  - Implement SSO integration (SAML 2.0 for enterprise — optional Phase 5)
- **Deliverable:** Complete enterprise admin suite for universities and bootcamps

### Phase 5: Revenue & Billing (Weeks 13-14)
- **Tasks:**
  - Implement subscription tiers (Free, Pro, Enterprise)
  - Add Stripe billing integration (metered billing for seats)
  - Build pricing page with tier comparison
  - Add usage limits enforcement (max users, max resumes, feature gates)
  - Create trial flow (14-day free trial for enterprise)
  - Build billing dashboard (usage, invoices, upgrade/downgrade)
- **Deliverable:** Self-serve billing and subscription management

### Phase 6: Advanced Enterprise (Weeks 15-16)
- **Tasks:**
  - Implement SAML 2.0 SSO (for enterprise customers)
  - Add API access (tenant-scoped API keys for integrations)
  - Build white-label browser extension (branded per tenant)
  - Add alumni network features (mentorship matching, referral tracking)
  - Implement advanced analytics (cohort comparison, year-over-year trends)
  - Add custom integrations (LMS, HRIS, CRM webhooks)
- **Deliverable:** Enterprise-grade platform ready for large institutions

---

## Revenue Model Recommendations

### B2C Pricing (Individual Job Seekers)

| Tier | Price | Features | Target |
|------|-------|----------|--------|
| **Free** | $0 | Resume optimizer (3/month), job search, basic profile, interview board | All job seekers |
| **Pro** | $9/mo | Unlimited resume optimization, cover letters, communication hub, interview prep, browser extension, career intelligence | Active job seekers |
| **Premium** | $19/mo | Everything in Pro + voice interview AI, predictive analytics, A/B testing, priority support | Serious job seekers |

### B2B Pricing (Institutions)

| Tier | Price | Features | Target |
|------|-------|----------|--------|
| **Starter** | $199/mo | 100 students, white-label, basic analytics, email support | Small bootcamps, coaching firms |
| **Growth** | $499/mo | 500 students, white-label, advanced analytics, employer portal, priority support | Mid-size bootcamps, universities |
| **Enterprise** | $1,999/mo | Unlimited students, full white-label, custom domain, SSO, API access, dedicated account manager | Large universities, outplacement firms |
| **Custom** | Contact us | Custom features, on-premise deployment, custom integrations, SLA | Corporate L&D, government |

### Revenue Projections (Conservative)

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| B2C Free Users | 10,000 | 50,000 | 200,000 |
| B2C Pro Users | 500 | 3,000 | 15,000 |
| B2C Premium Users | 100 | 500 | 2,000 |
| B2C MRR | $6,500 | $36,500 | $173,000 |
| B2B Institutions | 10 | 50 | 200 |
| B2B MRR | $3,000 | $25,000 | $100,000 |
| **Total MRR** | **$9,500** | **$61,500** | **$273,000** |
| **Total ARR** | **$114,000** | **$738,000** | **$3.28M** |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Multi-tenant migration breaks existing users** | Medium | Critical | Gradual migration; thorough testing; rollback plan; maintain backward compatibility |
| **RLS performance issues** | Medium | High | Composite indexes; query optimization; monitor query plans; add caching layer |
| **PWA iOS limitations** | High | Medium | Accept limitations; document workarounds; plan React Native for iOS-specific features |
| **Enterprise sales cycle too long** | Medium | High | Start with self-serve (credit card); add demo environment; case studies; free trial |
| **Tenant data leakage** | Low | Critical | RLS policies; regular audits; automated cross-tenant testing; security monitoring |
| **Push notification fatigue** | Medium | Medium | Smart notification logic (max 3/day); user preference controls; relevance scoring |
| **Custom domain complexity** | Medium | Medium | Automated DNS validation; SSL certificate management; support documentation |
| **SSO integration complexity** | Medium | High | Phase 5 feature; use established libraries (SAMLite); limit to Enterprise tier |
| **Competition from established players** | High | Medium | Differentiate on full-stack + local AI + analytics; price competitively; free tier |
| **On-premise deployment complexity** | Low | High | Docker Compose already supports this; document deployment guide; offer managed option |

---

## Recommended Next Steps

### Immediate (Week 1)
1. **Add tenant_id to all tables** — Start database migration with RLS policies
2. **Build tenant middleware** — Go chi middleware for subdomain/header extraction
3. **Create tenants table** — Store tenant metadata, branding, features
4. **Update all API queries** — Ensure tenant isolation

### Short-Term (Weeks 2-4)
5. **Build tenant admin API** — Create, update, manage tenants
6. **Implement TenantContext** — React context for dynamic theming
7. **Add feature flags** — Per-tenant feature enablement
8. **Build white-label branding settings** — Admin UI for logo, colors, CSS
9. **Test multi-tenant isolation** — Automated cross-tenant security tests

### Medium-Term (Weeks 5-8)
10. **Implement PWA** — Vite PWA plugin, Service Worker, manifest
11. **Build push notification system** — Web Push API backend + frontend hooks
12. **Add offline support** — Cache strategies, background sync, offline queue
13. **Optimize mobile UX** — Touch targets, mobile nav, responsive design
14. **Build career center dashboard** — Student overview, placement funnel, analytics

### Long-Term (Weeks 9-14)
15. **Implement bulk onboarding** — CSV upload, email invites, student provisioning
16. **Build employer portal** — Job posting, student search, interview scheduling
17. **Add reporting system** — PDF/CSV export, accreditation reports
18. **Implement Stripe billing** — Subscription tiers, seat-based pricing, invoices
19. **Add SSO (SAML 2.0)** — Enterprise authentication integration
20. **Build white-label browser extension** — Branded per tenant

---

## Verified Resources

- **Multi-Tenant SaaS on Postgres (2026):** https://clickhouse.com/resources/engineering/multi-tenant-saas-postgres-architecture — Comprehensive guide on RLS, tenant isolation, scaling
- **Multi-Tenant Architecture on AWS:** https://danguisinger.com/guides/multi-tenant-saas-architecture-aws/ — Data partitioning strategies, security models
- **Best SaaS Tech Stack 2026:** https://www.agilesoftlabs.com/blog/2026/03/best-saas-tech-stack-architecture-2026 — RLS implementation, multi-tenancy patterns
- **Building Multi-Tenant Go Apps:** https://atlasgo.io/blog/2025/05/26/gophercon-scalable-multi-tenant-apps-in-go — Go-specific multi-tenancy patterns
- **Multi-Tenant Deployment Guide:** https://qrvey.com/blog/multi-tenant-deployment/ — Step-by-step deployment guide
- **Vite PWA Plugin:** https://vite-pwa-org.netlify.app/ — PWA configuration for Vite/React
- **Web Push API:** https://developer.mozilla.org/en-US/docs/Web/API/Push_API — Browser push notification standards
- **webpush-go Library:** https://github.com/SherClockHolmes/webpush-go — Go Web Push implementation
- **JobWinner.ai:** https://jobwinner.ai/ — White-label career platform competitor
- **Rezi Enterprise:** https://rezi.io/ — Enterprise resume platform competitor
- **WriteSea:** https://writesea.com/ — White-label job search platform competitor
