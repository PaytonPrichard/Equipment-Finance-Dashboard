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
