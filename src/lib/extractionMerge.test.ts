// Tests for the deterministic document merge.
//
// The scenarios below are the real disagreements the Granite Ridge corpus
// produced when run through extraction, not invented ones: the broker email
// rounds revenue to 38MM against 38,400,000 in the statements, claims EBITDA
// "just under 7.9MM" against 7,400,000, and shortens the legal name.

import {
  mergeExtractions,
  chooseAlternative,
  sourceDocuments,
  valuesAgree,
  groupForField,
  applyMergeToForm,
  NUMERIC_TOLERANCE,
} from './extractionMerge';
import type { DocumentExtraction } from './extractionMerge';

function doc(
  fileName: string,
  documentType: DocumentExtraction['documentType'],
  inputs: Record<string, unknown>,
  extra: Partial<DocumentExtraction> = {},
): DocumentExtraction {
  return {
    fileName,
    documentType,
    inputs,
    found: Object.keys(inputs),
    warnings: [],
    notes: null,
    ...extra,
  };
}

// The four Granite Ridge documents, reduced to the fields that matter here.
const financials = doc('02_financial-statements.pdf', 'financial_statement', {
  annualRevenue: 38400000,
  priorYearRevenue: 34900000,
  ebitda: 7400000,
  totalExistingDebt: 14200000,
  cashOnHand: 2650000,
});

const application = doc('01_credit-application.pdf', 'credit_application', {
  companyName: 'Granite Ridge Materials LLC',
  yearsInBusiness: 16,
  industrySector: 'Mining',
  equipmentCost: 6275000,
  equipmentType: 'Heavy Machinery',
});

const quote = doc('03_equipment-quote.pdf', 'equipment_quote', {
  equipmentCost: 6275000,
  equipmentType: 'Construction Equipment',
  equipmentCondition: 'New',
  usefulLife: 12,
});

const brokerEmail = doc('04_broker-email.txt', 'deal_sheet', {
  companyName: 'Granite Ridge Materials',
  annualRevenue: 38000000,
  ebitda: 7900000,
  financingType: 'EFA',
  loanTerm: 84,
  essentialUse: true,
});

describe('valuesAgree', () => {
  test('numbers inside the tolerance band are the same fact', () => {
    // Prose rounds. "just over 38MM" against 38,400,000 is not a real
    // disagreement, but 7.9MM against 7.4MM is.
    expect(valuesAgree(38400000, 38400000)).toBe(true);
    expect(valuesAgree(1000000, 1005000)).toBe(true);
    expect(valuesAgree(38400000, 38000000)).toBe(false);
    expect(valuesAgree(7400000, 7900000)).toBe(false);
  });

  test('the band is symmetric', () => {
    // Scaling on the larger magnitude keeps the comparison order-independent.
    expect(valuesAgree(100, 101)).toBe(valuesAgree(101, 100));
    expect(valuesAgree(1000000, 1010000)).toBe(valuesAgree(1010000, 1000000));
  });

  test('tolerance is exactly one percent', () => {
    expect(NUMERIC_TOLERANCE).toBe(0.01);
    expect(valuesAgree(1000, 990)).toBe(true);
    expect(valuesAgree(1000, 900)).toBe(false);
  });

  test('strings compare case and whitespace insensitively', () => {
    expect(valuesAgree('EFA', ' efa ')).toBe(true);
    expect(valuesAgree('Mining', 'Construction')).toBe(false);
  });

  test('zero does not divide', () => {
    expect(valuesAgree(0, 0)).toBe(true);
    expect(valuesAgree(0, 100)).toBe(false);
  });

  test('booleans compare exactly', () => {
    expect(valuesAgree(true, true)).toBe(true);
    expect(valuesAgree(true, false)).toBe(false);
  });
});

describe('field grouping', () => {
  test('fields route to the group that determines their authority', () => {
    expect(groupForField('ebitda')).toBe('financials');
    expect(groupForField('companyName')).toBe('identity');
    expect(groupForField('equipmentCost')).toBe('equipment');
    expect(groupForField('financingType')).toBe('structure');
    expect(groupForField('arOver90')).toBe('collateral');
  });

  test('an unknown field falls back rather than throwing', () => {
    expect(groupForField('somethingNobodyDefined')).toBe('financials');
  });
});

describe('precedence', () => {
  test('financial statements beat a broker email on EBITDA', () => {
    const merged = mergeExtractions([brokerEmail, financials]);
    expect(merged.inputs.ebitda).toBe(7400000);
    expect(merged.fieldSources.ebitda.fileName).toBe('02_financial-statements.pdf');
  });

  test('upload order does not change the outcome', () => {
    // The broker email is first here and second above. Precedence decides,
    // not who arrived first.
    const a = mergeExtractions([brokerEmail, financials]);
    const b = mergeExtractions([financials, brokerEmail]);
    expect(a.inputs.ebitda).toBe(b.inputs.ebitda);
    expect(a.inputs.annualRevenue).toBe(b.inputs.annualRevenue);
  });

  test('the credit application beats a broker email on legal name', () => {
    const merged = mergeExtractions([brokerEmail, application]);
    expect(merged.inputs.companyName).toBe('Granite Ridge Materials LLC');
  });

  test('the dealer quote beats the application on equipment type', () => {
    // This is what makes the ambiguous quarry-plant classification
    // deterministic: the party selling the equipment classifies it.
    const merged = mergeExtractions([application, quote]);
    expect(merged.inputs.equipmentType).toBe('Construction Equipment');
    expect(merged.fieldSources.equipmentType.fileName).toBe('03_equipment-quote.pdf');
  });

  test('precedence is per group, not one global ranking', () => {
    // The same merge trusts the quote about equipment and the statements
    // about money. A single ordering would get one of them wrong.
    const merged = mergeExtractions([financials, application, quote, brokerEmail]);
    expect(merged.fieldSources.equipmentType.documentType).toBe('equipment_quote');
    expect(merged.fieldSources.ebitda.documentType).toBe('financial_statement');
    expect(merged.fieldSources.companyName.documentType).toBe('credit_application');
    expect(merged.fieldSources.financingType.documentType).toBe('deal_sheet');
  });

  test('a document type absent from a group still supplies an unclaimed field', () => {
    // Nothing outranks the broker email on loan term here, so it wins.
    const merged = mergeExtractions([financials, brokerEmail]);
    expect(merged.inputs.loanTerm).toBe(84);
  });
});

describe('conflicts', () => {
  test('a real disagreement is recorded with both sides', () => {
    const merged = mergeExtractions([financials, brokerEmail]);
    const ebitda = merged.conflicts.find((c) => c.field === 'ebitda');
    expect(ebitda).toBeDefined();
    expect(ebitda!.chosen.value).toBe(7400000);
    expect(ebitda!.chosen.fileName).toBe('02_financial-statements.pdf');
    expect(ebitda!.alternatives).toHaveLength(1);
    expect(ebitda!.alternatives[0].value).toBe(7900000);
    expect(ebitda!.alternatives[0].fileName).toBe('04_broker-email.txt');
  });

  test('rounding does not become a conflict', () => {
    // Both documents state equipment cost as 6,275,000.
    const merged = mergeExtractions([application, quote]);
    expect(merged.conflicts.find((c) => c.field === 'equipmentCost')).toBeUndefined();
  });

  test('a shortened company name is a conflict worth showing', () => {
    const merged = mergeExtractions([application, brokerEmail]);
    const name = merged.conflicts.find((c) => c.field === 'companyName');
    expect(name).toBeDefined();
    expect(name!.alternatives[0].value).toBe('Granite Ridge Materials');
  });

  test('one document produces no conflicts', () => {
    expect(mergeExtractions([financials]).conflicts).toHaveLength(0);
  });

  test('the full four-document set surfaces exactly the planted conflicts', () => {
    const merged = mergeExtractions([application, financials, quote, brokerEmail]);
    const fields = merged.conflicts.map((c) => c.field).sort();
    expect(fields).toEqual(['annualRevenue', 'companyName', 'ebitda', 'equipmentType']);
  });
});

describe('choosing an alternative', () => {
  test('switching a field updates the value and its source', () => {
    const merged = mergeExtractions([financials, brokerEmail]);
    const conflict = merged.conflicts.find((c) => c.field === 'ebitda')!;
    const after = chooseAlternative(merged, 'ebitda', conflict.alternatives[0]);

    expect(after.inputs.ebitda).toBe(7900000);
    expect(after.fieldSources.ebitda.fileName).toBe('04_broker-email.txt');
  });

  test('the conflict stays visible after switching, with the sides swapped', () => {
    // The analyst overrode the default. They should still be able to see
    // what the statements said and switch back.
    const merged = mergeExtractions([financials, brokerEmail]);
    const conflict = merged.conflicts.find((c) => c.field === 'ebitda')!;
    const after = chooseAlternative(merged, 'ebitda', conflict.alternatives[0]);

    const swapped = after.conflicts.find((c) => c.field === 'ebitda')!;
    expect(swapped.chosen.value).toBe(7900000);
    expect(swapped.alternatives.map((a) => a.value)).toContain(7400000);
  });

  test('other fields are untouched', () => {
    const merged = mergeExtractions([financials, brokerEmail]);
    const conflict = merged.conflicts.find((c) => c.field === 'ebitda')!;
    const after = chooseAlternative(merged, 'ebitda', conflict.alternatives[0]);
    expect(after.inputs.annualRevenue).toBe(merged.inputs.annualRevenue);
  });

  test('a field with no conflict is a no-op', () => {
    const merged = mergeExtractions([financials]);
    const after = chooseAlternative(merged, 'ebitda', {
      value: 1,
      fileName: 'x.pdf',
      documentType: 'other',
    });
    expect(after).toBe(merged);
  });
});

describe('removing a document', () => {
  test('re-merging without a document drops the values only it supplied', () => {
    // The panel re-merges from cached per-document results rather than
    // re-parsing, so this is the whole removal path.
    const all = mergeExtractions([financials, application, quote, brokerEmail]);
    expect(all.inputs.usefulLife).toBe(12);

    const without = mergeExtractions([financials, application, brokerEmail]);
    expect(without.inputs.usefulLife).toBeUndefined();
    // And a field the removed document merely agreed about survives.
    expect(without.inputs.equipmentCost).toBe(6275000);
  });

  test('removing the winner promotes the runner-up and clears the conflict', () => {
    const all = mergeExtractions([financials, brokerEmail]);
    expect(all.inputs.ebitda).toBe(7400000);

    const without = mergeExtractions([brokerEmail]);
    expect(without.inputs.ebitda).toBe(7900000);
    expect(without.conflicts).toHaveLength(0);
  });
});

describe('failures and gaps', () => {
  test('a failed document is reported and does not poison the merge', () => {
    const broken = doc('05_scan.pdf', 'other', {}, { error: 'Could not read file' });
    const merged = mergeExtractions([financials, broken]);
    expect(merged.failed).toEqual([{ fileName: '05_scan.pdf', error: 'Could not read file' }]);
    expect(merged.inputs.ebitda).toBe(7400000);
  });

  test('missing lists spec fields no document supplied', () => {
    const merged = mergeExtractions([financials], [
      'ebitda',
      'annualRevenue',
      'equipmentCost',
      'creditRating',
    ]);
    expect(merged.missing.sort()).toEqual(['creditRating', 'equipmentCost']);
  });

  test('empty and null values never win a field', () => {
    const blanks = doc('blank.pdf', 'financial_statement', {
      ebitda: null,
      companyName: '',
    });
    const merged = mergeExtractions([blanks, brokerEmail]);
    expect(merged.inputs.ebitda).toBe(7900000);
    expect(merged.inputs.companyName).toBe('Granite Ridge Materials');
  });

  test('no documents merges to nothing rather than throwing', () => {
    const merged = mergeExtractions([]);
    expect(merged.inputs).toEqual({});
    expect(merged.conflicts).toHaveLength(0);
    expect(merged.failed).toHaveLength(0);
  });
});

describe('source documents for the memo', () => {
  test('lists each contributing document once with a field count', () => {
    const merged = mergeExtractions([application, financials, quote, brokerEmail]);
    const sources = sourceDocuments(merged);
    const names = sources.map((s) => s.fileName).sort();
    expect(names).toEqual([
      '01_credit-application.pdf',
      '02_financial-statements.pdf',
      '03_equipment-quote.pdf',
      '04_broker-email.txt',
    ]);
    const total = sources.reduce((n, s) => n + s.fieldCount, 0);
    expect(total).toBe(Object.keys(merged.inputs).length);
  });

  test('a document that won nothing does not appear', () => {
    // The broker email loses every field it shares with the statements.
    const merged = mergeExtractions([
      financials,
      doc('redundant.txt', 'deal_sheet', { ebitda: 7900000 }),
    ]);
    expect(sourceDocuments(merged).map((s) => s.fileName)).toEqual([
      '02_financial-statements.pdf',
    ]);
  });
});

describe('applyMergeToForm', () => {
  // The three claims that pull against each other: a new deal resets, a
  // second document adds rather than replaces, and the analyst outranks
  // the model.
  const initial = {
    companyName: '',
    ebitda: 0,
    annualRevenue: 0,
    yearsInBusiness: 0,
    creditRating: 'Adequate',
    essentialUse: false,
  };

  test('the first upload fills a blank form', () => {
    const out = applyMergeToForm({
      initial,
      current: initial,
      previousMerged: null,
      nextMerged: { companyName: 'Granite Ridge Materials LLC', ebitda: 7400000 },
    });
    expect(out.companyName).toBe('Granite Ridge Materials LLC');
    expect(out.ebitda).toBe(7400000);
    // Untouched fields keep their defaults rather than going undefined.
    expect(out.creditRating).toBe('Adequate');
  });

  test('a second document adds to the first instead of replacing it', () => {
    const afterFirst = applyMergeToForm({
      initial,
      current: initial,
      previousMerged: null,
      nextMerged: { ebitda: 7400000 },
    });
    const afterSecond = applyMergeToForm({
      initial,
      current: afterFirst,
      previousMerged: { ebitda: 7400000 },
      nextMerged: { ebitda: 7400000, annualRevenue: 38400000 },
    });
    expect(afterSecond.ebitda).toBe(7400000);
    expect(afterSecond.annualRevenue).toBe(38400000);
  });

  test('a value the analyst typed survives the next upload', () => {
    // No document ever supplied yearsInBusiness; they typed it. Adding a
    // document must not wipe it. This is the regression the plain
    // reset-and-spread caused.
    const current = { ...initial, ebitda: 7400000, yearsInBusiness: 16 };
    const out = applyMergeToForm({
      initial,
      current,
      previousMerged: { ebitda: 7400000 },
      nextMerged: { ebitda: 7400000, annualRevenue: 38400000 },
    });
    expect(out.yearsInBusiness).toBe(16);
    expect(out.annualRevenue).toBe(38400000);
  });

  test('an analyst correction outranks a later extraction of the same field', () => {
    // They looked at the document; the model only read it.
    const current = { ...initial, ebitda: 7250000 }; // corrected down from 7.4M
    const out = applyMergeToForm({
      initial,
      current,
      previousMerged: { ebitda: 7400000 },
      nextMerged: { ebitda: 7400000, annualRevenue: 38400000 },
    });
    expect(out.ebitda).toBe(7250000);
  });

  test('a correction inside the rounding band is not treated as an edit', () => {
    // Re-rendering a number as 7400000.4 must not latch it as an override.
    const current = { ...initial, ebitda: 7400000.4 };
    const out = applyMergeToForm({
      initial,
      current,
      previousMerged: { ebitda: 7400000 },
      nextMerged: { ebitda: 7410000 },
    });
    expect(out.ebitda).toBe(7410000);
  });

  test('removing the last document returns the form to defaults plus edits', () => {
    const current = { ...initial, ebitda: 7400000, yearsInBusiness: 16 };
    const out = applyMergeToForm({
      initial,
      current,
      previousMerged: { ebitda: 7400000 },
      nextMerged: {},
    });
    expect(out.ebitda).toBe(0);
    expect(out.yearsInBusiness).toBe(16);
  });

  test('a false boolean default is not mistaken for an analyst edit', () => {
    // essentialUse defaults to false. Leaving it false is not a decision.
    const out = applyMergeToForm({
      initial,
      current: initial,
      previousMerged: null,
      nextMerged: { essentialUse: true },
    });
    expect(out.essentialUse).toBe(true);
  });

  test('an analyst who set a boolean back to the default keeps it', () => {
    const current = { ...initial, essentialUse: false };
    const out = applyMergeToForm({
      initial,
      current,
      previousMerged: { essentialUse: false },
      nextMerged: { essentialUse: true },
    });
    // previousMerged said false, current says false, so no edit was made
    // and the new extraction wins.
    expect(out.essentialUse).toBe(true);
  });
});
