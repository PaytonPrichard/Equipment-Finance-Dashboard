import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TreatmentRulesCard from './TreatmentRulesCard';
import { DEFAULT_TREATMENT_RULES } from '../lib/borrowerBuild';

describe('TreatmentRulesCard', () => {
  test('read-only for analysts: inputs disabled, no save button', () => {
    render(<TreatmentRulesCard rules={{ floorplan: 'in' }} editable={false} onSave={jest.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(8);
    radios.forEach((r) => expect(r).toBeDisabled());
    expect(screen.getByLabelText(/EBITDA gap tolerance/)).toBeDisabled();
    expect(screen.queryByText('Save treatment rules')).toBeNull();
    expect(screen.getByText("Set by your firm's admin.")).toBeInTheDocument();
  });

  test('shows the firm rule, defaults where unset or invalid', () => {
    render(<TreatmentRulesCard rules={{ floorplan: 'in', captiveFleet: 'bogus' }} editable={false} onSave={jest.fn()} />);
    const checked = screen.getAllByRole('radio').filter((r) => r.checked).map((r) => `${r.name}=${r.value}`);
    expect(checked).toEqual([
      'treatment-financeLeases=in',
      'treatment-operatingLeases=out',
      'treatment-floorplan=in',
      'treatment-captiveFleet=corporate',
    ]);
    expect(screen.getByLabelText(/EBITDA gap tolerance/)).toHaveValue(5);
  });

  test('admin save sends validated rules and shows the saved-deals notice', async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    render(<TreatmentRulesCard rules={undefined} editable onSave={onSave} />);
    const save = screen.getByText('Save treatment rules');
    expect(save).toBeDisabled();

    fireEvent.click(screen.getAllByRole('radio').find((r) => r.name === 'treatment-floorplan' && r.value === 'in'));
    fireEvent.change(screen.getByLabelText(/EBITDA gap tolerance/), { target: { value: '7.5' } });
    fireEvent.click(save);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...DEFAULT_TREATMENT_RULES, floorplan: 'in', ebitdaGapTolerance: 0.075 }));
    expect(await screen.findByRole('status')).toHaveTextContent('Deals already saved keep the rules they were built with.');
  });

  test('failed save shows no notice', async () => {
    const onSave = jest.fn().mockResolvedValue(false);
    render(<TreatmentRulesCard rules={undefined} editable onSave={onSave} />);
    fireEvent.click(screen.getAllByRole('radio').find((r) => r.name === 'treatment-captiveFleet' && r.value === 'consolidated'));
    fireEvent.click(screen.getByText('Save treatment rules'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
  });
});
