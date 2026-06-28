import { render, screen } from '@testing-library/react';
import { Chart, DataPoint } from '@/components/charts/Chart';

const sampleData: DataPoint[] = [
  { name: 'Skill A', value: 10 },
  { name: 'Skill B', value: 20 },
];

test('renders chart with title and SVG element', () => {
  render(<Chart data={sampleData} title="Sample Chart" />);
  // Verify the chart container role="img" with accessible name
  const chartImg = screen.getByRole('img', { name: /sample chart/i });
  expect(chartImg).toBeInTheDocument();
  // Recharts renders an SVG element for the chart content
  const svg = chartImg.querySelector('svg');
  expect(svg).toBeInTheDocument();
});
