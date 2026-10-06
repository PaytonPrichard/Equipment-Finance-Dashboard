// The audit panel's one job is to say truthfully who supplied each value.
// A value kept from the form over a document is not a correction: nobody
// looked at the document and disagreed with it.

import { render, screen } from '@testing-library/react';
import DealProvenance from './DealProvenance';

const source = (value) => ({ value, fileName: 'kestrel.pdf', documentType: 'deal_sheet' });

function renderWith({ inputs, keptFromForm = [] }) {
  render(
    <DealProvenance
      inputs={inputs}
      provenance={{
        fieldSources: { companyName: source('Kestrel Medical Imaging Partners'), ebitda: source(6800000) },
        conflicts: [],
        documents: [{ fileName: 'kestrel.pdf', documentType: 'deal_sheet', fieldCount: 2 }],
        keptFromForm,
      }}
      moduleInitialInputs={{ companyName: '', ebitda: 0 }}
    />,
  );
}

test('a value kept over the document is labelled as entered before upload', () => {
  renderWith({
    inputs: { companyName: 'Midwest Precision Machining Inc.', ebitda: 6800000 },
    keptFromForm: ['companyName'],
  });
  expect(screen.getByText('Entered before upload')).toBeInTheDocument();
  expect(screen.getByText(/document says Kestrel Medical Imaging Partners/)).toBeInTheDocument();
  expect(screen.queryByText('Analyst corrected')).not.toBeInTheDocument();
  expect(screen.getByText('1 kept over the documents')).toBeInTheDocument();
});

test('a value changed after extraction is still a correction', () => {
  renderWith({ inputs: { companyName: 'Kestrel Medical Imaging Partners', ebitda: 6500000 } });
  expect(screen.getByText('Analyst corrected')).toBeInTheDocument();
  expect(screen.getByText('1 corrected by you')).toBeInTheDocument();
});
