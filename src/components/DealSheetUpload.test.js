// What happens when the wrong file arrives. Found on production 2026-10-06:
// a .pptx went to the server, came back as a raw MIME string and still
// counted against the extraction quota; an unrelated PDF was added as
// "0 fields" and, on a new deal, would have cleared the form.

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DealSheetUpload, { emptyNotice } from './DealSheetUpload';

jest.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } },
}));
jest.mock('../lib/demoMode', () => ({ isDemoMode: () => false }));

function file(name, body = 'x') {
  return new File([body], name);
}

function setup() {
  const props = {
    activeModule: 'equipment_finance',
    onExtracted: jest.fn(),
    beforeFirstUpload: jest.fn(async () => true),
  };
  const { container } = render(<DealSheetUpload {...props} />);
  const input = container.querySelector('input[type="file"]');
  return { props, drop: (files) => fireEvent.change(input, { target: { files } }) };
}

beforeEach(() => {
  global.fetch = jest.fn();
});

test('a slide deck is stopped before the prompt and before the server', async () => {
  const { props, drop } = setup();
  drop([file('quarterly-update.pptx')]);
  expect(await screen.findByText(/quarterly-update\.pptx cannot be read for extraction/)).toBeInTheDocument();
  expect(props.beforeFirstUpload).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('an empty file is stopped before the server', async () => {
  const { drop } = setup();
  drop([new File([], 'blank.pdf')]);
  expect(await screen.findByText('blank.pdf is empty.')).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('a .csv is sent as text/csv whatever the browser calls it', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ documents: [{ fileName: 'aging.csv', documentType: 'other', inputs: { ebitda: 1 }, found: ['ebitda'], error: null }] }),
  });
  const { drop } = setup();
  drop([new File(['a,b'], 'aging.csv', { type: 'application/vnd.ms-excel' })]);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body.files[0].media_type).toBe('text/csv');
});

test('a document with no deal figures is named and left out, and the form is untouched', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      documents: [{ fileName: 'offsite-agenda.pdf', documentType: 'other', inputs: {}, found: [], error: null }],
    }),
  });
  const { props, drop } = setup();
  drop([file('offsite-agenda.pdf')]);
  expect(await screen.findByText('offsite-agenda.pdf has no deal figures in it, so it was not added.')).toBeInTheDocument();
  expect(props.onExtracted).not.toHaveBeenCalled();
});

test('the useful documents in a mixed set still go through', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      documents: [
        { fileName: 'financials.pdf', documentType: 'financial_statement', inputs: { ebitda: 7400000 }, found: ['ebitda'], error: null },
        { fileName: 'agenda.pdf', documentType: 'other', inputs: {}, found: [], error: null },
      ],
    }),
  });
  const { props, drop } = setup();
  drop([file('financials.pdf'), file('agenda.pdf')]);
  expect(await screen.findByText('agenda.pdf has no deal figures in it, so it was not added.')).toBeInTheDocument();
  expect(props.onExtracted).toHaveBeenCalledTimes(1);
  expect(props.onExtracted.mock.calls[0][0]).toEqual({ ebitda: 7400000 });
});

test('the notice reads as a sentence for several files', () => {
  expect(emptyNotice(['a.pdf', 'b.pdf', 'c.png'])).toBe(
    'a.pdf, b.pdf and c.png have no deal figures in them, so they were not added.',
  );
  expect(emptyNotice([])).toBeNull();
});
