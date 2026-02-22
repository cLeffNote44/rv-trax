import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from '@/components/ui/Select';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  ChevronDown: (props: any) => <svg data-testid="chevron-icon" {...props} />,
}));

const options = [
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
];

describe('Select', () => {
  it('renders with a label', () => {
    render(<Select label="Plan" options={options} />);
    expect(screen.getByLabelText('Plan')).toBeInTheDocument();
  });

  it('renders all options', () => {
    const { container } = render(<Select label="Tier" options={options} />);
    const select = container.querySelector('select')!;
    const opts = select.querySelectorAll('option');
    expect(opts).toHaveLength(3);
    expect(opts[0]!.textContent).toBe('Starter');
    expect(opts[1]!.textContent).toBe('Professional');
    expect(opts[2]!.textContent).toBe('Enterprise');
  });

  it('renders placeholder option when provided', () => {
    const { container } = render(<Select label="Tier" options={options} placeholder="Select a plan" />);
    const select = container.querySelector('select')!;
    const opts = select.querySelectorAll('option');
    expect(opts).toHaveLength(4);
    expect(opts[0]!.textContent).toBe('Select a plan');
    expect(opts[0]!).toBeDisabled();
  });

  it('generates id from label', () => {
    render(<Select label="Subscription Tier" options={options} />);
    const select = screen.getByLabelText('Subscription Tier');
    expect(select.id).toBe('subscription-tier');
  });

  it('uses provided id', () => {
    render(<Select label="My Plan" id="my-select" options={options} />);
    expect(screen.getByLabelText('My Plan').id).toBe('my-select');
  });

  it('displays error message', () => {
    render(<Select label="Role" options={options} error="Selection required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Selection required');
  });

  it('sets aria-invalid when error is present', () => {
    render(<Select label="Category" options={options} error="Required" />);
    expect(screen.getByLabelText('Category')).toHaveAttribute('aria-invalid', 'true');
  });

  it('displays hint text', () => {
    render(<Select label="Size" options={options} hint="Choose wisely" />);
    expect(screen.getByText('Choose wisely')).toBeInTheDocument();
  });

  it('shows error over hint', () => {
    render(<Select label="Level" options={options} hint="Hint" error="Error" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Hint')).not.toBeInTheDocument();
  });

  it('allows selection change', async () => {
    const user = userEvent.setup();
    render(<Select label="Option" options={options} defaultValue="starter" />);
    const select = screen.getByLabelText('Option');

    await user.selectOptions(select, 'enterprise');
    expect(select).toHaveValue('enterprise');
  });

  it('can be disabled', () => {
    render(<Select label="Disabled Select" options={options} disabled />);
    expect(screen.getByLabelText('Disabled Select')).toBeDisabled();
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Select label="Ref Test" options={options} ref={ref} />);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0]?.[0]).toBeInstanceOf(HTMLSelectElement);
  });
});
