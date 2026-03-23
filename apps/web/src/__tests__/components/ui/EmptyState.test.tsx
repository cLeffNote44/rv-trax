import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Package, Plus } from 'lucide-react';

describe('EmptyState', () => {
  it('renders icon, title, and description', () => {
    render(
      <EmptyState
        icon={Package}
        title="No units found"
        description="Add your first unit to get started"
      />,
    );

    expect(screen.getByText('No units found')).toBeDefined();
    expect(screen.getByText('Add your first unit to get started')).toBeDefined();
  });

  it('renders the icon as an SVG element', () => {
    const { container } = render(<EmptyState icon={Package} title="Empty" />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('renders action button and calls onClick', () => {
    const onClick = vi.fn();
    render(<EmptyState icon={Package} title="No units" action={{ label: 'Add Unit', onClick }} />);

    const button = screen.getByText('Add Unit');
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders without optional description', () => {
    render(<EmptyState icon={Package} title="Nothing here" />);

    expect(screen.getByText('Nothing here')).toBeDefined();
    // No description should be rendered
    expect(screen.queryByText('Add your first unit')).toBeNull();
  });

  it('renders without optional action', () => {
    render(<EmptyState icon={Package} title="No data" description="Check back later" />);

    // No button should be present
    const buttons = screen.queryAllByRole('button');
    expect(buttons.length).toBe(0);
  });

  it('renders children', () => {
    render(
      <EmptyState icon={Plus} title="Custom">
        <p>Extra content below</p>
      </EmptyState>,
    );

    expect(screen.getByText('Extra content below')).toBeDefined();
  });

  it('applies additional className', () => {
    const { container } = render(<EmptyState icon={Package} title="Test" className="mt-8" />);

    const wrapper = container.firstElementChild!;
    expect(wrapper.className).toContain('mt-8');
  });
});
