import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResumeGraph from '@/pages/ResumeGraph';

// Mock the apiFetch function
jest.mock('@/api', () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from '@/api';

test('renders fetched resume graph visualization', async () => {
  const mockData = {
    nodes: [
      { id: '1', label: 'Node 1' },
      { id: '2', label: 'Node 2' },
    ],
    links: [{ source: '1', target: '2' }],
  };
  (apiFetch as jest.Mock).mockResolvedValue(mockData);

  render(
    <MemoryRouter initialEntries={['/resume-graph?runId=123']}>
      <Routes>
        <Route path="/resume-graph" element={<ResumeGraph />} />
      </Routes>
    </MemoryRouter>
  );

  // Loading state should appear initially
  expect(screen.getByRole('status')).toBeInTheDocument();

  // Wait for the visualization (role img) to appear
  const viz = await screen.findByRole('img', { name: /resume knowledge graph/i });
  expect(viz).toBeInTheDocument();

  // Verify that node labels are rendered (as text within the SVG)
  expect(screen.getByText('Node 1')).toBeInTheDocument();
  expect(screen.getByText('Node 2')).toBeInTheDocument();
});
