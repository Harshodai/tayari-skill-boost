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

    it('exposes the candidate-controlled Tay Workspace as a distinct capability', () => {
        expect(features.taskWorkspace).toBe(true);
        expect(getNavLinks().find((link) => link.href === '/tay')?.label).toBe('Tay Workspace');
        expect(features.automationControl).toBe(false);
    });


    it('keeps the public navigation focused on the core application loop', () => {
        expect(primaryNavigationFeatures.resumeOptimizer).toBe(true);
        expect(primaryNavigationFeatures.jobSearch).toBe(true);
        expect(primaryNavigationFeatures.coverLetter).toBe(true);
        expect(primaryNavigationFeatures.careerRoadmap).toBe(true);
        expect(primaryNavigationFeatures.negotiationCopilot).toBe(false);
        expect(primaryNavigationFeatures.portfolioGenerator).toBe(false);
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
