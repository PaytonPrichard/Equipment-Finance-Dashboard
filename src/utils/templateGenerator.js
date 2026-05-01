// Generate an .xlsx batch upload template for a module's form schema.
// ExcelJS is lazy-loaded so it doesn't bloat the main bundle.

const SAMPLE_VALUES = {
  equipment_finance: {
    companyName: 'Acme Manufacturing',
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
    companyName: 'Acme Distributing',
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
    companyName: 'Acme Goods',
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

export async function generateXlsxTemplate(moduleKey, mod) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tranche';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Template', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const fields = flattenFields(mod.FORM_SCHEMA);
  const sample = SAMPLE_VALUES[moduleKey] || {};

  sheet.columns = fields.map((f) => ({
    header: f.required ? `${f.label} *` : f.label,
    key: f.key,
    width: Math.max((f.label || '').length + 4, 14),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 11, color: { argb: 'FF1F2937' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 22;

  fields.forEach((f, i) => {
    const cell = headerRow.getCell(i + 1);
    if (f.tip) {
      cell.note = {
        texts: [{ text: f.tip }],
        margins: { insetmode: 'auto' },
      };
    }
  });

  const exampleRow = {};
  fields.forEach((f) => {
    exampleRow[f.key] = sample[f.key] !== undefined ? sample[f.key] : '';
  });
  sheet.addRow(exampleRow);

  fields.forEach((f, i) => {
    const colIdx = i + 1;
    const numFmt = fieldNumberFormat(f);
    if (numFmt) {
      sheet.getColumn(colIdx).numFmt = numFmt;
    }

    const options = fieldDropdownOptions(f, mod);
    if (options && options.length > 0) {
      const formula = `"${options.join(',')}"`;
      for (let r = 2; r <= 501; r++) {
        sheet.getCell(r, colIdx).dataValidation = {
          type: 'list',
          allowBlank: !f.required,
          formulae: [formula],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Invalid value',
          error: `Choose one of: ${options.join(', ')}`,
        };
      }
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
