// Guards the wiring between App.js and the memo generator.
//
// Phase 4 added `commentary` and `sourceDocuments` props to
// generateBrandedPdfHtml, with tests that passed them directly. A patch
// script then died on an unrelated assertion before applying the App.js
// half, so the generator had the props, the tests passed, the preview
// script passed them, and the live app passed neither: every real memo
// reported "entered manually" and fell back to parsing commentary out of a
// text blob.
//
// Unit tests on a renderer cannot see that. These read the call site.

const fs = require('fs');
const path = require('path');

const APP = fs.readFileSync(path.join(__dirname, 'App.js'), 'utf-8');

function exportPanelCall() {
  const start = APP.indexOf('<ExportPanel');
  expect(start).toBeGreaterThan(-1);
  return APP.slice(start, APP.indexOf('/>', start) + 2);
}

describe('the memo receives what the generator expects', () => {
  test('commentary is passed, not left to the text-parsing fallback', () => {
    expect(exportPanelCall()).toMatch(/commentary=\{commentary\}/);
  });

  test('source documents are passed, so the memo can cite them', () => {
    expect(exportPanelCall()).toMatch(/sourceDocuments=\{memoSourceDocuments\}/);
  });

  test('memoSourceDocuments is actually derived from the extraction', () => {
    expect(APP).toMatch(/const memoSourceDocuments = useMemo/);
    expect(APP).toMatch(/extraction\.fieldSources/);
  });
});

describe('provenance survives a save and reload', () => {
  test('it is persisted when a deal is saved to the pipeline', () => {
    expect(APP).toMatch(/toStoredProvenance\(extraction\)/);
  });

  test('it is restored when a deal is opened', () => {
    expect(APP).toMatch(/fromStoredProvenance\(storedProvenance\)/);
  });

  test('the pipeline hands the stored value to the loader', () => {
    const pipeline = fs.readFileSync(
      path.join(__dirname, 'components', 'DealPipeline.js'), 'utf-8',
    );
    expect(pipeline).toMatch(/onLoadDeal\(deal\.inputs, deal\.id, deal\.asset_class, deal\.extraction_provenance\)/);
  });
});

describe('the audit view is reachable', () => {
  test('DealProvenance is rendered, not just defined', () => {
    expect(APP).toMatch(/<DealProvenance/);
  });

  test('it is in the jump-to nav', () => {
    expect(APP).toMatch(/id: 'sec-provenance'/);
    expect(APP).toMatch(/id="sec-provenance"/);
  });
});
