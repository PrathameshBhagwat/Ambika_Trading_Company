# Ambika Trading — Release Notes v1.0.0

**Application Name:** Ambika Trading — Farmer Settlement Management System (अंबिका ट्रेडिंग - शेतकरी हिशोब व्यवस्थापन)  
**Version:** `1.0.0` (Initial Production Release)  
**Release Date:** 2026-09-26  
**Target Environment:** Windows 10 / Windows 11 (64-bit) Desktop  
**Architecture:** Offline Native Desktop (Electron 34 + React 18 / Vite 8 + FastAPI + SQLite 3 WAL)  

---

## 1. Overview & Business Purpose

Ambika Trading v1.0.0 is an offline Windows desktop application engineered for vegetable commission agents (आडतदार) operating in agricultural produce market yards (APMC). It replicates the layout, terminology, and workflow of the physical Ambika Trading paper settlement slip while providing automated financial calculations, ledger accounting, and data protection.

---

## 2. Key Capabilities & Features

### A. Authentic Traditional Paper Bill Printing
* **Faithful Visual Representation:** Faithfully replicates the physical Ambika Trading paper bill with Pune jurisdiction header, blessings, Kumar Kharade contact, Lord Ganesha emblem, contact numbers, and Marathi words footer.
* **Two-Sided Grid:** Items table on the left (मालाचा प्रकार, एकुण वजन किलो, दर १० किलोस, एकुण रुपये व पैसे) and standard deductions on the right (हमली, भराई, तोलाई, मापाई, लेव्ही, मो.भाडे, एकुण खर्च).
* **Summary & Akshari Rupee:** Displays net payable inside the traditional black "नक्की रुपये" box and converts amount to Devanagari words ("हिशोबपट्टीत नमूद केल्याप्रमाणे अक्षरी रु. ... पोहोचले / पाठविले.").
* **Reprint & Watermark Tracking:** 1st print = Original. Subsequent prints automatically carry a diagonal `DUPLICATE` watermark. Cancelled transactions display a distinct `CANCELLED` watermark.

### B. High-Speed Settlement Entry ("नवीन हिशोब पट्टी")
* Real-time reactive calculation as operators type weight and rate per 10 KG.
* Includes dedicated **खरेदीदाराचे नाव (Buyer's Name)**, village, and automatic bag counter.
* Supports quick-registration modal for new farmers directly inside the settlement flow.

### C. Financial & Accounting Engine
* Multi-item delivery with exact formula: $\text{Item Amount} = \frac{\text{Weight (KG)}}{10} \times \text{Rate per 10 KG}$.
* Net calculation: $\text{Net Payable} = \text{Gross Amount} - \text{Total Deductions}$.
* Immediate payment collection or deferred credit tracking.

### D. Comprehensive Ledger & Reports
* **Dashboard:** Real-time today's turnover, net payable, deductions, recent transactions list, and quick action cards.
* **Farmer Ledger:** Farmer statement with date range filtering, transaction ledger, payment history, and printable statement.
* **Daily Summary:** Daily trading turnover, commodity weights, average rates, and total deductions.
* **Outstanding Balances:** Farmer-wise pending balances with 1-click settlement links.
* **Payment Summary:** Payment audit by payment mode (Cash, Bank Transfer, UPI, Cheque).

### E. Data Safety & Offline Architecture
* **Zero Cloud Dependency:** 100% functional without an active internet connection.
* **SQLite WAL Mode:** High concurrency and crash resistance via Write-Ahead Logging.
* **Automated Exit Backups:** Backs up database to `%USERPROFILE%\AmbikaTrading\Backups\` on every exit, rotating the 30 most recent snapshots.
* **Audit Trail:** Comprehensive activity logging (CREATE, UPDATE, CANCEL, RESTORE) with old and new values.

---

## 3. Known Non-Blocking Limitations

1. **Hardware Printer Calibration:**
   * Printing is verified via Windows virtual drivers (Microsoft Print to PDF). Final margin adjustments (e.g. 5mm vs 10mm) depend on the shop's physical thermal/laser printer driver settings.
2. **Single Workstation Design:**
   * Designed for standalone offline use on a single shop counter PC. Multi-device networked synchronization is not in the scope of v1.0.0.
