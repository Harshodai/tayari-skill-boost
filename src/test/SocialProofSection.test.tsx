import { render, screen, waitFor } from '@testing-library/react';
import { SocialProofSection } from '@/components/landing/SocialProofSection';
import * as api from '@/api';
import React from 'react';

jest.mock('@/api', () => ({
  dashboardStats: jest.fn(),
}));

describe('SocialProofSection', () => {
  it('displays fetched stats', async () => {
    (api.dashboardStats as jest.Mock).mockResolvedValue({
      resumes_count: 123,
      profile_completion_pct: 85,
      applications_count: 10,
      interviews_count: 5,
    });
    render(<SocialProofSection />);
    await waitFor(() => expect(screen.getByText('123')).toBeInTheDocument());
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
