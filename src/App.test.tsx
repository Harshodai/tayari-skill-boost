import { describe, it, expect } from "bun:test";
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Component', () => {
    it('renders without crashing', () => {
        // App uses Routes, AuthProvider etc. `render` will mount it.
        // Note: We might need to mock some contexts if they are strict, 
        // but AuthProvider usually has a default state.
        // QueryClientProvider is also in App.

        // Attempt to render
        // We are just smoke testing. if it throws, test fails.
        const { container } = render(<App />);
        expect(container).toBeDefined();
    });
});
