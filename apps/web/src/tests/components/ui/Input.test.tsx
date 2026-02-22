import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('renders with a label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders without a label', () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument();
  });

  it('generates id from label', () => {
    render(<Input label="Full Name" />);
    const input = screen.getByLabelText('Full Name');
    expect(input.id).toBe('full-name');
  });

  it('uses provided id over generated', () => {
    render(<Input label="Email" id="custom-id" />);
    const input = screen.getByLabelText('Email');
    expect(input.id).toBe('custom-id');
  });

  it('displays error message', () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
  });

  it('sets aria-invalid when error is present', () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not set aria-invalid without error', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });

  it('displays hint text', () => {
    render(<Input label="Email" hint="We'll never share your email" />);
    expect(screen.getByText("We'll never share your email")).toBeInTheDocument();
  });

  it('shows error over hint when both present', () => {
    render(<Input label="Email" hint="Hint text" error="Error text" />);
    expect(screen.getByText('Error text')).toBeInTheDocument();
    expect(screen.queryByText('Hint text')).not.toBeInTheDocument();
  });

  it('accepts user input', async () => {
    const user = userEvent.setup();
    render(<Input label="Name" />);
    const input = screen.getByLabelText('Name');

    await user.type(input, 'John');
    expect(input).toHaveValue('John');
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Input label="Test" ref={ref} />);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0]?.[0]).toBeInstanceOf(HTMLInputElement);
  });

  it('passes through HTML attributes', () => {
    render(<Input label="Email" type="email" autoComplete="email" data-testid="email-input" />);
    const input = screen.getByTestId('email-input');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autoComplete', 'email');
  });

  it('can be disabled', () => {
    render(<Input label="Email" disabled />);
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });
});
