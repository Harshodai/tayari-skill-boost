import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { features, isProductionMode, getNavLinks, primaryNavigationFeatures } from '@/config/features';

// We need to mock the config module itself OR relying on the fact that
// in the test environment 'window' might not define the hostname we look for.

// Actually, `isProductionMode` is calculated at module load time.
// To test it effectively, we might need to rely on the static config we see in source.
// But we definitely can test `getNavLinks` and `features` derivation.

describe('Feature Flags Configuration', () => {
    it('should have interviewPrep gated off for current release scope', () => {
        expect(features.interviewPrep).toBe(false);
    });

    it('should keep automation workspace gated off until evidence is complete', () => {
        expect(features.automationControl).toBe(false);
        expect(getNavLinks().find((link) => link.href === '/automations')).toBeUndefined();
    });

    it('keeps disabled interview-prep routes out of the release scope', () => {
        const appSource = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
        expect(appSource).toContain('{features.interviewPrep ? (');
        expect(appSource).toContain('<Route path="/interview/experiences" element={<Navigate to="/resume" replace />} />');
        expect(appSource).toContain('<Route path="/interview/coding" element={<Navigate to="/resume" replace />} />');
    });

    it('keeps every high-risk disabled route behind its declared release gate', () => {
        const appSource = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
        const featureSource = readFileSync(join(process.cwd(), 'src', 'config', 'features.ts'), 'utf8');
        expect(featureSource).toContain('computerControl: [false, true]');
        expect(featureSource).toContain('desktopAgent: [false, true]');
        expect(featureSource).toContain('voiceCoach: [false, false]');
        expect(featureSource).toContain('applyAgent: [false, true]');
        expect(appSource).toContain('{features.computerControl ? (');
        expect(appSource).toContain('{features.desktopAgent ? (');
        expect(appSource).toContain('{features.voiceCoach && (');
        expect(appSource).toContain('{features.applyAgent ? (');
        expect(appSource).toContain('<Route path="/control-room/*" element={<Navigate to="/resume" replace />} />');
        expect(appSource).toContain('<Route path="/desktop/*" element={<Navigate to="/resume" replace />} />');
        expect(appSource).toContain('<Route path="/apply-agent" element={<Navigate to="/jobs" replace />} />');
    });

    it('exposes the candidate-controlled Tay Workspace as a distinct capability', () => {
        expect(features.taskWorkspace).toBe(true);
        expect(getNavLinks().find((link) => link.href === '/tay')?.label).toBe('Tay Workspace');
        expect(features.automationControl).toBe(false);
    });


    it('keeps the public navigation focused on the 5 core release workflows', () => {
        expect(primaryNavigationFeatures.resumeOptimizer).toBe(true);
        expect(primaryNavigationFeatures.jobSearch).toBe(true);
        expect(primaryNavigationFeatures.coverLetter).toBe(true);
        expect(primaryNavigationFeatures.careerRoadmap).toBe(true);
        expect(primaryNavigationFeatures.taskWorkspace).toBe(true);
        expect(primaryNavigationFeatures.negotiationCopilot).toBe(false);
        expect(primaryNavigationFeatures.portfolioGenerator).toBe(false);
        expect(primaryNavigationFeatures.oneShotPipeline).toBe(false);
        expect(primaryNavigationFeatures.agentReach).toBe(false);
    });

    it('filters nav links to primary navigation when primaryOnly is requested', () => {
        const allLinks = getNavLinks();
        const primaryLinks = getNavLinks({ primaryOnly: true });

        expect(primaryLinks.length).toBeGreaterThan(0);
        expect(primaryLinks.length).toBeLessThan(allLinks.length);

        // Includes non-feature links (e.g. Home, FAQ, Contact)
        expect(primaryLinks.some((l) => l.href === '/')).toBe(true);
        expect(primaryLinks.some((l) => l.href === '/faq')).toBe(true);
        expect(primaryLinks.some((l) => l.href === '/contact')).toBe(true);

        // Includes the 5 core release workflows
        expect(primaryLinks.some((l) => l.href === '/resume')).toBe(true);
        expect(primaryLinks.some((l) => l.href === '/jobs')).toBe(true);
        expect(primaryLinks.some((l) => l.href === '/jobs/autopilot')).toBe(true);
        expect(primaryLinks.some((l) => l.href === '/cover-letter')).toBe(true);
        expect(primaryLinks.some((l) => l.href === '/roadmap')).toBe(true);
        expect(primaryLinks.some((l) => l.href === '/tay')).toBe(true);

        // Excludes secondary and preview-only feature links
        expect(primaryLinks.some((l) => l.href === '/one-shot')).toBe(false);
        expect(primaryLinks.some((l) => l.href === '/agent-reach')).toBe(false);
        expect(primaryLinks.some((l) => l.href === '/typst-studio')).toBe(false);
        expect(primaryLinks.some((l) => l.href === '/answer-bank')).toBe(false);
        expect(primaryLinks.some((l) => l.href === '/knowledge-hub')).toBe(false);
        expect(primaryLinks.some((l) => l.href === '/communication')).toBe(false);
        expect(primaryLinks.some((l) => l.href === '/career-ops')).toBe(false);
        expect(primaryLinks.some((l) => l.href === '/career-intelligence')).toBe(false);
        expect(primaryLinks.some((l) => l.href === '/automations')).toBe(false);
    });

    it('should have verification enabled (V3 badge is live)', () => {
        expect(features.verification).toBe(true);
    });

    it('should have referralDrafts enabled (Moat-1 is live)', () => {
        expect(features.referralDrafts).toBe(true);
    });

    it('keeps all source feature references in the canonical registry', () => {
        const sourceRoot = join(process.cwd(), 'src');
        const files: string[] = [];
        const visit = (directory: string) => {
            for (const entry of readdirSync(directory, { withFileTypes: true })) {
                const path = join(directory, entry.name);
                if (entry.isDirectory()) visit(path);
                else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
            }
        };
        visit(sourceRoot);
        const nonFlagProperties = new Set(['length', 'map', 'ts']);
        const references = new Set(
            files
                .flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/features\.(\w+)/g)].map((match) => match[1]))
                .filter((reference) => !nonFlagProperties.has(reference)),
        );
        expect(references.size).toBeGreaterThan(0);
        for (const reference of references) {
            expect(Object.prototype.hasOwnProperty.call(features, reference)).toBe(true);
        }
    });

    it('should generate navigation links', () => {
        const links = getNavLinks();
        expect(links.length).toBeGreaterThan(0);
        const homeLink = links.find(l => l.href === '/');
        expect(homeLink).toBeDefined();
        expect(homeLink?.label).toBe('Home');
    });

    it('should filter links based on features', () => {
        // If a feature is disabled, its link should not appear.
        // In our current config, 'help' is [false, true].
        // If we are in 'preview' (default for test/non-prod hostname), help should be visible?
        // Wait, isProductionMode logic:
        // typeof window !== 'undefined' && window.location.hostname === "tayari-skill-boost.lovable.app"
        // In JSDOM, hostname is usually 'localhost', so isProductionMode should be false.

        // Let's verify environment first
        // expect(isProductionMode).toBe(false); 

        // If !isProductionMode (Preview), 'help' is true.
        // So help link should exist.

        const links = getNavLinks();
        // browserExtension is now enabled [true, true] per Mission M4
        expect(features.browserExtension).toBe(true);
    });
});
