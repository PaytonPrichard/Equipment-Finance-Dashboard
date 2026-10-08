// The company search offers fictional companies with made-up financials.
// In a real account, picking one would fill a real deal with invented
// numbers, so they are offered only in the demo. The firm's own pipeline is
// searchable in both.

import { render, screen, fireEvent } from '@testing-library/react';
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
