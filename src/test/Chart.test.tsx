import { render, screen } from '@testing-library/react';
import { Chart, DataPoint } from '@/components/charts/Chart';

const sampleData: DataPoint[] = [
  { name: 'Skill A', value: 10 },
  { name: 'Skill B', value: 20 },
];

test('renders chart with title and SVG element', () => {
  render(<Chart data={sampleData} title="Sample Chart" />);
  expect(screen.getByText(/Sample Chart/i)).toBeInTheDocument();
  // Recharts renders an SVG element for the chart
  const svg = document.querySelector('svg');
  expect(svg).toBeInTheDocument();
});
