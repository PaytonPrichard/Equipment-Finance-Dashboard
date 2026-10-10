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

  describe('bulk rebuild (admin)', () => {
    const preview = (count) => jest.fn(async () => ({ data: { count, deals: [] }, error: null }));

    test('hidden without the handlers', () => {
      render(<TreatmentRulesCard rules={undefined} editable onSave={jest.fn()} />);
      expect(screen.queryByTestId('rules-rebuild')).toBeNull();
    });

    test('shows the count of open deals on older rules', async () => {
      render(<TreatmentRulesCard rules={undefined} editable onSave={jest.fn()} onPreviewRebuild={preview(3)} onRebuild={jest.fn()} />);
      expect(await screen.findByText('3 deals in Screening or Under Review use older rules.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rebuild 3 deals with current rules' })).toBeInTheDocument();
    });

    test('none on older rules: says so, no button', async () => {
      render(<TreatmentRulesCard rules={undefined} editable onSave={jest.fn()} onPreviewRebuild={preview(0)} onRebuild={jest.fn()} />);
      expect(await screen.findByText(/Every deal in Screening or Under Review uses the current rules/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Rebuild/ })).toBeNull();
    });

    test('asks first, then lists what it skipped', async () => {
      const spy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      const onRebuild = jest.fn(async () => ({
        data: { rebuilt: [{ id: 'a' }], skipped: [{ id: 'b', name: 'Wabash', reason: 'Does not pass validation under the new rules.' }] },
        error: null,
      }));
      const onPreview = jest.fn()
        .mockResolvedValueOnce({ data: { count: 2, deals: [] }, error: null })
        .mockResolvedValue({ data: { count: 1, deals: [] }, error: null });
      render(<TreatmentRulesCard rules={undefined} editable onSave={jest.fn()} onPreviewRebuild={onPreview} onRebuild={onRebuild} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Rebuild 2 deals with current rules' }));
      await waitFor(() => expect(onRebuild).toHaveBeenCalled());
      expect(spy.mock.calls[0][0]).toMatch(/Approved and Funded deals keep their rules/);
      expect(await screen.findByText(/Rebuilt 1 deal\. Skipped 1, still on older rules:/)).toBeInTheDocument();
      expect(screen.getByText('Wabash: Does not pass validation under the new rules.')).toBeInTheDocument();
      spy.mockRestore();
    });

    test('declining the dialog runs nothing', async () => {
      const spy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      const onRebuild = jest.fn();
      render(<TreatmentRulesCard rules={undefined} editable onSave={jest.fn()} onPreviewRebuild={preview(2)} onRebuild={onRebuild} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Rebuild 2 deals with current rules' }));
      await waitFor(() => expect(spy).toHaveBeenCalled());
      expect(onRebuild).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
