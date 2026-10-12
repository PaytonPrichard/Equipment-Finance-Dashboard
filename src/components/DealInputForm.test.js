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
    // Cash-flow inputs sit in the optional group, closed on a blank deal.
    const toggle = screen.getByRole('button', { name: /More inputs/ });
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
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

  describe('firm rules changed since the deal was saved', () => {
    const saved = {
      ...dealer,
      financials: {
        ...dealer.financials,
        firmRules: { financeLeases: 'in', operatingLeases: 'out', floorplan: 'out', captiveFleet: 'corporate', ebitdaGapTolerance: 0.05 },
        judgments: { 'treatment.floorplan': { proposed: 'out', confirmed: 'out', by: 'J. Peter', at: '2026-10-01' } },
      },
    };
    function setupWith(inputs, treatmentRules) {
      const onChange = jest.fn();
      render(
        <TutorialProvider userId={null}>
        <DealInputForm inputs={inputs} onChange={onChange} schema={mod.FORM_SCHEMA} modules={getAvailableModules()}
          activeModule="equipment_finance" onModuleChange={() => {}} pipelineDeals={[]} sofr={0.0389} analystName="J. Peter"
          treatmentRules={treatmentRules} />
        </TutorialProvider>,
      );
      return { onChange };
    }

    test('names what changed and offers the rebuild', () => {
      setupWith(saved, { floorplan: 'in' });
      const box = within(screen.getByTestId('rules-changed'));
      expect(box.getByText('Floorplan (dealers): Inventory financing to Debt')).toBeInTheDocument();
      expect(box.getByRole('button', { name: 'Rebuild with current firm rules' })).toBeInTheDocument();
    });

    test('rebuild takes the new rules and puts the changed row back to pending', () => {
      const { onChange } = setupWith(saved, { floorplan: 'in' });
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
      setupWith(saved, { floorplan: 'out' });
      expect(screen.queryByTestId('rules-changed')).toBeNull();
    });
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

// A required field went from "missing" (wrapped, with a badge) to filled
// (bare) on the first keystroke. The tree changed, React remounted the input,
// and the cursor left the box.
test('typing the first digit of a required field keeps the same input', () => {
  mockDemo = false;
  const Harness = () => {
    const [inputs, setInputs] = require('react').useState({ ...mod.INITIAL_INPUTS, annualRevenue: 0 });
    return (
      <TutorialProvider userId={null}>
        <DealInputForm
          inputs={inputs}
          onChange={setInputs}
          schema={mod.FORM_SCHEMA}
          modules={getAvailableModules()}
          activeModule="equipment_finance"
          onModuleChange={() => {}}
          pipelineDeals={[]}
          sofr={0.0389}
        />
      </TutorialProvider>
    );
  };
  render(<Harness />);
  const before = screen.getByPlaceholderText('50,000,000');
  fireEvent.change(before, { target: { value: '1' } });
  const after = screen.getByPlaceholderText('50,000,000');
  expect(after).toBe(before);
});

describe('optional borrower inputs', () => {
  function renderWith(inputs) {
    render(
      <TutorialProvider userId={null}>
        <DealInputForm
          inputs={inputs}
          onChange={() => {}}
          schema={mod.FORM_SCHEMA}
          modules={getAvailableModules()}
          activeModule="equipment_finance"
          onModuleChange={() => {}}
          pipelineDeals={[]}
          sofr={0.0389}
        />
      </TutorialProvider>,
    );
  }

  test('start closed on a blank deal and say what they add', () => {
    renderWith(mod.INITIAL_INPUTS);
    const toggle = screen.getByRole('button', { name: /More inputs/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('9 fields');
    expect(toggle).toHaveTextContent(/trend, cash-flow coverage, rate shock, liquidity/);
    expect(screen.queryByText('Cash Taxes')).not.toBeInTheDocument();
    // Core inputs stay in view.
    expect(screen.getByText('Existing Debt')).toBeInTheDocument();
    expect(screen.getByText('Actual Annual DS')).toBeInTheDocument();
  });

  test('open by themselves when one holds a value, so no number is out of sight', () => {
    renderWith({ ...mod.INITIAL_INPUTS, cashTaxes: 400000 });
    const toggle = screen.getByRole('button', { name: /More inputs/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('1 of 9 filled');
    expect(screen.getByText('Cash Taxes')).toBeInTheDocument();
  });
});

test('a missing badge waits until the analyst leaves the field empty', () => {
  mockDemo = false;
  render(
    <TutorialProvider userId={null}>
      <DealInputForm
        inputs={{ ...mod.INITIAL_INPUTS, annualRevenue: 0, ebitda: 0 }}
        onChange={() => {}}
        schema={mod.FORM_SCHEMA}
        modules={getAvailableModules()}
        activeModule="equipment_finance"
        onModuleChange={() => {}}
        pipelineDeals={[]}
        sofr={0.0389}
      />
    </TutorialProvider>,
  );
  expect(screen.queryByText('Missing, required for screening')).not.toBeInTheDocument();
  fireEvent.blur(screen.getByPlaceholderText('50,000,000'));
  expect(screen.getAllByText('Missing, required for screening')).toHaveLength(1);
});

test('an empty EBITDA says it can be built from statements, and the hint goes once typed', () => {
  mockDemo = false;
  const Harness = () => {
    const [inputs, setInputs] = require('react').useState({ ...mod.INITIAL_INPUTS, ebitda: 0 });
    return (
      <TutorialProvider userId={null}>
        <DealInputForm inputs={inputs} onChange={setInputs} schema={mod.FORM_SCHEMA} modules={getAvailableModules()}
          activeModule="equipment_finance" onModuleChange={() => {}} pipelineDeals={[]} sofr={0.0389} />
      </TutorialProvider>
    );
  };
  render(<Harness />);
  const ebitda = screen.getByPlaceholderText('8,000,000');
  expect(ebitda.parentElement.closest('[data-field="ebitda"]')).toHaveTextContent('Type it, or build it from statements above.');
  fireEvent.change(ebitda, { target: { value: '5' } });
  expect(screen.getByPlaceholderText('8,000,000')).toBe(ebitda);
  expect(ebitda.closest('[data-field="ebitda"]')).not.toHaveTextContent('build it from statements');
});
