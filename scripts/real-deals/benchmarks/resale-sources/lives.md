# Useful-life benchmarks by Tranche equipment type

Extracted 2026-10-09. Every figure is copied from the source document named in its row. Nothing is filled from memory. A blank cell means the source has no such column. `null` means the value was looked for and is not stated, with the reason in the notes.

## Sources and how they were read

| Key | Document | URL | Read as |
|---|---|---|---|
| BEA | BEA Depreciation Estimates (table "BEA Rates of Depreciation, Service Lives, Declining-Balance Rates, and Hulten-Wykoff Categories") | https://apps.bea.gov/national/pdf/BEA_depreciation_rates.pdf | `pdftotext -raw`, one page at a time. "PDF p." is the PDF page (the table is PDF pp. 8-13, footnotes p. 14). "raw-text line" is the line number in the `-raw` output of that page. |
| IRS | IRS Publication 946 (2025), Appendix B, Tables B-1 and B-2 | https://www.irs.gov/pub/irs-pdf/p946.pdf | `pdftotext -layout` and `-table`. PDF page numbers match the printed page numbers (e.g. PDF p. 99 = printed "Publication 946 (2025) 99"). |
| GATX | GATX Corp. Form 10-K, FY ended Dec 31, 2025 | https://www.sec.gov/Archives/edgar/data/40211/000004021126000018/gmt-20251231.htm | HTML to text. "p." is the printed 10-K page number. |
| Ryder | Ryder System, Inc. Form 10-K, FY2025 | https://www.sec.gov/Archives/edgar/data/85961/000008596126000007/r-20251231.htm | Same. |
| URI | United Rentals, Inc. Form 10-K, FY2025 | https://www.sec.gov/Archives/edgar/data/1067701/000106770126000007/uri-20251231.htm | Same. |
| AL | Air Lease Corp. Form 10-K, FY ended Dec 31, 2025 | https://www.sec.gov/Archives/edgar/data/1487712/000162828026007707/al-20251231.htm | Same. |

Column key for every table below:
- **Life**: BEA service life, IRS class life, or the 10-K stated useful life, in years.
- **BEA rate / DB / H-W**: BEA geometric depreciation rate, declining-balance rate, Hulten-Wykoff category.
- **GDS / ADS**: IRS MACRS recovery periods in years.
- **Residual / salvage**: only where a 10-K states it.
- BEA "......" is copied as printed: BEA shows no value for that cell.

## Definitional quotes (verbatim)

### BEA: depreciation rate, service life, declining-balance rate
> "The geometric rates for several types of fixed assets are determined by dividing the appropriate declining-balance rate for each asset by the asset's assumed service life." (PDF p. 1)

> "As with depreciation patterns, service lives should reflect actual experience as closely as possible--separate lives should be used for each industry in which a particular type of asset is purchased, and service lives should be varied over time to account for changes in business conditions and technology. Because of data limitations, the service lives BEA uses fall short of this ideal in two ways. First, service lives can be computed only for those types of assets and industries shown in the table. Second, service lives can be varied over time only for those types of assets and industries shown in the table. All other service lives by type of asset and industry are held constant over time." (PDF p. 2, "Service lives")

> "BEA bases its depreciation patterns on empirical evidence of used asset prices in resale markets wherever possible. For most asset types, geometric patterns are used because the available data suggest that they more closely approximate actual profiles of price declines than straight-line patterns." (PDF p. 1)

> Footnote 2: "Except for missiles and nuclear fuel rods, where an explicit retirement pattern and distribution of service lives is used, the BEA depreciation profiles are for an entire cohort of assets of a given type. When different assets within a cohort have different service lives, the profile for the cohort as a whole will be more convex (accelerated) than the profile for a single asset." (PDF p. 1)

> "Private equipment. BEA's service lives for private equipment are based on service lives obtained from industry studies conducted during the 1970s by the former Office of Industrial Economics (OIE) of the U.S. Department of the Treasury and from industry studies conducted during the 1980s and 1990s by the Office of Tax Analysis (OTA) of the U.S. Department of the Treasury, with the following exceptions: Computers and peripheral equipment; nuclear fuel; light trucks; autos; aircraft purchased by selected industries after 1959; and railroad equipment." (PDF p. 3)

> "Light trucks are assigned an expected service life of 17 years based on research conducted by BEA using data from Wards Automotive Yearbook and the National Automobile Dealers' Association." (PDF p. 3)

> "Research conducted by BEA during the 2003 comprehensive revision indicated that the expected service lives for private aircraft in the industries of air transportation; depository institutions; other credit intermediation; insurance agencies and brokers; offices of bank holding companies and of other holding companies; funds, trusts and other financial vehicles; and rental and leasing should be lengthened. Accordingly, the expected service lives for these aircraft for 1960 forward were extended from 20 to 25 years." (PDF p. 3)

> "The service life for railroad equipment is derived from information on service lives submitted by railroads to the Interstate Commerce Commission as part of the 1983 annual reports of individual railroads." (PDF p. 3)

### BEA: Hulten-Wykoff categories
> "they divided assets into three major types. Type A assets are those for which extensive data were available for estimating geometric rates of depreciation: Tractors (farm and construction), construction machinery, metalworking machinery, general industrial equipment, trucks, commercial buildings, and manufacturing buildings. In 1977, these categories accounted for about 55 percent of investment expenditures on equipment and 42 percent of spending on nonresidential structures." (PDF p. 1)

> "Type B assets are those for which the limited studies on depreciation or other relevant data did not support defensible estimates of the rate of declining balance. For these assets, Hulten and Wykoff used the results of empirical research by others, including the research of BEA, Dale Jorgenson, the Bureau of Labor Statistics, and Jack Faucett Associates, as well as their own judgement to determine the geometric rate of depreciation on a case by case basis." (PDF p. 1)

> "No data were available for Type C assets. Hulten and Wykoff estimated the average declining-balance rates from information on the eight categories of type A assets combined with information on the average life of the type B assets. They determined that, on average, the declining-balance rate for equipment was 1.65 and that for private nonresidential structures was 0.91. These declining-balance rates serve as the rates for assets where no data are available." (PDF p. 2)

> Table footnote 1: "This column refers to Hulten-Wykoff categories. Type A assets are types of assets for which Hulten-Wykoff specifically estimated age-price profiles. Type B assets are those for which Hulten-Wykoff used empirical research by others and their judgement to estimate the depreciation rate. Type C assets are types of assets for which Hulten-Wykoff had no data. For these assets, Hulten-Wykoff estimated an average declining-balance rate from data for all type A and B assets. Assets with missing Hulten-Wykoff categories have depreciation rates that were not estimated by Hulten-Wykoff studies." (PDF p. 14)

### BEA: table footnotes referenced in the rows below (PDF p. 14)
- 2. "For computers and peripheral equipment, information on used asset prices is available and empirical profiles are used. See Fixed Assets and Consumer Durable Goods methodology: M29-M30 on http://www.bea.gov/national/pdf/Fixed_Assets_1925_97.pdf."
- 3. "The declining-balance rate is from the Hulten-Wykoff communications equipment aggregate."
- 4. "Medical and nonmedical Instruments and other private nonresidential equipment, called producer durable equipment by Hulten-Wykoff, are classified by them to be of type C, but appear to be of type B as they were given a declining-balance rate of 1.6203."
- 5. "The declining-balance rate is from the Hulten-Wykoff electrical equipment (not elsewhere classified) aggregate."
- 9. "The declining-balance rate is from the Hulten-Wykoff engines and turbines aggregate."
- 10. "The declining-balance rate is from the Hulten-Wykoff trucks, buses and truck trailer aggregate."
- 11. "The depreciation rate is derived by BEA."
- 12. "Depreciation rates for autos are derived by BEA from data on new and used auto prices."
- 14. "The declining-balance rate is from the Hulten-Wykoff tractors aggregate."
- 18. "The declining-balance rate is from the Hulten-Wykoff public utilities aggregate."
- 19. "The declining-balance rate is from the Hulten-Wykoff mining exploration, shafts and wells aggregate."
- 32. "For most government nonresidential equipment, the declining-balance rate is set to the Hulten-Wykoff producer durable equipment default. Where possible, the rate is set equal to the rate used for comparable equipment in the private sector."

### IRS Pub 946 (2025), Glossary
> "Class life: A number of years that establish the property class and recovery period for most types of property under the General Depreciation System (GDS) and Alternative Depreciation System (ADS)." (PDF p. 109)

> "Recovery period: The number of years over which the basis of an item of property is recovered." (PDF p. 109)

> "Useful life: An estimate of how long an item of property can be expected to be usable in a trade or business or to produce income." (PDF p. 110)

> "Salvage value: An estimated value of property at the end of its useful life. Not used under MACRS." (PDF p. 110)

> Appendix B, How To Use the Tables: "Generally, if the property is listed in Table B-1, you use the recovery period shown in that table. However, if the property is specifically listed in Table B-2 under the type of activity in which it is used, you use the recovery period listed under the activity in that table." (PDF p. 98)

### 10-K definitions of useful life and residual / salvage
> GATX: "We state operating assets, including assets acquired under finance leases, at cost and depreciate them over their estimated economic useful lives to an estimated residual value using the straight-line method. We determine the economic useful life based on our estimate of the period over which the asset will generate revenue. For the majority of our operating assets, the economic useful life is greater than 30 years." (MD&A, Critical Accounting Estimates, p. 50)

> Ryder: "Vehicle Residual Values. At the time we acquire a vehicle, we estimate the residual value at the end of its useful life. These estimates determine the depreciation that will be recognized evenly (straight-line) over the vehicle's useful life and are intended to minimize losses or to record the best estimate of fair value at the end of a vehicle's useful life." (MD&A, Critical Accounting Estimates, p. 40)

> United Rentals: "The useful life of an asset is determined based on our estimate of the period over which the asset can generate revenues; such periods are periodically reviewed for reasonableness. In addition, the salvage value, which is also reviewed periodically for reasonableness, is determined based on our estimate of the minimum value we will realize from the asset after such period." (MD&A, Critical Accounting Policies, p. 32)

> Air Lease: "We depreciate our aircraft for accounting purposes on a straight-line basis to the aircraft's residual value over its estimated useful life." (Item 1A Risk Factors)

Note: 10-K lives are accounting (book) lives to an estimated residual. IRS lives are tax recovery periods. BEA lives are mean service lives for a cohort, used with a geometric (not straight-line) profile. They measure different things and should not be averaged together.

---

## 1. Heavy Machinery (model: 10-20 years)

| Source | Asset / class | Life (yrs) | BEA rate | BEA DB | BEA H-W | GDS | ADS | Residual / salvage | Citation |
|---|---|---|---|---|---|---|---|---|---|
| BEA | General industrial, incl. materials handling equipment: Nonmanufacturing industries | 16 | 0.1072 | 1.715 | A | | | | PDF p.9, raw-text line 32 |
| BEA | General industrial, incl. materials handling: Durable mfg: Wood products | 12 | 0.1429 | 1.715 | A | | | | PDF p.9, raw-text line 34 |
| BEA | General industrial, incl. materials handling: Durable mfg: Nonmetallic mineral products | 19 | 0.0903 | 1.715 | A | | | | PDF p.9, raw-text line 35 |
| BEA | General industrial, incl. materials handling: Durable mfg: Primary metals | 27 | 0.0635 | 1.715 | A | | | | PDF p.9, raw-text line 36 |
| BEA | General industrial, incl. materials handling: Durable mfg: Fabricated metal products | 24 | 0.0715 | 1.715 | A | | | | PDF p.9, raw-text line 37 |
| BEA | General industrial, incl. materials handling: Durable mfg: Machinery | 25 | 0.0686 | 1.715 | A | | | | PDF p.9, raw-text line 38 |
| BEA | General industrial, incl. materials handling: Durable mfg: Computer and electronic products | 14 | 0.1225 | 1.715 | A | | | | PDF p.9, raw-text line 39 |
| BEA | General industrial, incl. materials handling: Durable mfg: Electronic equipment, appliances, and components | 14 | 0.1225 | 1.715 | A | | | | PDF p.9, raw-text line 40 |
| BEA | General industrial, incl. materials handling: Durable mfg: Motor vehicles, bodies and trailers, and parts | 14 | 0.1225 | 1.715 | A | | | | PDF p.9, raw-text line 41 |
| BEA | General industrial, incl. materials handling: Durable mfg: Other transportation equipment | 17 | 0.1009 | 1.715 | A | | | | PDF p.9, raw-text line 42 |
| BEA | General industrial, incl. materials handling: Durable mfg: Furniture and related products | 14 | 0.1225 | 1.715 | A | | | | PDF p.9, raw-text line 43 |
| BEA | General industrial, incl. materials handling: Misc. mfg: Medical equipment and supplies | 14 | 0.1225 | 1.715 | A | | | | PDF p.9, raw-text line 45 |
| BEA | General industrial, incl. materials handling: Misc. mfg: Other | 17 | 0.1009 | 1.715 | A | | | | PDF p.9, raw-text line 46 |
| BEA | General industrial, incl. materials handling: Nondurable mfg: Food | 20 | 0.0858 | 1.715 | A | | | | PDF p.9, raw-text line 49 |
| BEA | General industrial, incl. materials handling: Nondurable mfg: Beverage and tobacco product | 21 | 0.0817 | 1.715 | A | | | | PDF p.9, raw-text line 50 |
| BEA | General industrial, incl. materials handling: Nondurable mfg: Textile and textile product mills | 16 | 0.1072 | 1.715 | A | | | | PDF p.9, raw-text line 51 |
| BEA | General industrial, incl. materials handling: Nondurable mfg: Apparel and leather and allied products | 15 | 0.1143 | 1.715 | A | | | | PDF p.9, raw-text line 52 |
| BEA | General industrial, incl. materials handling: Nondurable mfg: Paper products | 16 | 0.1072 | 1.715 | A | | | | PDF p.9, raw-text line 53 |
| BEA | General industrial, incl. materials handling: Nondurable mfg: Printing and related support activities | 15 | 0.1143 | 1.715 | A | | | | PDF p.9, raw-text line 54 |
| BEA | General industrial, incl. materials handling: Nondurable mfg: Petroleum and coal products | 22 | 0.0780 | 1.715 | A | | | | PDF p.9, raw-text line 55 |
| BEA | General industrial, incl. materials handling: Nondurable mfg: Chemical | 16 | 0.1072 | 1.715 | A | | | | PDF p.9, raw-text line 56 |
| BEA | General industrial, incl. materials handling: Nondurable mfg: Plastics and rubber products | 14 | 0.1225 | 1.715 | A | | | | PDF p.9, raw-text line 57 |
| BEA | Metalworking machinery: Nonmanufacturing industries | 16 | 0.1225 | 1.96 | A | | | | PDF p.8, raw-text line 23 |
| BEA | Metalworking machinery: Durable mfg: Wood products | 12 | 0.1633 | 1.96 | A | | | | PDF p.8, raw-text line 25 |
| BEA | Metalworking machinery: Durable mfg: Nonmetallic mineral products | 19 | 0.1032 | 1.96 | A | | | | PDF p.8, raw-text line 26 |
| BEA | Metalworking machinery: Durable mfg: Primary metals | 27 | 0.0726 | 1.96 | A | | | | PDF p.8, raw-text line 27 |
| BEA | Metalworking machinery: Durable mfg: Fabricated metal products | 24 | 0.0817 | 1.96 | A | | | | PDF p.8, raw-text line 28 |
| BEA | Metalworking machinery: Durable mfg: Machinery | 25 | 0.0784 | 1.96 | A | | | | PDF p.8, raw-text line 29 |
| BEA | Metalworking machinery: Durable mfg: Computer and electronic products | 14 | 0.1400 | 1.96 | A | | | | PDF p.8, raw-text line 30 |
| BEA | Metalworking machinery: Durable mfg: Electronic equipment, appliances, and components | 14 | 0.1400 | 1.96 | A | | | | PDF p.8, raw-text line 31 |
| BEA | Metalworking machinery: Durable mfg: Motor vehicles, bodies and trailers, and parts | 14 | 0.1400 | 1.96 | A | | | | PDF p.8, raw-text line 32 |
| BEA | Metalworking machinery: Durable mfg: Other transportation equipment | 17 | 0.1153 | 1.96 | A | | | | PDF p.8, raw-text line 33 |
| BEA | Metalworking machinery: Durable mfg: Furniture and related products | 14 | 0.1400 | 1.96 | A | | | | PDF p.8, raw-text line 34 |
| BEA | Metalworking machinery: Misc. mfg: Medical equipment and supplies | 14 | 0.1400 | 1.96 | A | | | | PDF p.8, raw-text line 36 |
| BEA | Metalworking machinery: Misc. mfg: Other | 17 | 0.1153 | 1.96 | A | | | | PDF p.8, raw-text line 37 |
| BEA | Metalworking machinery: Nondurable mfg: Food | 20 | 0.0980 | 1.96 | A | | | | PDF p.8, raw-text line 40 |
| BEA | Metalworking machinery: Nondurable mfg: Beverage and tobacco product | 21 | 0.0933 | 1.96 | A | | | | PDF p.8, raw-text line 41 |
| BEA | Metalworking machinery: Nondurable mfg: Textile and textile product mills | 16 | 0.1225 | 1.96 | A | | | | PDF p.8, raw-text line 42 |
| BEA | Metalworking machinery: Nondurable mfg: Apparel and leather and allied products | 15 | 0.1307 | 1.96 | A | | | | PDF p.8, raw-text line 43 |
| BEA | Metalworking machinery: Nondurable mfg: Paper products | 16 | 0.1225 | 1.96 | A | | | | PDF p.8, raw-text line 44 |
| BEA | Metalworking machinery: Nondurable mfg: Printing and related support activities | 15 | 0.1307 | 1.96 | A | | | | PDF p.8, raw-text line 45 |
| BEA | Metalworking machinery: Nondurable mfg: Petroleum and coal products | 22 | 0.0891 | 1.96 | A | | | | PDF p.8, raw-text line 46 |
| BEA | Metalworking machinery: Nondurable mfg: Chemical | 16 | 0.1225 | 1.96 | A | | | | PDF p.8, raw-text line 47 |
| BEA | Metalworking machinery: Nondurable mfg: Plastics and rubber products | 14 | 0.1400 | 1.96 | A | | | | PDF p.8, raw-text line 48 |
| BEA | Special industry machinery, nec: Nonmanufacturing industries | 16 | 0.1031 | 1.65 | C | | | | PDF p.9, raw-text line 5 |
| BEA | Special industry machinery, nec: Durable mfg: Wood products | 12 | 0.1375 | 1.65 | C | | | | PDF p.9, raw-text line 7 |
| BEA | Special industry machinery, nec: Durable mfg: Nonmetallic mineral products | 19 | 0.0868 | 1.65 | C | | | | PDF p.9, raw-text line 8 |
| BEA | Special industry machinery, nec: Durable mfg: Primary metals | 27 | 0.0611 | 1.65 | C | | | | PDF p.9, raw-text line 9 |
| BEA | Special industry machinery, nec: Durable mfg: Fabricated metal products | 24 | 0.0688 | 1.65 | C | | | | PDF p.9, raw-text line 10 |
| BEA | Special industry machinery, nec: Durable mfg: Machinery | 25 | 0.0660 | 1.65 | C | | | | PDF p.9, raw-text line 11 |
| BEA | Special industry machinery, nec: Durable mfg: Computer and electronic products | 14 | 0.1179 | 1.65 | C | | | | PDF p.9, raw-text line 12 |
| BEA | Special industry machinery, nec: Durable mfg: Electronic equipment, appliances, and components | 14 | 0.1179 | 1.65 | C | | | | PDF p.9, raw-text line 13 |
| BEA | Special industry machinery, nec: Durable mfg: Motor vehicles, bodies and trailers, and parts | 14 | 0.1179 | 1.65 | C | | | | PDF p.9, raw-text line 14 |
| BEA | Special industry machinery, nec: Durable mfg: Other transportation equipment | 17 | 0.0971 | 1.65 | C | | | | PDF p.9, raw-text line 15 |
| BEA | Special industry machinery, nec: Durable mfg: Furniture and related products | 14 | 0.1179 | 1.65 | C | | | | PDF p.9, raw-text line 16 |
| BEA | Special industry machinery, nec: Misc. mfg: Medical equipment and supplies | 14 | 0.1179 | 1.65 | C | | | | PDF p.9, raw-text line 18 |
| BEA | Special industry machinery, nec: Misc. mfg: Other | 17 | 0.0971 | 1.65 | C | | | | PDF p.9, raw-text line 19 |
| BEA | Special industry machinery, nec: Nondurable mfg: Food | 20 | 0.0825 | 1.65 | C | | | | PDF p.9, raw-text line 22 |
| BEA | Special industry machinery, nec: Nondurable mfg: Beverage and tobacco product | 21 | 0.0786 | 1.65 | C | | | | PDF p.9, raw-text line 23 |
| BEA | Special industry machinery, nec: Nondurable mfg: Textile and textile product mills | 16 | 0.1031 | 1.65 | C | | | | PDF p.9, raw-text line 24 |
| BEA | Special industry machinery, nec: Nondurable mfg: Apparel and leather and allied products | 15 | 0.1100 | 1.65 | C | | | | PDF p.9, raw-text line 25 |
| BEA | Special industry machinery, nec: Nondurable mfg: Paper products | 16 | 0.1031 | 1.65 | C | | | | PDF p.9, raw-text line 26 |
| BEA | Special industry machinery, nec: Nondurable mfg: Printing and related support activities | 15 | 0.1100 | 1.65 | C | | | | PDF p.9, raw-text line 27 |
| BEA | Special industry machinery, nec: Nondurable mfg: Petroleum and coal products | 22 | 0.0750 | 1.65 | C | | | | PDF p.9, raw-text line 28 |
| BEA | Special industry machinery, nec: Nondurable mfg: Chemical | 16 | 0.1031 | 1.65 | C | | | | PDF p.9, raw-text line 29 |
| BEA | Special industry machinery, nec: Nondurable mfg: Plastics and rubber products | 14 | 0.1179 | 1.65 | C | | | | PDF p.9, raw-text line 30 |
| BEA | Mining and oil field machinery | 11 | 0.1500 | 1.65 | C | | | | PDF p.10, raw-text line 25 |
| BEA | Farm tractors /14/ | 9 | 0.1452 | 1.3064 | A | | | | PDF p.10, raw-text line 21 |
| BEA | Agricultural machinery, except tractors | 14 | 0.1179 | 1.65 | C | | | | PDF p.10, raw-text line 22 |
| BEA | State and local govt: Miscellaneous metal products | 18 | 0.0917 | 1.65 | C | | | | PDF p.13, raw-text line 6 |
| BEA | State and local govt: Agricultural machinery and equipment | 9 | 0.1833 | 1.65 | C | | | | PDF p.13, raw-text line 7 |
| BEA | State and local govt: Metalworking machinery and equipment | 16 | 0.1031 | 1.65 | C | | | | PDF p.13, raw-text line 9 |
| BEA | State and local govt: General purpose machinery and equipment | 11 | 0.1500 | 1.65 | C | | | | PDF p.13, raw-text line 10 |
| BEA | State and local govt: Special industry machinery and equipment | 11 | 0.1500 | 1.65 | C | | | | PDF p.13, raw-text line 11 |
| IRS | 00.4 Industrial Steam and Electric Generation and/or Distribution Systems | 22 | | | | 15 | 22 | | Table B-1, PDF p. 99 |
| IRS | 01.1 Agriculture: "Includes machinery and equipment, grain bins, and fences but no other land improvements, that are used in the production of crops or plants, vines, and trees; livestock; ..." | 10 | | | | 7 (footnote 4) | 10 | | Table B-2, PDF p. 100. Footnote 4: "5 if machinery and equipment used in a farming business (other than any grain bin, cotton ginning asset, fence, or other land improvement) placed in service after 2017, in tax years ending after 2017." |
| IRS | 10.0 Mining: "Includes assets used in the mining and quarrying of metallic and nonmetallic minerals (including sand, gravel, stone, and clay) and the milling, beneficiation, and other primary preparation of such materials." | 10 | | | | 7 | 10 | | Table B-2, PDF p. 100 (not in the requested list, included as the mining-machinery class) |
| IRS | 13.0 Offshore Drilling | 7.5 | | | | 5 | 7.5 | | Table B-2, PDF p. 100 |
| IRS | 13.1 Drilling of Oil and Gas Wells | 6 | | | | 5 | 6 | | Table B-2, PDF p. 100 |
| IRS | 13.2 Exploration for and Production of Petroleum and Natural Gas Deposits | 14 | | | | 7 | 14 | | Table B-2, PDF p. 100 |
| IRS | 13.3 Petroleum Refining | 16 | | | | 10 | 16 | | Table B-2, PDF p. 100 |
| URI | Rental equipment (all categories; no breakdown by equipment type) | 2 to 20 | | | | | | 0 to 50% of cost; weighted average 12% of cost | Note 2, Rental Equipment, p. 51 |

URI quote: "Rental equipment, which includes service and delivery vehicles, is recorded at cost and depreciated over the estimated useful life of the equipment using the straight-line method. The range of estimated useful lives for rental equipment is two to 20 years. Rental equipment is depreciated to a salvage value of zero to 50 percent of cost. The weighted average salvage value of our rental equipment is 12 percent of cost. Rental equipment is depreciated whether or not it is out on rent." (Note 2, p. 51)

URI sensitivity quote: "To the extent that the useful lives of all of our rental equipment were to increase or decrease by one year, we estimate that our annual depreciation expense would decrease or increase by approximately $311 or $410, respectively. If the estimated salvage values of all of our rental equipment were to increase or decrease by one percentage point, we estimate that our annual depreciation expense would change by approximately $30." (MD&A, p. 32. Dollar units as printed. Not checked whether the 10-K states these in millions.)

Notes:
- BEA has no row named "heavy machinery". The rows above are the BEA machinery categories that fit: general industrial (incl. materials handling), metalworking, special industry machinery, mining and oil field machinery, plus agricultural rows, since the model has no agricultural type.
- URI 10-K gives one range for its whole rental fleet. Lives and salvage by equipment category (aerial, earthmoving, etc.): `null`, not disclosed in the 10-K.

## 2. Vehicles / Fleet (model: 5-8 years)

| Source | Asset / class | Life (yrs) | BEA rate | BEA DB | BEA H-W | GDS | ADS | Residual / salvage | Citation |
|---|---|---|---|---|---|---|---|---|---|
| BEA | Trucks, buses, and truck trailers: Years before 1992: Transit and ground passenger transportation /10/ | 14 | 0.1232 | 1.7252 | A | | | | PDF p.9, raw-text line 61 |
| BEA | Trucks, buses, and truck trailers: Years before 1992: Trucking and other services /10/ | 10 | 0.1725 | 1.7252 | A | | | | PDF p.9, raw-text line 62 |
| BEA | Trucks, buses, and truck trailers: Years before 1992: Other industries | 9 | 0.1917 | 1.7252 | A | | | | PDF p.9, raw-text line 63 |
| BEA | Trucks, buses, and truck trailers: 1992 and later years: Light trucks /11/ | 17 | 0.1925 | 3.2725 | ...... | | | | PDF p.9, raw-text line 65 |
| BEA | Trucks, buses, and truck trailers: 1992 and later years: Other trucks, buses, and truck trailers: Transit and ground passenger transportation /10/ | 14 | 0.1232 | 1.7252 | A | | | | PDF p.9, raw-text line 67 |
| BEA | Trucks, buses, and truck trailers: 1992 and later years: Other trucks, buses, and truck trailers: Trucking and other services /10/ | 10 | 0.1725 | 1.7252 | A | | | | PDF p.9, raw-text line 68 |
| BEA | Trucks, buses, and truck trailers: 1992 and later years: Other trucks, buses, and truck trailers: Other industries | 9 | 0.1917 | 1.7252 | A | | | | PDF p.9, raw-text line 69 |
| BEA | Autos /12/ | ...... | ...... | ...... | ...... | | | | PDF p.10, raw-text line 4 |
| BEA | Federal national defense: Noncombat vehicles: Trucks | 6 | 0.2875 | 1.7252 | C | | | | PDF p.12, raw-text line 39 |
| BEA | Federal national defense: Noncombat vehicles: Other (row printed as "Autos /34/" with no values, then "Other") | 7 | 0.2465 | 1.7252 | C | | | | PDF p.12, raw-text line 41 |
| BEA | Federal nondefense, general government: Vehicles | 5 | 0.4533 | 2.2664 | C | | | | PDF p.12, raw-text line 59 |
| BEA | Federal nondefense, US Postal Service: Vehicles | 7 | 0.3238 | 2.2664 | C | | | | PDF p.12, raw-text line 64 |
| BEA | State and local govt: Motor vehicles | 10 | 0.1650 | 1.65 | C | | | | PDF p.13, raw-text line 25 |
| IRS | 00.22 Automobiles, Taxis | 3 | | | | 5 | 5 | | Table B-1, PDF p. 99 |
| IRS | 00.23 Buses | 9 | | | | 5 | 9 | | Table B-1, PDF p. 99 |
| IRS | 00.241 Light General Purpose Trucks: "Includes trucks for use over the road (actual weight less than 13,000 pounds)" | 4 | | | | 5 | 5 | | Table B-1, PDF p. 99 |
| IRS | 00.242 Heavy General Purpose Trucks: "Includes heavy general purpose trucks, concrete ready mix-trucks, and ore trucks, for use over the road (actual unloaded weight 13,000 pounds or more)" | 6 | | | | 5 | 6 | | Table B-1, PDF p. 99 |
| IRS | 00.26 Tractor Units for Use Over-the-Road | 4 | | | | 3 | 4 | | Table B-1, PDF p. 99 |
| IRS | 00.27 Trailers and Trailer-Mounted Containers | 6 | | | | 5 | 6 | | Table B-1, PDF p. 99 |
| IRS | 41.0 Motor Transport--Passengers | 8 | | | | 5 | 8 | | Table B-2, PDF p. 105 |
| IRS | 42.0 Motor Transport--Freight | 8 | | | | 5 | 8 | | Table B-2, PDF p. 105 |
| Ryder | Revenue earning equipment: Trucks | 3 — 7 | | | | | | null | Note 6, Revenue Earning Equipment, Net, p. 74 |
| Ryder | Revenue earning equipment: Tractors | 4 — 7.5 | | | | | | null | Note 6, p. 74 |
| Ryder | Revenue earning equipment: Trailers and other | 9.5 — 12 | | | | | | null | Note 6, p. 74 |

Ryder residual quotes:
> "Effective January 1, 2025, we made an immaterial adjustment to certain vehicles' estimated residual values based on this review. In 2024 and 2023, we did not adjust the estimated residual values of existing revenue earning equipment. Effective January 1, 2026, we expect to reduce the estimated residual values for certain tractors based on our review." (MD&A, Critical Accounting Estimates, p. 40)

> "Based on our fleet of revenue earning equipment as of December 31, 2025, a hypothetical 10% reduction in estimated residual values would increase depreciation expense over the remaining life of our fleet by approximately $340 million. The current residual value estimates of our total fleet are at historically low levels." (p. 40)

> "Our review of the estimated residual values of revenue earning equipment is based on vehicle class (generally subcategories of trucks, tractors and trailers by weight and usage), historical and current market prices, third-party expected future market prices, expected lives of vehicles, and expected sales in the wholesale or retail markets, among other factors." (Note 6, p. 74)

> Lease terms: "We lease revenue earning equipment to customers for periods generally ranging from three to seven years for trucks and tractors and up to ten years for trailers." (Note 1, p. 66)

Notes:
- Ryder residual % by vehicle class: `null`. The FY2025 10-K does not state residual values as a percent of cost. It gives only the sensitivity and the "historically low levels" statement above.
- BEA autos row has no values ("......"). Footnote 12 says auto rates are derived from new and used auto prices, with no service life stated.

## 3. Rail Cars (model: 25-35 years)

| Source | Asset / class | Life (yrs) | BEA rate | BEA DB | BEA H-W | GDS | ADS | Residual / salvage | Citation |
|---|---|---|---|---|---|---|---|---|---|
| BEA | Railroad equipment | 28 | 0.0589 | 1.65 | C | | | | PDF p.10, raw-text line 18 |
| BEA | State and local govt: Railroad equipment | 28 | 0.0590 | 1.65 | C | | | | PDF p.13, raw-text line 28 |
| IRS | 00.25 Railroad Cars and Locomotives, except those owned by railroad transportation companies | 15 | | | | 7 | 15 | | Table B-1, PDF p. 99 |
| IRS | 40.1 Railroad Machinery and Equipment (includes ICC equipment accounts (52) Locomotives, (53) Freight train cars, (54) Passenger train cars, (57) Work equipment) | 14 | | | | 7 | 14 | | Table B-2, PDF p. 105 |
| GATX | Railcars (company-wide depreciable life) | 15–45 | | | | | | null | Note 3, Operating Assets and Facilities, p. 67 |
| GATX | Locomotives | 10–20 | | | | | | null | Note 3, p. 67 |
| GATX | Tank containers (Trifleet) | 15–25 | | | | | | null | Note 3, p. 67 |
| GATX | Rail North America railcars: "estimated economic useful lives of 27 to 45 years and an average age of approximately 17 years" | 27 to 45 | | | | | | null | Item 1, Business, p. 4 |
| GATX | GATX Rail Europe railcars: "36,484 railcars with estimated useful lives of 32 to 40 years and an average age of approximately 17 years" | 32 to 40 | | | | | | null | Item 1, p. 5 |
| GATX | Rail India railcars: "12,165 railcars with estimated useful lives of 15 to 30 years" | 15 to 30 | | | | | | null | Item 1, p. 5 |

Notes:
- GATX residual % : `null`. The 10-K says assets are depreciated "to estimated residual values using the straight-line method" (Note 3, p. 67) but gives no percent. The only residual figure is the finance-lease line "Estimated unguaranteed residual value of leased assets": 9.4 (2025) and 17.2 (2024), in millions (Note 5, Leases, finance lease components table), which is a dollar balance, not a rate.

## 4. Marine Vessels (model: 15-25 years)

| Source | Asset / class | Life (yrs) | BEA rate | BEA DB | BEA H-W | GDS | ADS | Residual / salvage | Citation |
|---|---|---|---|---|---|---|---|---|---|
| BEA | Ships and boats | 27 | 0.0611 | 1.65 | B | | | | PDF p.10, raw-text line 17 |
| BEA | Federal national defense: Ships: Surface ships | 30 | 0.0550 | 1.65 | C | | | | PDF p.12, raw-text line 27 |
| BEA | Federal national defense: Ships: Submarines | 25 | 0.0660 | 1.65 | C | | | | PDF p.12, raw-text line 28 |
| IRS | 00.28 Vessels, Barges, Tugs, and Similar Water Transportation Equipment, except those used in marine construction | 18 | | | | 10 | 18 | | Table B-1, PDF p. 99 |
| IRS | 44.0 Water Transportation: "Includes assets used in the commercial and contract carrying of freight and passengers by water, except the transportation assets included in classes with the prefix 00.2. Includes all related land improvements." | 20 | | | | 15 | 20 | | Table B-2, PDF p. 105 |
| IRS | 13.0 Offshore Drilling (includes "floating, self-propelled and other drilling vessels, barges, platforms, and drilling equipment and support vessels such as tenders, barges, towboats, and crewboats") | 7.5 | | | | 5 | 7.5 | | Table B-2, PDF p. 100 |

Notes:
- No marine 10-K was in scope. 10-K life and residual for vessels: `null`.

## 5. Aircraft / Helicopters (model: 12-20 years)

| Source | Asset / class | Life (yrs) | BEA rate | BEA DB | BEA H-W | GDS | ADS | Residual / salvage | Citation |
|---|---|---|---|---|---|---|---|---|---|
| BEA | Aircraft: Years before 1960: Air transportation, depository institutions, other credit intermediation, and rental and leasing | 16 | 0.1031 | 1.65 | C | | | | PDF p.10, raw-text line 8 |
| BEA | Aircraft: Years before 1960: Other industries | 12 | 0.1375 | 1.65 | C | | | | PDF p.10, raw-text line 9 |
| BEA | Aircraft: 1960 and later years: Air transportation, depository institutions, other credit intermediation, insurance agencies and brokers, offices of bank holding companies and of other holding companies, funds, trusts and other financial vehicles, and rental and leasing /11/ | 25 | 0.0660 | 1.65 | ...... | | | | PDF p.10, raw-text line 15 |
| BEA | Aircraft: 1960 and later years: Other industries | 15 | 0.1100 | 1.65 | C | | | | PDF p.10, raw-text line 16 |
| BEA | Federal national defense: Aircraft: Airframes: Bombers | 25 | 0.0660 | 1.65 | C | | | | PDF p.12, raw-text line 9 |
| BEA | Federal national defense: Aircraft: Airframes: F-14 type | 19 | 0.0868 | 1.65 | C | | | | PDF p.12, raw-text line 10 |
| BEA | Federal national defense: Aircraft: Airframes: Attack, F-15 and F-16 types | 20 | 0.0825 | 1.65 | C | | | | PDF p.12, raw-text line 11 |
| BEA | Federal national defense: Aircraft: Airframes: F-18 type | 15 | 0.1100 | 1.65 | C | | | | PDF p.12, raw-text line 12 |
| BEA | Federal national defense: Aircraft: Airframes: Electronic warfare | 23 | 0.0717 | 1.65 | C | | | | PDF p.12, raw-text line 13 |
| BEA | Federal national defense: Aircraft: Airframes: Cargo and trainers | 25 | 0.0660 | 1.65 | C | | | | PDF p.12, raw-text line 14 |
| BEA | Federal national defense: Aircraft: Airframes: Helicopters | 20 | 0.0825 | 1.65 | C | | | | PDF p.12, raw-text line 15 |
| BEA | Federal national defense: Aircraft: Engines | 6 | 0.2750 | 1.65 | C | | | | PDF p.12, raw-text line 16 |
| BEA | Federal nondefense, general government: Aerospace equipment | 15 | 0.1100 | 1.65 | C | | | | PDF p.12, raw-text line 58 |
| BEA | State and local govt: Aircraft | 15 | 0.1100 | 1.65 | C | | | | PDF p.13, raw-text line 27 |
| IRS | 00.21 Airplanes (airframes and engines), except those used in commercial or contract carrying of passengers or freight, and all helicopters (airframes and engines) | 6 | | | | 5 | 6 | | Table B-1, PDF p. 99 |
| IRS | 45.0 Air Transport: "Includes assets (except helicopters) used in commercial and contract carrying of passengers and freight by air." | 12 | | | | 7 | 12 | | Table B-2, PDF p. 105 |
| IRS | 45.1 Air Transport (restricted): assets in 45.0 held on April 15, 1976 or acquired under a contract binding on that date | 6 | | | | 5 | 6 | | Table B-2, PDF p. 105 |
| AL | Passenger aircraft | 25 (from date of manufacture) | | | | | | 15% residual value | Note 1, Summary of Significant Accounting Policies, p. 79; same text in MD&A Critical Accounting Estimates, p. 64 |
| AL | Freighter aircraft | 35 (from date of manufacture) | | | | | | 15% residual value | Note 1, p. 79; MD&A p. 64 |
| GATX | Aircraft spare engines (GEL / RRPF) | 25–30 | | | | | | null | Note 3, p. 67; Item 1, p. 6 |

Air Lease quotes:
> "The Company generally depreciates passenger aircraft on a straight-line basis over a 25-year life from the date of manufacture to a 15% residual value. The Company generally depreciates freighter aircraft on a straight-line basis over a 35-year life from the date of manufacture to a 15% residual value. Changes in the assumption of useful lives or residual values for aircraft could have a significant impact on the Company's results of operations and financial condition." (Note 1, p. 79)

> "we primarily order new planes directly from the manufacturers, place them on long-term leases, and sell the aircraft when they near the end of the first third of their expected 25-year economic useful life." (Item 1, Business, p. 11)

Notes:
- No helicopter 10-K was in scope. Helicopter-specific book life and residual: `null`. The only helicopter rows are BEA federal defense "Helicopters" (20 years) and IRS 00.21 (all helicopters, class life 6).

## 6. Medical Equipment (model: 7-12 years)

| Source | Asset / class | Life (yrs) | BEA rate | BEA DB | BEA H-W | GDS | ADS | Residual / salvage | Citation |
|---|---|---|---|---|---|---|---|---|---|
| BEA | Medical equipment and instruments: Medical instruments /4/ | 12 | 0.1350 | 1.6203 | C | | | | PDF p.8, raw-text line 12 |
| BEA | Medical equipment and instruments: Electromedical equipment /5/ | 9 | 0.1834 | 1.65 | C | | | | PDF p.8, raw-text line 13 |
| BEA | Federal national defense: Other equipment: Medical | 9 | 0.1834 | 1.65 | C | | | | PDF p.12, raw-text line 47 |
| BEA | State and local govt: Integrating and measuring instruments | 12 | 0.1375 | 1.65 | C | | | | PDF p.13, raw-text line 12 |
| IRS | 57.0 Distributive Trades and Services: "Includes assets used in wholesale and retail trade, and personal and professional services." | 9 | | | | 5 | 9 | | Table B-2, PDF p. 108 |
| IRS | High technology medical equipment: "Any high technology medical equipment as defined in section 168(i)(2)(C) which is described in asset guideline class 57.0 is assigned a 5-year recovery period for the alternate MACRS method." | | | | | | 5 | | Table B-2 footnote, PDF p. 108 |
| IRS | Certain Property for Which Recovery Periods Assigned, A. Personal Property With No Class Life | | | | | 7 | 12 | | Table B-2, PDF p. 108 |

Notes:
- IRS Appendix B has no asset class dedicated to medical equipment. The 57.0 footnote above is the only medical-equipment mention in the tables. (Class 22.3 "Manufacture of ... Medical and Dental Supplies", PDF p. 101, covers manufacturing assets, not medical equipment in use, so it is excluded.)
- BEA names the rows "Medical instruments" and "Electromedical equipment". There is no row literally titled "nonelectro medical instruments".
- No medical 10-K was in scope. 10-K life and residual: `null`.

## 7. IT / Data Center (model: 3-7 years)

| Source | Asset / class | Life (yrs) | BEA rate | BEA DB | BEA H-W | GDS | ADS | Residual / salvage | Citation |
|---|---|---|---|---|---|---|---|---|---|
| BEA | Computers and peripheral equipment /2/ | ...... | ...... | ...... | ...... | | | | PDF p.8, raw-text line 5 |
| BEA | Communications equipment: Rental and leasing and computer systems design and related services /3/ | 11 | 0.1500 | 1.65 | C | | | | PDF p.8, raw-text line 8 |
| BEA | Communications equipment: Other industries /3/ | 15 | 0.1100 | 1.65 | C | | | | PDF p.8, raw-text line 9 |
| BEA | Office and accounting equipment: Years before 1978 | 8 | 0.2729 | 2.1832 | B | | | | PDF p.8, raw-text line 16 |
| BEA | Office and accounting equipment: 1978 and later years | 7 | 0.3119 | 2.1832 | B | | | | PDF p.8, raw-text line 17 |
| BEA | Federal national defense: Electronic equipment: Computers and peripheral equipment /2/ | ...... | ...... | ...... | ...... | | | | PDF p.12, raw-text line 43 |
| BEA | State and local govt: Electronic components and accessories | 9 | 0.1833 | 1.65 | C | | | | PDF p.13, raw-text line 15 |
| BEA | State and local govt: Calculating and accounting machines | 7 | 0.2357 | 1.65 | C | | | | PDF p.13, raw-text line 17 |
| BEA | State and local govt: Computers and peripheral equipment /2/ | ...... | ...... | ...... | ...... | | | | PDF p.13, raw-text line 19 |
| IRS | 00.12 Information Systems: "Includes computers and their peripheral equipment used in administering normal business transactions and the maintenance of business records, their retrieval and analysis." | 6 | | | | 5 | 5 | | Table B-1, PDF p. 99 |
| IRS | 00.13 Data Handling Equipment; except Computers: "Includes only typewriters, calculators, adding and accounting machines, copiers, and duplicating equipment." | 6 | | | | 5 | 6 | | Table B-1, PDF p. 99 |
| IRS | Certain Property for Which Recovery Periods Assigned, B. Qualified Technological Equipment, as defined in section 168(i)(2) | | | | | 5 | 5 | | Table B-2, PDF p. 108 |

IRS 00.12 exclusion, verbatim: "Does not incude equipment that is an integral part of other capital equipment that is included in other classes of economic activity, that is, computers used primarily for process or production control, switching, channeling, and automating distributive trades and services such as point of sale (POS) computer systems." (PDF p. 99, typo "incude" as printed)

Notes:
- BEA computers: `null` for rate, life, DB and H-W. The table prints "......" for "Computers and peripheral equipment" in every section, with footnote 2 pointing to empirical used-price profiles in a separate methodology document. This PDF has no separate rows for mainframes, PCs, storage devices or printers. Those were not found and are not filled.
- No IT or data-center 10-K was in scope. 10-K life and residual: `null`.

## 8. Construction Equipment (model: 8-15 years)

| Source | Asset / class | Life (yrs) | BEA rate | BEA DB | BEA H-W | GDS | ADS | Residual / salvage | Citation |
|---|---|---|---|---|---|---|---|---|---|
| BEA | Construction tractors /14/ | 8 | 0.1633 | 1.3064 | A | | | | PDF p.10, raw-text line 23 |
| BEA | Construction machinery, except tractors | 10 | 0.1550 | 1.55 | A | | | | PDF p.10, raw-text line 24 |
| BEA | Federal national defense: Other equipment: Construction | 10 | 0.1550 | 1.5498 | C | | | | PDF p.12, raw-text line 48 |
| BEA | State and local govt: Construction machinery and equipment | 10 | 0.1650 | 1.65 | C | | | | PDF p.13, raw-text line 8 |
| IRS | 15.0 Construction: "Includes assets used in construction by general building, special trade, heavy, and marine construction contractors; operative and investment builders; real estate subdividers and developers; and others except railroads." | 6 | | | | 5 | 6 | | Table B-2, PDF p. 100 |
| URI | Rental equipment (whole fleet, see Heavy Machinery for the verbatim quote) | 2 to 20 | | | | | | 0 to 50% of cost; weighted average 12% of cost | Note 2, p. 51 |

Notes:
- Construction tractors and construction machinery are both Hulten-Wykoff Type A (extensive used-price data). Footnote 14 applies to construction tractors.
- URI lives and salvage by equipment category: `null`, not disclosed.

## 9. Energy / Power Generation (model: 15-25 years)

| Source | Asset / class | Life (yrs) | BEA rate | BEA DB | BEA H-W | GDS | ADS | Residual / salvage | Citation |
|---|---|---|---|---|---|---|---|---|---|
| BEA | Steam engines and turbines /9/ | 32 | 0.0516 | 1.65 | C | | | | PDF p.8, raw-text line 20 |
| BEA | Internal combustion engines /9/ | 8 | 0.2063 | 1.65 | C | | | | PDF p.8, raw-text line 21 |
| BEA | Electrical transmission, distribution, and industrial apparatus | 33 | 0.0500 | 1.65 | C | | | | PDF p.9, raw-text line 58 |
| BEA | Federal nondefense enterprises: Tennessee Valley Power Authority | 33 | 0.0500 | 1.65 | C | | | | PDF p.12, raw-text line 66 |
| BEA | Federal nondefense enterprises: Bonneville Power Authority | 33 | 0.0500 | 1.65 | C | | | | PDF p.12, raw-text line 67 |
| BEA | State and local govt: Motors, generators, motor generator sets | 32 | 0.0516 | 1.65 | C | | | | PDF p.13, raw-text line 13 |
| BEA | State and local govt: Switchgear and switchboard equipment | 33 | 0.0500 | 1.65 | C | | | | PDF p.13, raw-text line 14 |
| BEA | Private nonresidential structures: Electric light and power: Years before 1946 | 40 | 0.0237 | 0.948 | C | | | | PDF p.10, raw-text line 44 |
| BEA | Private nonresidential structures: Electric light and power: 1946 and later years | 45 | 0.0211 | 0.948 | C | | | | PDF p.10, raw-text line 45 |
| BEA | Private nonresidential structures: Gas /18/ | 40 | 0.0237 | 0.948 | C | | | | PDF p.10, raw-text line 46 |
| BEA | Private nonresidential structures: Petroleum pipelines /18/ | 40 | 0.0237 | 0.948 | C | | | | PDF p.10, raw-text line 47 |
| BEA | Private nonresidential structures: Wind and solar /11/ | 30 | 0.0303 | 0.909 | ...... | | | | PDF p.10, raw-text line 48 |
| BEA | Private nonresidential structures: Mining exploration, shafts, and wells: Petroleum and natural gas: Years before 1973 | 16 | 0.0563 | 0.9008 | C | | | | PDF p.10, raw-text line 54 |
| BEA | Private nonresidential structures: Mining exploration, shafts, and wells: Petroleum and natural gas: 1973 and later years | 12 | 0.0751 | 0.9008 | C | | | | PDF p.10, raw-text line 55 |
| IRS | 00.4 Industrial Steam and Electric Generation and/or Distribution Systems (capacity over 500 kW, or steam over 12,500 lb/hour, for the taxpayer's own industrial use, "not ordinarily available for sale to others") | 22 | | | | 15 | 22 | | Table B-1, PDF p. 99 |
| IRS | 49.11 Electric Utility Hydraulic Production Plant | 50 | | | | 20 | 50 | | Table B-2, PDF p. 107. See extraction caveat below. |
| IRS | 49.12 Electric Utility Nuclear Production Plant | 20 | | | | 15 | 20 | | Table B-2, PDF p. 107 |
| IRS | 49.121 Electric Utility Nuclear Fuel Assemblies | 5 | | | | 5 | 5 | | Table B-2, PDF p. 107 |
| IRS | 49.13 Electric Utility Steam Production Plant (includes "combustion turbines operated in a combined cycle with a conventional steam unit") | 28 | | | | 20 | 28 | | Table B-2, PDF p. 107 |
| IRS | 49.14 Electric Utility Transmission and Distribution Plant | 30 | | | | 20 | 30 | | Table B-2, PDF p. 107 |
| IRS | 49.15 Electric Utility Combustion Turbine Production Plant ("jet engines, combustion turbines, diesel engines, gasoline engines, and other internal combustion engines, their associated power turbines and/or generators") | 20 | | | | 15 | 20 | | Table B-2, PDF p. 107 |
| IRS | 49.23 Natural Gas Production Plant | 14 | | | | 7 | 14 | | Table B-2, PDF p. 107 |
| IRS | 49.24 Gas Utility Trunk Pipelines and Related Storage Facilities | 22 | | | | 15 | 22 | | Table B-2, PDF p. 107 |
| IRS | 49.4 Central Steam Utility Production and Distribution | 28 | | | | 20 | 28 | | Table B-2, PDF p. 108 |
| IRS | 49.5 Waste Reduction and Resource Recovery Plants | 10 | | | | 7 | 10 | | Table B-2, PDF p. 108 |
| IRS | 46.0 Pipeline Transportation | 22 | | | | 15 | 22 | | Table B-2, PDF p. 105 |
| IRS | Certain Property for Which Recovery Periods Assigned, F. "Energy property described in section 48(a)(3)(A) (or would be described if "solar or wind energy" were substituted for "solar energy" in section 48(a)(3)(A)(i))." | | | | | 5 | class life if no class life--12 | | Table B-2, PDF p. 108 |

Notes:
- IRS 49.11 caveat: in the extracted text the figures 50 / 20 / 50 print on the line of the unnumbered group header "Electric, Gas, Water, and Steam Utility Services", directly above the 49.11 entry, and no other figures appear before 49.12. Attributed to 49.11 on that basis. Verify against the PDF visually before relying on it.
- IRS 49.21, 49.221, 49.222, 49.223, 49.25 (gas utility distribution and gas production plants) exist on PDF p. 107 but were not extracted. They are gas-utility structures, not power-generation equipment.
- No energy 10-K was in scope. 10-K life and residual: `null`.
- The BEA structures rows (electric light and power, wind and solar, petroleum and natural gas wells) are private nonresidential **structures**, not equipment. Their declining-balance rates (0.9-ish) use the structures default, not the 1.65 equipment default.

---

## Coverage gaps (all `null`, with reason)
- **Residual % for rail cars (GATX), trucks/tractors/trailers (Ryder)**: not stated as a percent in the FY2025 10-Ks. Only Air Lease (15%) and United Rentals (0-50%, weighted 12%) state residual / salvage as a percent.
- **BEA computers, mainframes, PCs, storage, printers**: this PDF prints "......" for computers and peripheral equipment and has no sub-rows. Values live in a separate BEA methodology document (footnote 2) that was not part of this extraction.
- **BEA autos**: "......", derived from price data per footnote 12.
- **10-K benchmarks for marine, medical, IT/data center, energy, helicopters**: no filer in scope.
- **URI by equipment category**: not disclosed. One fleet-wide range only.
