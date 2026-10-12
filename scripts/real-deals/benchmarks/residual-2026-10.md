# Residual benchmarks, October 2026

**Question.** Tranche gives FMV and TRAC leases a flat residual: a share of cost by equipment type, the same at any term. Is the equipment likely to be worth that much when the lease ends?

**Joel's expectation** was written down before any data was shown (`residual-expectations.json`, commit d1cc21c). He had no view on the level. His decisions were: forced-sale value, a flag not a scored factor, TRAC for information only, and check only (no change to the residuals).

Every figure below is quoted in `residual-sources/` with URL, filing and section. Figures marked *derived* are arithmetic on figures the filing states. Two sources were re-opened and checked by hand on 2026-10-12: OCC 12 CFR 23.21 and the PACCAR 10-K.

## 1. What lessors book

| Type | Tranche FMV | Benchmark | Basis | Source |
|---|---|---|---|---|
| Trucks | 25% (TRAC 20%) | "30% and 70% of the original equipment cost", 3 to 5 year leases | Booked at lease end | PACCAR FY2025 10-K (05) |
| Trucks | | About 22% of fleet cost (*derived*: $340M per 10% of residual, $15,360M cost). "Historically low levels" | Booked, end of 3 to 7.5 year lives | Ryder FY2025 10-K (06) |
| Ag and construction | 15% | About 56% of cost (*derived*: $3,899.1M residual on $6,955.2M), average original term 47 months. $756.9M carries first-loss dealer guarantees | Booked at lease end, portfolio average | John Deere Capital FY2025 10-K (08) |
| Construction, mining, power | 15% | About 36% of cost (*derived*: $1.57B on $4,401M), terms 1 to 7 years | Booked at lease end, portfolio average | Cat Financial FY2025 10-K (09) |
| Rental fleet | | Weighted average salvage 12% of cost, range 0 to 50%, lives 2 to 20 years | Booked at end of life, "minimum value we will realize" | United Rentals FY2025 10-K (07) |
| Aircraft | 17% | 15% at 25 years (passenger), 15% at 35 (freighter) | Booked at end of life | Air Lease (02), AerCap (03) |
| Aircraft | | 17% at 13 to 20 years | Booked at end of holding period | Willis Lease (04) |
| Helicopters | 17% | 20% at 30 years | Booked at end of life | AerCap (03) |
| Marine | 15% | 15% at 18 years, one vessel | Booked | Willis Lease (04) |
| Mixed funds | | Average residual 25% (ATEL 17) and 19% (ATEL 16) of original cost | Booked | ATEL FY2024 10-Ks (10) |
| Bank ceiling | | Unguaranteed residual "must not exceed 25 percent of the original cost". Guaranteed can exceed it | Regulation | 12 CFR 23.21 (01) |
| Rail, medical, IT, energy, engines, other | various | No public % of cost found | | (12) |

**Caveats.**
- Almost all of these are booked estimates, not realized proceeds. Realization evidence is directional only. In 2025, PACCAR's returns came in below residual in Europe and above it in the U.S., adding $16.2M of depreciation. Ryder's used truck prices fell 15%.
- PACCAR, Deere and Cat are captive lessors. They lease their own new equipment through dealers, often with dealer guarantees. A third-party lender may not realize these values.
- The Deere, Cat, Ryder and ATEL figures are portfolio averages, not per lease.
- Aircraft, United Rentals and Willis figures are at the end of life, not at the end of a lease.

## 2. Coverage at maturity

Coverage = projected forced-sale value at maturity / residual. Computed by Tranche's own code (`getMaturityValue`, `calculateMetrics`). The curves are:
- **Vehicles/Fleet:** BEA trucks, 17.25%/yr geometric.
- **Construction:** BEA construction machinery, 15.50%/yr.
- **Heavy Machinery:** BEA construction machinery as a proxy.
- **Ag:** Iowa State A3-29 combine auction values, the lowest of its four curves.
- **Aircraft:** Air Lease's straight line to 15% at 25 years.

Every BEA and aircraft value gets the used liquidation haircut (30%). The Iowa State values are already auction values, so they don't.

| Type | Residual | 36 mo | 48 mo | 60 mo | 72 mo | 84 mo | 96 mo | 120 mo |
|---|---|---|---|---|---|---|---|---|
| Vehicles/Fleet FMV | 25% | 1.59x | 1.31x | 1.09x | 0.90x | 0.74x | 0.62x | 0.42x |
| Vehicles/Fleet TRAC | 20% | 1.98x | 1.64x | 1.36x | 1.12x | 0.93x | 0.77x | 0.53x |
| Construction Equipment FMV | 15% | 2.82x | 2.38x | 2.01x | 1.70x | 1.44x | 1.21x | 0.87x |
| Heavy Machinery FMV | 15% | 2.82x | 2.38x | 2.01x | 1.70x | 1.44x | 1.21x | 0.87x |
| Agricultural Equipment FMV | 15% | 3.33x | 2.93x | 2.60x | 2.33x | 2.07x | 1.87x | 1.53x |
| Aircraft/Helicopters FMV | 17% | 3.70x | 3.56x | 3.42x | 3.28x | 3.14x | 3.00x | 2.72x |

## 3. Result

- **At typical terms, Tranche's residuals are low, not high.** Lessors book 30-70% (trucks), about 36% (Cat) and about 56% (Deere) at lease end. Tranche uses 15-25%. On collateral, a low residual is conservative. But it means FMV payments run higher than a lessor would set them, so Tranche **understates DSCR on FMV deals**.
- **The risk is at long terms.** A flat residual ignores the term. Vehicles at 25% fall below 1.0x past 72 months, and construction at 15% past 96 months. That is the case the check now catches.
- **Data is thinnest where FMV is most common.** Medical and IT/Data Center default to FMV, and no public curve was found for them. They are left unchecked and say so.
- **Aircraft discrepancy.** The code uses 17% and the spec table says 20%. Coverage here uses 17%. Open for Joel.

## 4. What changed (Joel, 2026-10-12)

- **New metric, residual coverage at maturity**, in the screening view, the verdict, the memo and the real-deals report. FMV flags below 1.0x (`minResidualCoverage`, configurable, 0 disables). TRAC is shown for information only.
- **Unchecked types and estimated curves are named in the notes.**
- **Residuals themselves are unchanged.** Term-dependent residuals are backlogged (AUDIT P1-23), since they would move DSCR on every lease deal.
- **Real-deals rerun** (`reports/2026-10-12.md`): all four lease cases are TRAC. Coverage is 1.36x, or 1.98x for Hertz. No score or verdict moved.

## Sources tried but not usable

These are listed in `residual-sources/12_no_percent_found_gatx_trinity_dell_herc_eplus_abs.md`:
- GATX, Trinity, Dell, Herc and ePlus disclose no residual % of cost.
- The Dell, DLL, GreatAmerica, Volvo and Kubota lease ABS deals carry no residual data on EDGAR.
- CNH and John Deere Owner Trust pools are installment contracts, so they have no residuals.
- ELFA, Black Book and Guidepost are paywalled and were not used.
