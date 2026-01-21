import { expect } from "bun:test";
import * as matchers from "@testing-library/jest-dom/matchers";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
expect.extend(matchers);

// Mock window.scrollTo
global.scrollTo = () => { };
if (global.window) {
    Object.defineProperty(global.window, 'scrollTo', { value: () => { }, writable: true });
}

