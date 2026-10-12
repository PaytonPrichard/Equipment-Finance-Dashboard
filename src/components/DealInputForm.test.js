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

  test('Add statements also opens the full view', () => {
    const onOpen = jest.fn();
    render(
      <TutorialProvider userId={null}>
      <DealInputForm inputs={mod.INITIAL_INPUTS} onChange={() => {}} schema={mod.FORM_SCHEMA} modules={getAvailableModules()}
        activeModule="equipment_finance" onModuleChange={() => {}} pipelineDeals={[]} sofr={0.0389} onOpenStatements={onOpen} />
      </TutorialProvider>,
    );
    fireEvent.click(screen.getByText('Add statements'));
    expect(onOpen).toHaveBeenCalled();
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

  test('Borrower Profile shows one line on the statements and opens the full view', () => {
    const onOpen = jest.fn();
    render(
      <TutorialProvider userId={null}>
      <DealInputForm inputs={withStatements} onChange={() => {}} schema={mod.FORM_SCHEMA} modules={getAvailableModules()}
        activeModule="equipment_finance" onModuleChange={() => {}} pipelineDeals={[]} sofr={0.0389} onOpenStatements={onOpen} />
      </TutorialProvider>,
    );
    const summary = within(screen.getByTestId('statements-summary'));
    expect(summary.getByText(/Builds Revenue, EBITDA/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Cash interest paid')).toBeNull();
    fireEvent.click(summary.getByRole('button', { name: 'Edit statements' }));
    expect(onOpen).toHaveBeenCalled();
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
