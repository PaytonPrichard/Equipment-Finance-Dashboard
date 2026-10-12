// The full-width statements view. Judgment, rebuild and EBITDA-bridge tests
// moved here from DealInputForm.test.js when the panel left the form
// (2026-10-12); what they check is unchanged. New here: every judgment sits
// next to the line or item it is about.

import { render, screen, fireEvent, within } from '@testing-library/react';
import StatementsWorkspace, { anchorFor } from './StatementsWorkspace';
import { getModule } from '../modules';

const mod = getModule('equipment_finance');
const M = 1_000_000;

function setup(inputs, { treatmentRules, analystName = 'J. Peter' } = {}) {
  const onChange = jest.fn();
  const onClose = jest.fn();
  render(
    <StatementsWorkspace inputs={inputs} onChange={onChange} treatmentRules={treatmentRules} analystName={analystName} onClose={onClose} />,
  );
  return { onChange, onClose };
}

const dealer = {
  ...mod.INITIAL_INPUTS,
  companyName: 'Dealer Co',
  financials: {
    fiscalYearEnd: '2025-12-31',
    lineItems: {
      revenue: { value: 100 * M },
      operatingIncome: { value: 10 * M },
      depreciationAmortization: { value: 5 * M },
      floorplanInterest: { value: 2 * M },
      floorplanPayable: { value: 30 * M },
    },
  },
};
const row = (id) => within(screen.getByTestId(`judgment-${id}`));

describe('layout', () => {
  test('three statements side by side, and the floorplan lines together in one block', () => {
    setup(dealer);
    expect(screen.getByText('Income statement')).toBeInTheDocument();
    expect(screen.getByText('Cash flow statement')).toBeInTheDocument();
    expect(screen.getByText('Balance sheet and debt note')).toBeInTheDocument();
    const block = within(screen.getByTestId('item-floorplan'));
    expect(block.getByTestId('line-floorplanInterest')).toBeInTheDocument();
    expect(block.getByTestId('line-floorplanPayable')).toBeInTheDocument();
  });

  test('each judgment sits with what it is about', () => {
    setup(dealer);
    const block = within(screen.getByTestId('item-floorplan'));
    expect(block.getByTestId('judgment-treatment.floorplan')).toBeInTheDocument();
    expect(block.getByTestId('judgment-floorplanInterestPlacement')).toBeInTheDocument();
    expect(block.getByTestId('judgment-floorplanInterestInInterestPaid')).toBeInTheDocument();
    // Next to the capex line, not in a separate list.
    expect(screen.getByTestId('line-capitalExpenditures').parentElement).toContainElement(screen.getByTestId('judgment-maintenanceCapex'));
  });

  test('every judgment id the build asks has a place', () => {
    for (const id of ['fiscalYear', 'ebitdaStart', 'floorplanPresent', 'captiveFleetPresent', 'financeLeasesPresent',
      'treatment.floorplan', 'treatment.captiveFleet', 'treatment.financeLeases', 'treatment.operatingLeases',
      'floorplanInterestPlacement', 'floorplanInterestInInterestPaid', 'vehicleInterestPlacement', 'vehicleInterestInInterestPaid',
      'currentMaturitiesInclude.floorplan', 'currentMaturitiesInclude.vehicleDebt', 'currentMaturitiesInclude.financeLeases',
      'maintenanceCapex', 'ebitdaSource', 'companyBasis.adjusted.floorplan']) {
      expect([id, anchorFor(id)]).not.toEqual([id, 'other']);
    }
  });

  test('typing a line item updates the statements', () => {
    const { onChange } = setup(dealer);
    fireEvent.change(screen.getByLabelText('Cash interest paid'), { target: { value: '2000000' } });
    expect(onChange.mock.calls[0][0].financials.lineItems.interestPaid).toEqual({ value: 2 * M, origin: 'typed' });
  });

  test('the bar shows what is built and how many are confirmed, and Back to deal closes', () => {
    const { onClose } = setup(dealer);
    const bar = within(screen.getByTestId('statements-bar'));
    expect(bar.getByText('$13.0M')).toBeInTheDocument();
    expect(bar.getByText(/^0 of \d+ confirmed$/)).toBeInTheDocument();
    fireEvent.click(bar.getByRole('button', { name: 'Back to deal' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('judgments on the statement build', () => {
  test('lists proposals, none confirmed yet', () => {
    setup(dealer);
    expect(screen.getByTestId('judgment-floorplanPresent')).toHaveTextContent('Floorplan financing present');
  });

  test('Confirm accepts the proposal, with who', () => {
    const { onChange } = setup(dealer);
    fireEvent.click(row('fiscalYear').getByRole('button', { name: 'Confirm' }));
    expect(onChange.mock.calls[0][0].financials.judgments.fiscalYear).toMatchObject({ confirmed: '2025-12-31', by: 'J. Peter' });
  });

  test('picking another option confirms that one', () => {
    const { onChange } = setup(dealer);
    fireEvent.click(row('floorplanInterestPlacement').getByRole('button', { name: 'Inside operating expenses' }));
    expect(onChange.mock.calls[0][0].financials.judgments.floorplanInterestPlacement.confirmed).toBe('operatingExpenses');
  });

  test('a treatment override needs a reason and is recorded', () => {
    const { onChange } = setup(dealer);
    fireEvent.click(screen.getByText('Override for this deal'));
    fireEvent.change(screen.getByLabelText('Reason to override Floorplan (dealers)'), { target: { value: 'Credit agreement counts it as debt' } });
    fireEvent.click(row('treatment.floorplan').getByRole('button', { name: 'Override' }));
    expect(onChange.mock.calls[0][0].financials.treatmentOverrides.floorplan).toMatchObject({ rule: 'in', reason: 'Credit agreement counts it as debt', by: 'J. Peter' });
  });

  describe('firm rules changed since the deal was saved', () => {
    const saved = {
      ...dealer,
      financials: {
        ...dealer.financials,
        firmRules: { financeLeases: 'in', operatingLeases: 'out', floorplan: 'out', captiveFleet: 'corporate', ebitdaGapTolerance: 0.05 },
        judgments: { 'treatment.floorplan': { proposed: 'out', confirmed: 'out', by: 'J. Peter', at: '2026-10-01' } },
      },
    };

    test('names what changed and offers the rebuild, at the top', () => {
      setup(saved, { treatmentRules: { floorplan: 'in' } });
      const box = within(screen.getByTestId('rules-changed'));
      expect(box.getByText('Floorplan (dealers): Inventory financing to Debt')).toBeInTheDocument();
      expect(box.getByRole('button', { name: 'Rebuild with current firm rules' })).toBeInTheDocument();
    });

    test('rebuild takes the new rules and puts the changed row back to pending', () => {
      const { onChange } = setup(saved, { treatmentRules: { floorplan: 'in' } });
      fireEvent.click(screen.getByRole('button', { name: 'Rebuild with current firm rules' }));
      const next = onChange.mock.calls[0][0];
      expect(next.financials.firmRules.floorplan).toBe('in');
      expect(next.financials.judgments['treatment.floorplan']).toBeUndefined();
      expect(next.financials.rulesRebuilt).toMatchObject({ by: 'J. Peter', changed: ['floorplan'] });
      // The prompt goes on the click, before the parent's rerender lands.
      expect(screen.queryByTestId('rules-changed')).toBeNull();
      expect(screen.getByText('Rebuilding with current firm rules...')).toBeInTheDocument();
    });

    test('rules unchanged: no notice', () => {
      setup(saved, { treatmentRules: { floorplan: 'out' } });
      expect(screen.queryByTestId('rules-changed')).toBeNull();
    });
  });
});

describe('company EBITDA and the add-back bridge', () => {
  const base = {
    ...mod.INITIAL_INPUTS,
    financials: {
      fiscalYearEnd: '2025-12-31',
      lineItems: { revenue: { value: 100 * M }, operatingIncome: { value: 10 * M }, depreciationAmortization: { value: 5 * M } },
      adjustedEbitda: {
        value: 19 * M,
        label: 'Adjusted EBITDA',
        addBacks: [
          { label: 'Stock comp', amount: 1.5 * M, decision: 'accepted' },
          { label: 'Restructuring', amount: 1.5 * M, decision: null },
        ],
      },
    },
  };

  test('the comparison splits the gap and prints the policy', () => {
    setup(base);
    const c = within(screen.getByTestId('comparison-adjusted'));
    expect(c.getByText('Built EBITDA')).toBeInTheDocument();
    expect(c.getByText('$4.0M')).toBeInTheDocument();                 // gap 19 - 15
    expect(c.getByText('$1.0M, 6.7% of built')).toBeInTheDocument();  // unexplained 4 - 3 listed
    expect(c.getByText('Caveat above 5%, your policy. Over it.')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 reviewed')).toBeInTheDocument();
  });

  test('accepting an add-back records the decision', () => {
    const { onChange } = setup(base);
    fireEvent.click(within(screen.getByTestId('addback-1')).getByRole('button', { name: 'Accept' }));
    expect(onChange.mock.calls[0][0].financials.adjustedEbitda.addBacks[1].decision).toBe('accepted');
  });

  test('adding a bridge line starts it blank and undecided', () => {
    const { onChange } = setup(base);
    fireEvent.click(screen.getByText('Add a line'));
    expect(onChange.mock.calls[0][0].financials.adjustedEbitda.addBacks[2]).toEqual({ label: '', amount: null, decision: null });
  });
});
