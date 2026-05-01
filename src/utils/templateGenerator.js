// Generate an .xlsx batch upload template that resembles a private-credit
// workpaper rather than a bare CSV. ExcelJS is lazy-loaded so it doesn't
// bloat the main bundle.
//
// Layout (1-indexed):
//   row 1: title block (merged across all columns)
//   row 2: section group headers (merged per section)
//   row 3: column headers with units appended (frozen above this)
//   row 4: sample row (italic, amber tint, "delete before uploading")
//   row 5+: user input rows (banded, bordered, conditional-formatted)

const SAMPLE_VALUES = {
  equipment_finance: {
    companyName: 'Acme Manufacturing (sample - delete this row)',
    yearsInBusiness: 12,
    annualRevenue: 50000000,
    ebitda: 8000000,
    totalExistingDebt: 20000000,
    actualAnnualDebtService: 1600000,
    industrySector: 'Manufacturing',
    creditRating: 'Adequate',
    equipmentType: 'Heavy Machinery',
    equipmentCondition: 'New',
    equipmentCost: 5000000,
    downPayment: 500000,
    financingType: 'EFA',
    usefulLife: 15,
    loanTerm: 84,
    essentialUse: 'Yes',
  },
  accounts_receivable: {
    companyName: 'Acme Distributing (sample - delete this row)',
    yearsInBusiness: 12,
    annualRevenue: 50000000,
    ebitda: 8000000,
    totalExistingDebt: 20000000,
    actualAnnualDebtService: 1600000,
    industrySector: 'Manufacturing',
    creditRating: 'Adequate',
    totalAROutstanding: 12000000,
    requestedAdvanceRate: 80,
    arUnder30: 65,
    arOver30: 20,
    arOver60: 10,
    arOver90: 5,
    topCustomerConcentration: 15,
    dilutionRate: 3,
    ineligiblesPct: 15,
    existingABLFacility: 'No',
  },
  inventory_finance: {
    companyName: 'Acme Goods (sample - delete this row)',
    yearsInBusiness: 12,
    annualRevenue: 50000000,
    ebitda: 8000000,
    totalExistingDebt: 20000000,
    actualAnnualDebtService: 1600000,
    industrySector: 'Manufacturing',
    creditRating: 'Adequate',
    totalInventory: 8000000,
    requestedAdvanceRate: 50,
    rawMaterials: 30,
    workInProgress: 15,
    finishedGoods: 50,
    obsoleteInventory: 5,
    inventoryTurnover: 6,
    averageDaysOnHand: 60,
    nolvPct: 55,
    perishable: 'No',
  },
};

// More specific units for plain "number" fields.
const NUMBER_UNITS = {
  yearsInBusiness: 'Years',
  usefulLife: 'Years',
  loanTerm: 'Months',
  inventoryTurnover: 'x',
  averageDaysOnHand: 'Days',
};

// Brand-aligned palette (ARGB).
const COLOR = {
  GOLD: 'FFD4A843',
  CHARCOAL: 'FF1F2937',
  HEADER_BG: 'FFF3F4F6',
  SECTION_BG: 'FF374151',
  SECTION_FG: 'FFFFFFFF',
  SAMPLE_TINT: 'FFFEF3C7',
  REQUIRED_BLANK: 'FFFEE2E2',
  BAND: 'FFFAFAFA',
  BORDER: 'FFE5E7EB',
  GOLD_BORDER: 'FFD4A843',
  RED: 'FFEF4444',
  MUTED: 'FF6B7280',
  HINT: 'FF9CA3AF',
};

const TITLE_ROW = 1;
const SECTION_ROW = 2;
const HEADER_ROW = 3;
const SAMPLE_ROW = 4;
const FIRST_USER_ROW = 5;
const LAST_USER_ROW = 504; // 500 user rows

function fieldUnit(field) {
  switch (field.type) {
    case 'currency':
      return 'USD';
    case 'percent':
      return '%';
    case 'number':
      return NUMBER_UNITS[field.key] || '';
    case 'select':
    case 'toggle':
    case 'financing-type':
      return 'Pick from list';
    case 'boolean':
      return 'Yes / No';
    default:
      return '';
  }
}

function fieldNumberFormat(field) {
  switch (field.type) {
    case 'currency':
      return '"$"#,##0';
    case 'percent':
      return '0"%"';
    case 'number':
      return '0';
    default:
      return undefined;
  }
}

function fieldDropdownOptions(field, mod) {
  if (field.type === 'select' && Array.isArray(field.options)) return field.options;
  if (field.type === 'toggle' && Array.isArray(field.options)) return field.options;
  if (field.type === 'boolean') return ['Yes', 'No'];
  if (field.type === 'financing-type' && mod.FINANCING_TYPES) {
    return Object.keys(mod.FINANCING_TYPES);
  }
  return null;
}

function flattenFields(schema) {
  return schema.sections.flatMap((s) => s.fields);
}

// Build [{title, startCol, endCol}] groups from the schema.
function sectionRanges(schema) {
  const ranges = [];
  let col = 1;
  schema.sections.forEach((section) => {
    const span = section.fields.length;
    ranges.push({
      title: section.title,
      startCol: col,
      endCol: col + span - 1,
    });
    col += span;
  });
  return ranges;
}

function colLetter(idx) {
  // ExcelJS exposes this on column objects, but we sometimes need it before
  // the column exists. 1 -> A, 26 -> Z, 27 -> AA, etc.
  let s = '';
  let n = idx;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function generateXlsxTemplate(moduleKey, mod) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tranche';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Template', {
    views: [{ state: 'frozen', ySplit: HEADER_ROW }],
    properties: { defaultRowHeight: 18 },
  });

  const fields = flattenFields(mod.FORM_SCHEMA);
  const sample = SAMPLE_VALUES[moduleKey] || {};
  const sections = sectionRanges(mod.FORM_SCHEMA);
  const moduleName = mod.META?.name || 'Batch Screening';

  // Append a free-text Notes column at the end.
  const notesCol = fields.length + 1;
  const lastCol = notesCol;

  // ── Column widths ───────────────────────────────────────────
  fields.forEach((f, i) => {
    const width = Math.max((f.label || '').length + 4, 16);
    sheet.getColumn(i + 1).width = width;
  });
  sheet.getColumn(notesCol).width = 32;

  // ── Row 1: title block ─────────────────────────────────────
  sheet.mergeCells(TITLE_ROW, 1, TITLE_ROW, lastCol);
  const titleCell = sheet.getCell(TITLE_ROW, 1);
  titleCell.value = {
    richText: [
      { text: 'Tranche', font: { bold: true, color: { argb: COLOR.GOLD }, size: 14 } },
      { text: '   ·   ', font: { color: { argb: COLOR.HINT }, size: 14 } },
      { text: moduleName, font: { bold: true, color: { argb: COLOR.CHARCOAL }, size: 13 } },
      { text: '   ·   Batch Screening Template', font: { color: { argb: COLOR.MUTED }, size: 12 } },
    ],
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  titleCell.border = {
    bottom: { style: 'thick', color: { argb: COLOR.GOLD_BORDER } },
  };
  sheet.getRow(TITLE_ROW).height = 30;

  // ── Row 2: section group headers ────────────────────────────
  sections.forEach((sec) => {
    sheet.mergeCells(SECTION_ROW, sec.startCol, SECTION_ROW, sec.endCol);
    const cell = sheet.getCell(SECTION_ROW, sec.startCol);
    cell.value = sec.title;
    cell.font = { bold: true, color: { argb: COLOR.SECTION_FG }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.SECTION_BG } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cell.border = {
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
  });
  // Notes column in section row stays neutral
  const notesSectionCell = sheet.getCell(SECTION_ROW, notesCol);
  notesSectionCell.value = 'Notes';
  notesSectionCell.font = { bold: true, color: { argb: COLOR.SECTION_FG }, size: 11 };
  notesSectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.SECTION_BG } };
  notesSectionCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(SECTION_ROW).height = 22;

  // ── Row 3: column headers (with units in parens) ────────────
  fields.forEach((f, i) => {
    const cell = sheet.getCell(HEADER_ROW, i + 1);
    const baseLabel = f.label || f.key;
    const unit = fieldUnit(f);
    const labelText = unit ? `${baseLabel} (${unit})` : baseLabel;

    if (f.required) {
      cell.value = {
        richText: [
          { text: labelText, font: { bold: true, color: { argb: COLOR.CHARCOAL }, size: 11 } },
          { text: ' *', font: { bold: true, color: { argb: COLOR.RED }, size: 11 } },
        ],
      };
    } else {
      cell.value = labelText;
      cell.font = { bold: true, color: { argb: COLOR.CHARCOAL }, size: 11 };
    }

    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.HEADER_BG } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: COLOR.BORDER } },
      bottom: { style: 'medium', color: { argb: COLOR.CHARCOAL } },
      right: { style: 'thin', color: { argb: COLOR.BORDER } },
    };

    if (f.tip) {
      cell.note = {
        texts: [{ text: f.tip }],
        margins: { insetmode: 'auto' },
      };
    }
  });
  // Notes header cell
  const notesHeader = sheet.getCell(HEADER_ROW, notesCol);
  notesHeader.value = 'Notes';
  notesHeader.font = { bold: true, color: { argb: COLOR.CHARCOAL }, size: 11 };
  notesHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.HEADER_BG } };
  notesHeader.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  notesHeader.border = {
    top: { style: 'thin', color: { argb: COLOR.BORDER } },
    bottom: { style: 'medium', color: { argb: COLOR.CHARCOAL } },
  };
  sheet.getRow(HEADER_ROW).height = 30;

  // ── Row 4: sample row ───────────────────────────────────────
  fields.forEach((f, i) => {
    const cell = sheet.getCell(SAMPLE_ROW, i + 1);
    const v = sample[f.key];
    if (v !== undefined) cell.value = v;
    cell.font = { italic: true, color: { argb: COLOR.MUTED }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.SAMPLE_TINT } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cell.border = {
      bottom: { style: 'thin', color: { argb: COLOR.BORDER } },
      right: { style: 'hair', color: { argb: COLOR.BORDER } },
    };
    const fmt = fieldNumberFormat(f);
    if (fmt) cell.numFmt = fmt;
  });
  // Add a note on the sample-row first cell so users know to delete it.
  sheet.getCell(SAMPLE_ROW, 1).note = {
    texts: [{ text: 'This is a sample row showing realistic data. Overwrite or delete it before uploading.' }],
  };
  sheet.getRow(SAMPLE_ROW).height = 20;

  // ── Rows 5..504: user input ────────────────────────────────
  // Apply borders, banding, number formats, and per-column dropdowns.
  fields.forEach((f, i) => {
    const colIdx = i + 1;
    const fmt = fieldNumberFormat(f);
    const options = fieldDropdownOptions(f, mod);
    const optionsFormula = options && options.length > 0 ? `"${options.join(',')}"` : null;

    for (let r = FIRST_USER_ROW; r <= LAST_USER_ROW; r++) {
      const cell = sheet.getCell(r, colIdx);
      if (fmt) cell.numFmt = fmt;
      cell.border = {
        bottom: { style: 'hair', color: { argb: COLOR.BORDER } },
        right: { style: 'hair', color: { argb: COLOR.BORDER } },
      };
      // Banded row fill (only on even-numbered user rows for subtle effect).
      if ((r - FIRST_USER_ROW) % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.BAND } };
      }
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      if (optionsFormula) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: !f.required,
          formulae: [optionsFormula],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Invalid value',
          error: `Choose one of: ${options.join(', ')}`,
        };
      }
    }
  });
  // Notes column user rows (no validation, just borders/banding)
  for (let r = FIRST_USER_ROW; r <= LAST_USER_ROW; r++) {
    const cell = sheet.getCell(r, notesCol);
    cell.border = {
      bottom: { style: 'hair', color: { argb: COLOR.BORDER } },
    };
    if ((r - FIRST_USER_ROW) % 2 === 1) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.BAND } };
    }
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
  }

  // ── Conditional formatting: highlight blank required cells ──
  fields.forEach((f, i) => {
    if (!f.required) return;
    const colIdx = i + 1;
    const letter = colLetter(colIdx);
    const ref = `${letter}${FIRST_USER_ROW}:${letter}${LAST_USER_ROW}`;
    sheet.addConditionalFormatting({
      ref,
      rules: [
        {
          type: 'expression',
          formulae: [`ISBLANK(${letter}${FIRST_USER_ROW})`],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: COLOR.REQUIRED_BLANK } },
          },
          priority: 1,
        },
      ],
    });
  });

  // Outer thick border around the entire input area for "workpaper" feel.
  // ExcelJS doesn't have a single-call "outer border" helper, so apply edges.
  const lastRow = LAST_USER_ROW;
  // Top edge already handled by header bottom border.
  // Left and right edges: walk down rows 4..lastRow.
  for (let r = SAMPLE_ROW; r <= lastRow; r++) {
    const left = sheet.getCell(r, 1);
    left.border = { ...left.border, left: { style: 'thin', color: { argb: COLOR.BORDER } } };
    const right = sheet.getCell(r, lastCol);
    right.border = { ...right.border, right: { style: 'thin', color: { argb: COLOR.BORDER } } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
