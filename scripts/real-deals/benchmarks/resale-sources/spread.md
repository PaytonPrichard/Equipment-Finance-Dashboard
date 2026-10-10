# Retail vs liquidation spread for equipment collateral: source extract

Compiled 2026-10-09. Every quoted figure below was copied from a page or PDF loaded in this session. Quotes marked [curl-verified] were checked against the raw page text. Quotes marked [fetch-extract] came through the WebFetch tool's extraction and were not re-checked byte for byte. Figures marked DERIVED are my arithmetic on a quoted figure, not the source's.

Question A: lender values USED equipment at 85% of price paid (15% haircut). Is that a reasonable proxy for recovery?
Question B: is a 0% haircut on NEW equipment defensible?

---

## 1. Sandhills Global monthly market reports (vendor / marketplace data)

Publisher: Sandhills Global (operator of TractorHouse, MachineryTrader, TruckPaper; vendor source). "Asking values" are dealer/seller listing prices, not closed retail transactions.

### 1a. Definition of EVI spread (the definition changed between 2024 and 2026)

- 2026 wording: "EVI spread measures the percentage difference between asking and auction values." [curl-verified] (articles 250048193, 250047909, 250047595)
- 2024 wording: "EVI spread measures the percentage of asking values over auction values." [curl-verified] (article 250042343, July 8, 2024)
- 2022 wording, sleeper trucks: "The percentage gap between asking and auction values is quantified in Sandhills market reports as EVI spread." and "Heavy-duty sleeper truck asking values were 53 percent higher than auction values in June 2022." [curl-verified] (Equipment Finance Advisor reprint, see 1f)

The 2022 and 2024 wording reads as asking ÷ auction − 1 (the denominator is auction). Under that reading, auction ÷ asking = 1 ÷ (1 + spread). Sandhills does not state the formula outright. The 2026 wording is ambiguous. Both conversions are shown below.

### 1b. September 4, 2026 report (August 2026 data)
URL: https://www.sandhills.com/news/article/250048193
Title: "Economic Uncertainty Extending Sales Cycles in Used Heavy Equipment Market"

- Tractors 100 HP+: "The EVI spread, which measures the percentage difference between asking and auction values, was 31% in August, a two-percentage-point decrease from 33% in July." [curl-verified]
- Combines: "The EVI spread was 37%, a one-percentage-point decrease from 38% in July." [curl-verified]
- Sprayers: "The EVI spread was 40%, unchanged from July." [curl-verified]
- Planters: "The EVI spread decreased from 47% in July to 45% in August and remained lower than the peak values observed in 2015." [curl-verified]
- Heavy-duty construction: "Asking values showed a slight increase of 0.52% M/M but decreased 1.55% Y/Y" / "Auction values ... increasing 0.31% M/M, but decreased 1.29% Y/Y" [fetch-extract]. No EVI spread given for construction.
- Heavy-duty trucks: "Asking values increased 2.99% M/M but decreased 2.2% Y/Y" / "Auction values rose 4.91% M/M and 3.03% Y/Y" [fetch-extract]. No EVI spread given for trucks.

### 1c. August 10, 2026 report (July 2026 data)
URL: https://www.sandhills.com/news/article/250047909
Title: "Heavy-Duty Trucks Racking Up More Mileage While Used Truck Inventory Levels Continue to Fall"

- Tractors 100 HP+: "The EVI spread was 33%, which is a one-percentage-point increase from June but still lower than the peak values observed in 2015." [curl-verified]
- Combines: "The EVI spread was 38%, showing no change from June and remaining lower than the peak values observed in 2015." [curl-verified]
- Sprayers: "The EVI spread jumped from 37% in June to 40% in July" [curl-verified]
- Planters: "The EVI spread decreased from 49% in June to 47% in July" [curl-verified]
- No EVI spread published for trucks or construction in this report.

### 1d. July 6, 2026 report (June 2026 data)
URL: https://sandhills.com/news/article/250047595
Title: "Sandhills Market Reports Show Continued Inventory Declines Across Used Equipment and Truck Markets"

- Tractors 100 HP+: "The EVI spread was 32%, which is a one-percentage-point increase from May but still lower than the peak values observed in 2015." [curl-verified]
- Combines: "The EVI spread was 38%, showing no change from May and remaining lower than the peak values seen in 2015." [curl-verified]
- Sprayers: "The EVI spread fell from 40% in May to 37% in June" [curl-verified]
- Planters: "The EVI spread remained unchanged from May at 49%" [curl-verified]

### 1e. February 12, 2026 report (January 2026 data)
URL: https://www.equipmentfa.com/news/41025/sandhills-global-used-ag-equipment-markets-start-2026-with-tight-inventories-firming-values (Equipment Finance Advisor reprint of Sandhills release)

- Tractors 100 HP+: "The EVI spread, which measures the percentage difference between asking and auction values, fell three percentage points to 32% in January" [curl-verified]
- Combines: "The EVI spread for used combines decreased by one percentage point to 36% in January" [curl-verified]

### 1f. Historical context (stress periods)
- July 8, 2024, https://www.sandhills.com/news/article/250042343, "Asking-Auction Value Spread Reaches Historic Highs in Several Ag Equipment Markets":
  - Tractors 100 HP+: "EVI spread increased to 45% in June, exceeding the historic 39% peak for this category observed in 2015." [curl-verified]
  - Combines: "EVI spread has increased dramatically for used combines over the past few months, reaching 57% in June." [curl-verified]
- August 7, 2024, https://www.equipmentfa.com/news/38411/sandhills-reporting-unprecedented-auction-asking-value-spread-in-used-farm-equipment-market: combines spread 54% (July 2024) [fetch-extract].
- July 15, 2022, https://equipmentfa.com/news/34604/sandhills-global-market-report-examines-heavy-duty-sleeper-truck-value-trends (reprint):
  - "Heavy-duty sleeper truck asking values were 53 percent higher than auction values in June 2022." [curl-verified]
  - "Sleeper trucks produced in 2019 displayed a 35 percent gap between asking and auction values, while 2016 model year sleeper trucks displayed a 57 percent EVI spread." [curl-verified]

### 1g. December 22, 2021 report: direct "auction X% below asking" figures (cleanest form for a lender)
URL: https://www.sandhills.com/news/article/25347
Title: "As Equipment Inventory Levels Drop, Gap Narrows Between Auction Values and Asking Values" (dateline "LINCOLN, Nebraska – December 22, 2021")

- Sleeper trucks: "When used sleeper truck inventory levels were at an all-time high in April 2020, auction values were 39% below asking values." [curl-verified]
- "With used sleeper truck inventory now at an all-time low, auction values are only 17% below asking values." [curl-verified]
- "Similarly, in April 2011, auction values for used sleeper trucks were just 18% below asking values." [curl-verified]
- Dozers: "When dozer inventory was at its peak in April 2020, auction values were 31% below asking values." / "In the current market, used dozer auction values are 24% below asking values." [curl-verified]
- High-HP tractors: "The current auction/asking gap shows high-horsepower auction values 14% below asking values." / "When high-horsepower tractor inventory previously peaked in March 2015, auction values were 22% below asking values." [curl-verified]

### 1h. Summary table, Sandhills EVI spread 2026 (DERIVED auction ÷ asking)

| Month (data) | Tractors 100HP+ | Combines | Auction/asking if spread = asking÷auction−1 | Auction/asking if spread = (asking−auction)÷asking |
|---|---|---|---|---|
| Jan 2026 | 32% | 36% | tractors 75.8%, combines 73.5% | 68%, 64% |
| Jun 2026 | 32% | 38% | 75.8%, 72.5% | 68%, 62% |
| Jul 2026 | 33% | 38% | 75.2%, 72.5% | 67%, 62% |
| Aug 2026 | 31% | 37% | 76.3%, 73.0% | 69%, 63% |

Under either reading, 2026 auction values for tractors and combines sit 24% to 38% below dealer asking. No 2026 EVI spread was published for construction or Class 8 trucks in the reports loaded.

Caveat: asking is a list price. Actual retail transactions close below asking, so asking-vs-auction overstates the transaction-vs-auction gap. Section 3 (Iron Solutions) uses closed retail transactions.

---

## 2. J.D. Power Commercial Truck Guidelines (vendor data, used Class 8 sleepers)

### 2a. May 2026 Market Update (April 2026 data)
URL: https://www.jdpowervalues.com/sites/default/files/file/2026-05/May2026.pdf (downloaded, text extracted with pdftotext)

- "In April, auction pricing recovered from a weak March. Retail pricing was largely unchanged."
- Table (page 2): Retail Selling Prices M/M "+0.2%", Y/Y "+0.8%", YTD "+0.7%", Avg. Monthly Depreciation YTD2026 "-1.3%". Wholesale M/M "-2.1%", Y/Y "-3.1%", YTD "+1.9%", avg monthly depreciation "-2.6%". Auction M/M "+8.5%", Y/Y "-5.3%", YTD "-3.2%", avg monthly depreciation "-2.1%".
- Chart titles: "Average Auction Hammer Price: 3- to 6-Year-Old Benchmark Sleeper Tractor" and "Average Retail Selling Price: 3- to 5-Year-Old Sleeper Tractors".
- **Dollar levels are only in chart images. No average retail or auction dollar figure appears in the text.** Retail-vs-auction spread cannot be extracted. Note also the age bands differ (retail 3-5 yo, auction 3-6 yo).

### 2b. August 2026 Market Update (July 2026 data)
URL: https://www.jdpowervalues.com/sites/default/files/file/2026-08/August2026.pdf

- "Wholesale and retail pricing dipped in July, but average depreciation in recent months has been negligible."
- Retail M/M "-3.4%", Y/Y "-6.2%", avg monthly depreciation YTD2026 "-0.9%". Wholesale M/M "-1.8%", Y/Y "+3.9%", "-0.1%". Auction M/M "+3.7%", Y/Y "+11.9%", "+1.0%".
- Summary: "With freight volume still limited, increased new truck deliveries means increased trades and downward pressure on used truck values."
- Again no dollar levels in text.

Other months tried (Jan to Apr, Jun, Jul, Sep, Oct 2026 at the same URL pattern) returned 404.

### 2c. "Volume-Driven Depreciation Reappears in the Class 8 Market" (Chris Visser, J.D. Power, September 13, 2023)
URL: https://www.jdpowervalues.com/article/volume-driven-depreciation-reappears-class-8-market [fetch-extract]
- "Monthly depreciation in 2023 is averaging 4.8%."
- "In the first eight months of 2023, late-model sleepers brought 42.5% less money than the same period of 2022."
- August 2023 auction averages by model year: MY2021 "$63,375", MY2020 "$59,543", MY2019 "$33,469". No retail comparison, no new-truck price.

Relevance: shows used Class 8 values can fall 40%+ in a year in a down cycle. Not a retail-vs-auction spread.

---

## 3. Iron Solutions: dealer retail transactions vs auction (vendor data, ag tractors)
URL: https://ironsolutions.com/are-auction-results-a-good-source-for-tractor-values/
Title: "Are Auction Results a Good Source for Tractor Values?" Publisher: Iron Solutions. Date: June 21, 2021. [fetch-extract; raw curl returned 403]

- "you find sales prices from dealer retail transactions are significantly higher."
- "The average dealer retail price for the Case Maxxum 125 is 15% higher than the same model sold at auction."
- "The Deere 6125's average dealer retail price was 38% over the average auction value."
- "Dealers who rely only on auction data may be too conservative in their expectations on pricing."

DERIVED: auction as % of dealer retail = 1 ÷ 1.15 = 87.0% (Case Maxxum 125) and 1 ÷ 1.38 = 72.5% (Deere 6125). Two models only. Not a market-wide figure.

---

## 4. Ritchie Bros / Rouse market trends (vendor, construction and transportation)
URL: https://blog.ritchiebros.com/july-market-trends-report-q2-2026-construction-transportation-pricing/
Title: "July Market Trends Report: Q2 2026 construction & transportation pricing." Date: August 6, 2026. [fetch-extract]

- U.S. auction: "construction and transportation prices in the U.S. remained about the same compared to the previous quarter (Q1 2026)."
- Rouse retail: "Construction prices in the U.S. are about the same as in the last quarter (Q1 2026)." and "retail transportation showed a decrease of about 1% compared to last quarter."
- **No retail-vs-auction level comparison, no OLV/FMV ratio.** Gives trend only. Not usable for the spread question.

---

## 5. OCC Comptroller's Handbook, "Asset-Based Lending" (regulator)
URL: https://occ.gov/publications-and-resources/publications/comptrollers-handbook/files/asset-based-lending/pub-ch-asset-based-lending.pdf
Version 1.1, January 27, 2017 (reputation-risk references struck March 20, 2025). Downloaded and text-extracted.

- p. 21, "Collateral Appraisals": "An ABL lender typically relies on expert appraisals or valuations performed by companies experienced in inventory and other asset liquidation. The appraisals should provide a NOLV as the standard for collateral valuation, not cost or retail value. The bank's experience in liquidating similar types of collateral should also be considered."
- p. 19, "Other Collateral": "In certain cases, an ABL borrowing base may include fixed assets, such as equipment and real estate ... Such an agreement generally limits the less-liquid collateral to a small percentage of the borrowing base."
- p. 62, Example B (illustrative credit): "Plant and equipment appraised at $2.5 billion (80 percent)." (Read as an 80% advance against appraised P&E. The handbook does not state which value premise.)
- Inventory, for comparison: advance rates cited against NOLV, e.g. "80 percent of the NOLV of inventory" (Example A).
- Glossary p. 74: "Net orderly liquidation value (NOLV): The estimated value a business would receive if assets were liquidated in an orderly manner over a reasonable period, generally six to nine months."
- Glossary p. 73: "Liquidation value: ... Sometimes the liquidation value is based on an orderly liquidation that allows for a brief marketing period, in contrast to a forced liquidation value that is based on an auction sale."
- Glossary p. 74: "Market value: Generally, the most likely price an asset will bring if the asset is sold in a competitive, open market, with reasonable market exposure and willing, informed buyers and sellers."

**The OCC gives no OLV-as-%-of-FMV figure for equipment.** Its position is that collateral should be valued at NOLV, "not cost or retail value." I did not find a separate OCC "Equipment Lending" booklet. Not confirmed whether one exists.

---

## 6. SBA SOP 50 10 8 (federal agency, 7(a) and 504)
URL: https://legacy.sba.gov/sites/default/files/2025-05/SOP%2050%2010%208%20Technical%20Updates%20effective%206.1.2025.docx (the www.sba.gov copy returned 404; SOP 8.1 effective 10/1/2026 also 404). Version 8 with Technical Updates, effective June 1, 2025. Section B, Collateral Requirements for Standard 7(a) Loans.

- "New machinery and equipment (excluding furniture and fixtures) may be valued at no more than 75% of price minus any prior liens for the calculation of "fully secured";"
- "Used or existing machinery and equipment (excluding furniture & fixtures) may be valued at no more than 50% of Net Book Value or 80% with an Orderly Liquidation Appraisal minus any prior liens for the calculation of "fully secured";"
- Same language in the 504 life-insurance discounted-collateral section: "New machinery and equipment (excluding furniture and fixtures) at 75% of price minus any prior liens."

Relevance: the one federal source found that sets a number for NEW equipment against purchase price. It applies a 25% haircut to new, not 0%. This is a "fully secured" test for SBA loans, not a market-value finding.

---

## 7. Appraisal-industry and valuation-provider sources on OLV/FLV vs FMV

### 7a. Maas Companies (auction/liquidation firm, vendor blog)
URL: https://maascompanies.com/blog/article/equipment-valuation-methods-list-for-asset-managers. "Equipment Valuation Methods List for Asset Managers." Date not stated (footer © 2025). [curl-verified]
- Table "Typical Recovery vs. FMV": FMV "100% (baseline)", OLV "60–80%", FLV "40–60%".
- "OLV typically represents 60–80% of FMV for heavy equipment, while FLV can fall to 40–60% depending on asset type and market conditions. Lenders use OLV to size collateral advance rates."
- No data or method cited behind the ranges.

URL: https://maascompanies.com/blog/article/industrial-equipment-value-explained-for-decision-makers [fetch-extract]: "For heavy industrial equipment, that spread can represent 30–50% of asset value." (FMV-to-FLV spread)

### 7b. EquipmentWatch (valuation data provider, vendor)
URL: https://equipmentwatch.com/resource/orderly-liquidation-value/ Undated. [fetch-extract]
- "The OLV for heavy equipment has traditionally held close to the midpoint between a Forced Liquidation Value (no reasonable time) and a Fair Market Value (no time or location constraints)."
- No numeric ratio.

### 7c. Equipment Finance Advisor, "The Case for Orderly Liquidation Value Standards" (Sam Giffin, July 6, 2017)
URL: https://www.equipmentfa.com/blogs/6955/the-case-for-orderly-liquidation-value-standards [fetch-extract]
- "OLV is always less than FMV, since it still represents a liquidation scenario"
- "OLV is always greater than FLV"
- No numeric ratio.

### 7d. Loeb Appraisal, "Where Do You Enter the Value Curve When Lending on M&E?" (John Hagist, ABL Advisor, August 4, 2015)
URL: https://abladvisor.com/blogs/7537/where-do-you-enter-the-value-curve-when-lending-on-me [fetch-extract]
- "For example, a machine costs $100,000 brand new and its FLV at one year is $65,000."
- "A machine costs $75,000 used and its FLV at one year is $65,000."
- Explicitly illustrative. DERIVED: new = FLV at 65% of cost after one year; used = 86.7% of cost.

### Not found / not accessible
- Gordon Brothers, Tiger, Hilco: no public page with an OLV/FMV percentage for equipment found. Tiger SFNet podcast item (Dec 2025) found via search only, no figures.
- SFNet: no public article with equipment NOLV/FMV ratios found.
- Fed / FDIC: not searched to completion. No figure found.
- automa.net "How to Value Idle Industrial Machinery": 403, not loaded.

---

## 8. Question B: first-year value loss on NEW equipment

### 8a. Iowa State University Ag Decision Maker, "Estimating Farm Machinery Costs," File A3-29 (PM 710 Revised March 2026), William Edwards (public university extension)
URL: https://www.extension.iastate.edu/agdm/crops/pdf/a3-29.pdf (fetched via WebFetch, text extracted with pdftotext; direct curl returned 403)

- Method: "The factors were developed from published reports of used equipment auction values, and are estimates of the average "as-is" value of a class of machines in average mechanical condition at the farm."
- Basis: "The appropriate values in Table 1 should be multiplied by the current manufacturer's list price of a replacement machine of equivalent size and type, even if the actual machine was or will be purchased for less than list price."
- Table 1a, "Remaining salvage value as percent of new list price." Source line: "American Society of Agricultural and Biological Engineers (ASABE)."

| Age | 80-149 hp tractor (200/400/600 hrs/yr) | 150+ hp tractor (200/400/600) | Combine, forage harvester (100/300/500) |
|---|---|---|---|
| 1 | 69% / 68% / 68% | 69% / 67% / 66% | 79% / 69% / 63% |
| 2 | 62% / 62% / 61% | 61% / 59% / 58% | 67% / 58% / 52% |
| 3 | 57% / 57% / 56% | 55% / 54% / 52% | 59% / 50% / 45% |

- Caveat: basis is LIST price. Farmers typically buy below list, so loss vs actual purchase price is smaller than these figures imply. The source does not quantify the list-to-transaction discount.

### 8b. SBA SOP 50 10 8 (see section 6)
New M&E valued at no more than 75% of price for the "fully secured" test.

### 8c. Loeb Appraisal illustrative example (see 7d)
New machine: FLV at one year = $65,000 on $100,000 cost. Illustrative, not data.

### 8d. Class 8 trucks
- **No citable new-vs-1-year-old figure found.** J.D. Power free PDFs cover 3-6 yo used sleepers only and give monthly depreciation rates (May 2026 YTD avg retail -1.3%/month, auction -2.1%/month; Aug 2026 YTD retail -0.9%/month, auction +1.0%/month). These apply to used trucks, not a new truck's first year.
- Sandhills 2022 shows newer trucks have tighter asking-auction gaps (MY2019 35% vs MY2016 57% in June 2022).
- ACT Research, FTR: nothing public found.
- truckpartsandservice.com J.D. Power summaries: 403, not loaded.

### 8e. Construction
- Virginia Tech dissertation (Gunnar Lucko, 2003, "A Statistical Analysis and Model of the Residual Value of Different Types of Heavy Construction Equipment"), https://vtechworks.lib.vt.edu/items/1c35ca46-4d19-4547-b807-9dd5b341c973. Abstract loaded: "The response variable was residual value percent, defined as auction price divided by manufacturers suggested retail price." 35,542 auction records, 11 equipment types. **The coefficient tables were not extractable** (PDF download is front matter only; second file is a binary Word/Excel tool). No first-year figure extracted.
- Trade-blog rules of thumb (10-15%/yr) surfaced in search, not loaded, uncited sources. Excluded.

---

## 9. What is and is not answered

**Answered (with citable figures):**
- Ag tractors and combines, asking vs auction: 2026 Sandhills EVI spread 31-33% (tractors 100HP+) and 36-38% (combines). Auction ≈ 62-76% of dealer asking depending on formula reading. Stress peaks: tractors 45% (Jun 2024), combines 57% (Jun 2024).
- Ag tractors, closed dealer retail vs auction: Iron Solutions, two models, retail 15% and 38% above auction (auction ≈ 87% and 72.5% of retail). 2021 data.
- Sleeper trucks and dozers, auction below asking: Sandhills Dec 2021, sleepers 17% (tight market) to 39% (Apr 2020 glut), dozers 24% to 31%, HHP tractors 14% to 22%.
- Regulator stance: OCC says value ABL collateral at NOLV, "not cost or retail value." No equipment ratio given.
- SBA haircut: new M&E 75% of price. Used M&E 50% of NBV or 80% of OLV.
- Vendor appraisal rule of thumb: OLV 60-80% of FMV, FLV 40-60% (Maas, unsourced).
- New ag equipment, year 1: 63-79% of new list price at age 1 (ASABE via Iowa State, auction-based, list-price basis).

**Read against the 15% haircut on used:** every figure on dealer price vs auction, and on FMV vs OLV/FLV, shows a gap wider than 15%. The only exceptions are tight-inventory snapshots: sleepers 17% (Dec 2021), HHP tractors 14% (Dec 2021), and one Iron Solutions model at 15%. Typical 2026 ag gaps are 24-38%. This is a reading of the figures, not a source's conclusion.

**Read against 0% on new:** SBA uses 75% of price for new. ASABE puts age-1 value at 63-79% of list. Loeb's illustration has FLV at 65% of cost at one year. No source found supports valuing new equipment at 100% of invoice for liquidation purposes.

**Not answered:**
- Class 8 retail vs auction in dollars: J.D. Power free PDFs carry dollar levels only in chart images. Retail and auction age bands also differ (3-5 vs 3-6 yo).
- Construction (excavators, loaders) 2026 asking vs auction spread: Sandhills does not publish an EVI spread for construction in the 2026 reports loaded. Only the 2021 dozer figures exist.
- Class 8 new-to-year-1 loss: no public J.D. Power, ACT or FTR figure found.
- Construction new-to-year-1 loss: Lucko coefficients not extractable. No other citable source loaded.
- OLV/FLV % of FMV from a regulator, SFNet or a top-tier appraiser (Gordon Brothers, Tiger, Hilco): none found publicly. Only vendor-blog ranges.
- Sandhills EVI spread formula: not stated explicitly. 2022/2024 wording implies asking ÷ auction − 1. 2026 wording is ambiguous. Confirm with Sandhills before using as a precise haircut.
