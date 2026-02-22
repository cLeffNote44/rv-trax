import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="my-custom">Content</Card>);
    expect(container.firstElementChild?.className).toContain('my-custom');
  });

  it('passes through HTML attributes', () => {
    render(<Card data-testid="test-card">Content</Card>);
    expect(screen.getByTestId('test-card')).toBeInTheDocument();
  });
});

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header text</CardHeader>);
    expect(screen.getByText('Header text')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<CardHeader className="px-8">Header</CardHeader>);
    expect(container.firstElementChild?.className).toContain('px-8');
  });
});

describe('CardTitle', () => {
  it('renders as h3', () => {
    render(<CardTitle>My Title</CardTitle>);
    const heading = screen.getByText('My Title');
    expect(heading.tagName).toBe('H3');
  });
});

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Body here</CardContent>);
    expect(screen.getByText('Body here')).toBeInTheDocument();
  });
});

describe('CardFooter', () => {
  it('renders children', () => {
    render(<CardFooter>Footer text</CardFooter>);
    expect(screen.getByText('Footer text')).toBeInTheDocument();
  });
});

describe('Card composition', () => {
  it('renders full card with all sub-components', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
        </CardHeader>
        <CardContent>Main content</CardContent>
        <CardFooter>Footer actions</CardFooter>
      </Card>,
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(screen.getByText('Footer actions')).toBeInTheDocument();
  });
});
