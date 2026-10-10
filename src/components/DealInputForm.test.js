// The company search offers fictional companies with made-up financials.
// In a real account, picking one would fill a real deal with invented
// numbers, so they are offered only in the demo. The firm's own pipeline is
// searchable in both.

import { render, screen, fireEvent, within } from '@testing-library/react';
import DealInputForm from './DealInputForm';
import { TutorialProvider } from '../contexts/TutorialContext';
import { getModule, getAvailableModules } from '../modules';

let mockDemo = false;
jest.mock('../lib/demoMode', () => ({ isDemoMode: () => mockDemo }));

const mod = getModule('equipment_finance');

function renderForm(pipelineDeals = []) {
  render(
    <TutorialProvider userId={null}>
    <DealInputForm
      inputs={mod.INITIAL_INPUTS}
      onChange={() => {}}
      schema={mod.FORM_SCHEMA}
      modules={getAvailableModules()}
      activeModule="equipment_finance"
      onModuleChange={() => {}}
      pipelineDeals={pipelineDeals}
      sofr={0.0389}
    />
    </TutorialProvider>,
  );
  const box = screen.getByPlaceholderText('Search or enter company name...');
  fireEvent.focus(box);
  fireEvent.change(box, { target: { value: 'Midwest' } });
}

test('a real account is not offered the fictional company database', () => {
  mockDemo = false;
  renderForm();
  // Midwest Precision Machining Inc. is a static sample profile.
  expect(screen.queryByText(/Midwest Precision Machining/)).not.toBeInTheDocument();
});

test('a real account still finds its own pipeline deals', () => {
  mockDemo = false;
  renderForm([{ name: 'Midwest Dairy Co-op', inputs: { companyName: 'Midwest Dairy Co-op', annualRevenue: 1 } }]);
  expect(screen.getByText('Midwest Dairy Co-op')).toBeInTheDocument();
});

test('the demo keeps the sample companies', () => {
  mockDemo = true;
  renderForm();
  expect(screen.getByText(/Midwest Precision Machining/)).toBeInTheDocument();
});

// Cash-flow inputs must tell "not provided" from 0. Every other number on
// the form stores a blank as 0, which is why these use their own field type.
describe('cash-flow inputs keep blank as blank', () => {
  function setup(inputs = mod.INITIAL_INPUTS) {
    const onChange = jest.fn();
    render(
      <TutorialProvider userId={null}>
      <DealInputForm
        inputs={inputs}
        onChange={onChange}
        schema={mod.FORM_SCHEMA}
        modules={getAvailableModules()}
        activeModule="equipment_finance"
        onModuleChange={() => {}}
        pipelineDeals={[]}
        sofr={0.0389}
      />
      </TutorialProvider>,
    );
    const inputFor = (label) => {
      let el = screen.getByText(label);
      while (el && !el.querySelector('input')) el = el.parentElement;
      return el.querySelector('input');
    };
    return { onChange, inputFor };
  }

  test('new deals start with every cash-flow input blank, not 0', () => {
    expect(mod.INITIAL_INPUTS.cashTaxes).toBeNull();
    expect(mod.INITIAL_INPUTS.leasePayments).toBeNull();
    const { inputFor } = setup();
    expect(inputFor('Cash Taxes').value).toBe('');
  });

  test('an entered 0 is stored as 0', () => {
    const { onChange, inputFor } = setup();
    fireEvent.change(inputFor('Rent & Lease Payments'), { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ leasePayments: 0 }));
  });

  test('clearing a field stores null', () => {
    const { onChange, inputFor } = setup({ ...mod.INITIAL_INPUTS, cashTaxes: 400000 });
    fireEvent.change(inputFor('Cash Taxes'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ cashTaxes: null }));
  });

  test('working capital accepts a negative (cash released)', () => {
    const { onChange, inputFor } = setup();
    fireEvent.change(inputFor('Increase in Working Capital'), { target: { value: '-250,000' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ workingCapitalIncrease: -250000 }));
  });

  test('taxes do not accept a negative', () => {
    const { onChange, inputFor } = setup();
    fireEvent.change(inputFor('Cash Taxes'), { target: { value: '-5' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ cashTaxes: 5 }));
  });
});

// Statement line items build some Borrower Profile fields. A built field is
// read-only: fix the line, or override it with a reason.
describe('fields built from statements', () => {
  const M = 1_000_000;
  const withStatements = {
    ...mod.INITIAL_INPUTS,
    financials: {
      fiscalYearEnd: '2025-12-31',
      lineItems: {
        revenue: { value: 100 * M },
        operatingIncome: { value: 10 * M, source: { document: '10-K', page: 54 } },
        depreciationAmortization: { value: 5 * M },
      },
    },
  };

  function setup(inputs) {
    const onChange = jest.fn();
    render(
      <TutorialProvider userId={null}>
      <DealInputForm
        inputs={inputs}
        onChange={onChange}
        schema={mod.FORM_SCHEMA}
        modules={getAvailableModules()}
        activeModule="equipment_finance"
        onModuleChange={() => {}}
        pipelineDeals={[]}
        sofr={0.0389}
        analystName="J. Peter"
      />
      </TutorialProvider>,
    );
    return { onChange };
  }

  test('no statements: an Add statements prompt, every field typed', () => {
    const { onChange } = setup(mod.INITIAL_INPUTS);
    expect(screen.queryByTestId('built-badge')).toBeNull();
    fireEvent.click(screen.getByText('Add statements'));
    expect(onChange.mock.calls[0][0].financials).toEqual({ fiscalYearEnd: '', lineItems: {} });
  });

  test('built fields show the value, a Built badge and the formula with its source', () => {
    setup(withStatements);
    expect(screen.getAllByTestId('built-badge').length).toBe(3);   // revenue, EBITDA, maintenance capex
    expect(screen.getByText('$15,000,000')).toBeInTheDocument();
    expect(screen.getAllByText(/Operating income \$10\.0M \(10-K, p\. 54\) \+ Depreciation and amortization \$5\.0M/).length).toBeGreaterThan(0);
  });

  test('override needs a reason and records it', () => {
    const { onChange } = setup(withStatements);
    // Fields in schema order: revenue, EBITDA, maintenance capex.
    fireEvent.click(screen.getAllByText('Override')[1]);
    const confirmBtn = screen.getAllByRole('button', { name: 'Override' }).find((b) => b.disabled);
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Reason to override/), { target: { value: 'Run-rate after closure' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Override' }).find((b) => !b.disabled && b.className.includes('bg-gray-900')));
    const next = onChange.mock.calls[0][0];
    expect(next.financials.fieldOverrides.ebitda).toMatchObject({ reason: 'Run-rate after closure', by: 'J. Peter' });
  });

  test('typing a line item updates the statements', () => {
    const { onChange } = setup(withStatements);
    fireEvent.change(screen.getByLabelText('Cash interest paid'), { target: { value: '2000000' } });
    expect(onChange.mock.calls[0][0].financials.lineItems.interestPaid).toEqual({ value: 2 * M, origin: 'typed' });
  });
});

describe('judgments on the statement build', () => {
  const M = 1_000_000;
  const dealer = {
    ...mod.INITIAL_INPUTS,
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
  function setup(inputs) {
    const onChange = jest.fn();
    render(
      <TutorialProvider userId={null}>
      <DealInputForm inputs={inputs} onChange={onChange} schema={mod.FORM_SCHEMA} modules={getAvailableModules()}
        activeModule="equipment_finance" onModuleChange={() => {}} pipelineDeals={[]} sofr={0.0389} analystName="J. Peter" />
      </TutorialProvider>,
    );
    return { onChange };
  }
  const row = (id) => within(screen.getByTestId(`judgment-${id}`));

  test('lists proposals, none confirmed yet', () => {
    setup(dealer);
    expect(screen.getByText(/^0 of \d+ confirmed$/)).toBeInTheDocument();
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
});

describe('company EBITDA and the add-back bridge', () => {
  const M = 1_000_000;
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
  function setup(inputs) {
    const onChange = jest.fn();
    render(
      <TutorialProvider userId={null}>
      <DealInputForm inputs={inputs} onChange={onChange} schema={mod.FORM_SCHEMA} modules={getAvailableModules()}
        activeModule="equipment_finance" onModuleChange={() => {}} pipelineDeals={[]} sofr={0.0389} />
      </TutorialProvider>,
    );
    return { onChange };
  }

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
