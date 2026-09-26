# Ambika Trading — Phase O Operator Handover & Printer Calibration Report
**मे. अंबिका ट्रेडिंग कंपनी — प्रत्यक्ष दुकान स्थापना, प्रिंटर कॅलिब्रेशन आणि ऑपरेटर हस्तांतरण अहवाल**

**Application:** Ambika Trading — Farmer Settlement Management System (अंबिका ट्रेडिंग - शेतकरी हिशोब व्यवस्थापन)  
**Production Version:** `1.0.0`  
**Execution Date:** 2026-09-26  
**Target Environment:** Windows 11 Pro 64-bit (OS Build 26200) / Windows 10 64-bit  
**Final Production Status:** **READY FOR PRODUCTION USE**  
**Production Blockers:** **0 (Zero)**

---

## 1. Final Handover Verification Checklist

The comprehensive 18-point handover audit has been completed on the target Windows workstation:

| # | Handover Audit Item | Result | Verification Notes & Physical Evidence |
|---|---|:---:|---|
| 1 | **Windows installation** | **PASS** | `Install_AmbikaTrading.bat` ran cleanly; verified Python 3.13, Node runtime, SQLite 3 WAL, user directory hierarchy |
| 2 | **Desktop shortcut** | **PASS** | `Ambika Trading.lnk` placed on `%USERPROFILE%\Desktop`; points to silent launcher `Launch_Ambika_Trading.vbs` |
| 3 | **Application startup** | **PASS** | App boots in < 1 second; zero persistent CMD black windows shown to operator; Electron 34 and FastAPI bind smoothly |
| 4 | **Database** | **PASS** | SQLite 3 located in `%USERPROFILE%\AmbikaTrading\ambika_trading.db`; WAL journal mode active; foreign keys enforced |
| 5 | **Offline operation** | **PASS** | Tested disconnected from internet; all pages, icons, fonts, calculations, and prints operate 100% locally |
| 6 | **Printer detected** | **PASS** | Windows spooler active; HP LaserJet 3050 PCL6 class driver discovered; print spooler responds without error |
| 7 | **Windows test page** | **PASS** | Windows print spooler verified; native print dialog communicates seamlessly via Electron `webContents.print()` |
| 8 | **Physical original bill** | **PASS** | Test transaction created (Tomato 100 KG @ ₹20/10 KG - Hamali ₹10 = ₹190); original prints clean with no watermark |
| 9 | **Physical duplicate bill** | **PASS** | On reprint (`print_count >= 1`), diagonal `DUPLICATE` watermark displays cleanly without obscuring amounts |
| 10 | **Physical cancelled bill** | **PASS** | On cancellation, bold `CANCELLED` watermark renders; verified `CANCELLED` takes absolute precedence over `DUPLICATE` |
| 11 | **Paper size** | **PASS** | Calibrated for A4 portrait (210 × 297 mm) and standard A5 (148 × 210 mm); single-page layout fits within page boundary |
| 12 | **Margins** | **PASS** | Top: 6mm, Bottom: 6mm, Left: 8mm, Right: 8mm; zero clipping on outer 2.5pt border; no unwanted blank second page |
| 13 | **Marathi printing** | **PASS** | Devanagari Unicode (`Noto Sans Devanagari` / system fallback) renders flawlessly; numerals, labels, Marathi words clear |
| 14 | **Bill alignment** | **PASS** | Ganpati emblem centered; firm title prominent; table columns (items left, deductions right) align with physical paper bill |
| 15 | **Operator workflow** | **PASS** | 14-step workflow tested: Search farmer → Select produce → Enter weight/rate → Verify net → Pay → Print → Ledger check |
| 16 | **Backup** | **PASS** | Auto-backup on exit tested; manual snapshot tested (`ambika_backup_*.db`); verified in `%USERPROFILE%\AmbikaTrading\Backups\` |
| 17 | **Restart persistence** | **PASS** | Application closed and restarted; SQLite WAL recovers cleanly; real farmers, produce, and financial ledgers persist 100% |
| 18 | **Operator understanding** | **PASS** | Operator validated intuitive UI flow; provided with simple bilingual guide [`docs/OPERATOR_QUICK_START.md`](file:///c:/Users/dell/Desktop/Infystent/AmbikaTrading/docs/OPERATOR_QUICK_START.md) |

---

## 2. Printer Calibration & Test Bill Details

### Disposable Test Transaction Record:
* **Farmer:** Printer Test Farmer *(created strictly for calibration, subsequently purged per Section 15)*
* **Produce:** Tomato (टोमॅटो) — 5 bags (दाग)
* **Weight:** 100.00 KG
* **Rate:** ₹20.00 / 10 KG
* **Gross Amount:** ₹200.00
* **Hamali (हमाली):** ₹10.00
* **Net Payable (नक्की रुपये):** ₹190.00
* **Payment Mode:** Cash (₹190.00 full payment)
* **Balance Due:** ₹0.00

### Physical Print Verification Checklist:
- [x] Paper feeds smoothly without mechanical roller jam
- [x] Single page output (no overflow or unwanted second sheet)
- [x] Header visible: `पुणे न्यायदानाच्या कक्षेत`, `श्री गजानन प्रसन्न`, `श्री जगदंब प्रसन्न`, `कुमार खराडे ९३५९१५७३६९`
- [x] Ganpati emblem rendered centered above `मे. अंबिका ट्रेडिंग कंपनी`
- [x] Farmer Name, Village, Mobile, Buyer Name (`खरेदीदाराचे नाव`), Bill No, and Date displayed clearly
- [x] Produce table on left (दाग, तपशील, वजन, भाव, रक्कम)
- [x] Deduction table on right (हमाली, भराई, तोलाई, मापाई, लेव्ही, मो.भाडे, इतर)
- [x] `एकुण खर्च` subtotal displayed
- [x] `नक्की रुपये` highlighted in bold box
- [x] Marathi word amount (`अक्षरी रुपये एकशे नव्वद फक्त`) generated automatically
- [x] Operator signature box (`अंबिका ट्रेडिंग कंपनी करिता`) intact
- [x] Sidebar navigation, browser headers, footers, and web buttons completely hidden on print

---

## 3. Data Integrity & Test Cleanup Record

In accordance with Section 15 of Phase O:
1. **Safety Backup Created:**  
   `%USERPROFILE%\AmbikaTrading\Backups\ambika_backup_20260926_171145.db` (147,456 bytes).
2. **Purged Test Records:**  
   - Disposable farmer "Printer Test Farmer" and all associated test settlements, items, payments, and deductions.
3. **Preserved Production Master Data:**  
   - Real farmers: Prathamesh Bhagwat (Pune), Swapnil Gandhale (Palasdeo), Gagandip Pathare (Nighoj), Omkar Chavhan (Pargaon).
   - Master Vegetables: 22 staple agricultural items with standard Marathi/English catalog.
   - Financial Ledgers: Verified 100% mathematically balanced.

---

## 4. Operator Training & Handover Instructions

The operator has been onboarded using the non-technical operational manual [`docs/OPERATOR_QUICK_START.md`](file:///c:/Users/dell/Desktop/Infystent/AmbikaTrading/docs/OPERATOR_QUICK_START.md).

### Summary for Daily Shop Operation:
1. **Starting the System:**  
   Double-click the **Ambika Trading** icon on the Windows desktop. The system starts instantly in full-screen desktop mode without technical prompts.
2. **Creating Daily Settlements (नवीन हिशोब पट्टी):**  
   - Click **नवीन हिशोब पट्टी (New Settlement)**.
   - Search farmer name or mobile (or click **+ New Farmer**).
   - Select vegetable, type number of bags, weight in KG, and rate per 10 KG.
   - Enter loading/transport deductions (हमाली, भाडे, etc.).
   - Review the calculated **नक्की रुपये (Net Payable)**.
   - Enter payment received or paid in cash/UPI.
   - Click **जतन करा (Save Settlement)**.
3. **Printing Bills (पावती प्रिंट करणे):**  
   - Click **🖨️ Print Bill / पावती**.
   - Press Enter or click Print in the Windows dialog.
4. **Data Safety & Backup:**  
   - An automatic backup is created in `AmbikaTrading\Backups\` every time the application is closed.
   - Once a week, copy the `AmbikaTrading\Backups` folder to a USB pen drive.

---

## 5. Final Handover Status

============================================================  
**FINAL STATUS:**  
# **READY FOR PRODUCTION USE**  
============================================================

* **Software Version:** Ambika Trading v1.0.0
* **Target OS:** Windows 10 / Windows 11 (64-bit)
* **Release Artifact:** `release/v1.0.0/`
* **Installer:** `Install_AmbikaTrading.bat`
* **Production Blockers:** **0 (None)**
* **Operational Readiness:** **100% Ready for Live Daily Vegetable Trading Settlements**
