GENERATED TEST DATA - NOT REAL DEVICE RECORDINGS
Created 2026-10-14 with Claude for testing the Nocta app.

DATALOG
- Real reference nights (untouched): 20250227-20250316 and 20261014
- GENERATED nights: 20251014 through 20261013 (365 folders)
  - 238 nights contain files, 127 are empty folders (no use that night, same as the device does)
  - Waveforms (BRP, PLD, SA2) are stitched from minute-blocks of the real reference nights
  - Event files (EVE) and leak values are synthesized to match each night's targets
  - Headers, file names, and CRC checksums follow the AirSense 11 format exactly
- Nightly targets:
  - 20251014-20260715: usage hours, mask sessions, AHI and leak follow the real
    myAir export (SLEEP_RECORD.csv) for those dates
  - 20260716-20261013: follow SLEEP_RECORD_generated_90d.csv (synthetic, 80% of nights used)
- STR.edf (the daily summary file) was NOT changed and does not include these nights.

SLEEP_RECORD_generated_90d.csv
- 90 synthetic nights, 2026-07-16 to 2026-10-13, 72 used (80%)
- Every row has DATA_LOAD_SOURCE = SYNTHETIC
- The real record for these dates is in the original SLEEP_RECORD.csv export

Bad nights added 2026-10-14 (DATALOG and CSV both updated):
- 2026-10-03: big mask leak (leak 70th pct 30 L/min, 95th pct 52.8 L/min), AHI 4.2
- 2026-10-09: high AHI night (22.4 events/hr), normal leak
- 2026-10-11: leak (70th pct 25.2 L/min) plus elevated AHI (9.8)
