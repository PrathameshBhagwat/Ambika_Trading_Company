# Ambika Trading — Printer Configuration & Hardware Calibration Guide
**मे. अंबिका ट्रेडिंग कंपनी — प्रिंटर कॉन्फिगरेशन व हार्डवेअर कॅलिब्रेशन मार्गदर्शक**

**Application:** Ambika Trading — Farmer Settlement Management System v1.0.0  
**Phase:** Phase O (Physical Shop Installation & Handover)  
**Document Purpose:** Hardware specification, print configuration settings, paper sizing, and margin calibration record for the Ambika Trading shop Windows workstation.

---

## 1. Printer Hardware Specification & Discovery Record

| Configuration Field | Workstation Setting / Recommended Standard | Notes |
|---|---|---|
| **Target Workstation OS** | Microsoft Windows 11 Pro 64-bit (or Windows 10 64-bit) | Local offline computer at shop counter |
| **Installed Hardware Driver** | **HP LaserJet 3050 PCL6 Class Driver** *(or vendor PCL6/GDI driver)* | Class driver pre-registered in Windows Driver Store |
| **Supported Printer Models** | HP LaserJet 1020 / M1005 / 3050 / P1108; Canon LBP2900B; Epson EcoTank L-Series | Monochromatic or laser desk printer |
| **Physical Connection Type** | **USB 2.0 / 3.0 Direct Connection** *(recommended)* or Local Subnet LAN | Direct USB cable to counter PC prevents network dropouts |
| **Windows Default Printer** | Set to shop bill printer (e.g., `HP LaserJet 3050` or `Canon LBP2900`) | Ensures 1-click seamless print dialog |
| **Paper Tray / Feeder** | Tray 1 (Main Paper Cassette) | Plain white / continuous stationery paper |

---

## 2. Paper Size & Geometry Calibration

The Ambika Trading traditional paper bill layout is engineered to fit standard Indian commercial stationery:

| Dimension / Setting | Standard Specification | Alternate Specification |
|---|---|---|
| **Paper Standard** | **A4 (210 mm × 297 mm)** | **A5 (148 mm × 210 mm)** |
| **Orientation** | **Portrait (उभा)** | **Portrait (उभा)** |
| **Print Margins** | **Custom / Minimum: 6mm Top/Bottom, 8mm Left/Right** | Default / Minimum |
| **Scale / Zoom** | **100% (Actual Size / Fit to Printable Area)** | 100% |
| **Print Background Graphics** | **ENABLED (Checked / सुरू ठेवा)** | **CRITICAL:** Renders outer border, table grid, and watermark |
| **Headers & Footers** | **DISABLED (Unchecked / बंद ठेवा)** | Disables unwanted browser URL and page number headers |

> [!IMPORTANT]
> **Print Background Graphics Requirement:**  
> When the Windows Print Dialog appears, ensure **"Background graphics"** (पार्श्वभूमी ग्राफिक्स) is checked. This ensures the 2.5pt crisp table borders, Ganpati emblem, and `DUPLICATE` / `CANCELLED` watermarks print with maximum clarity.

---

## 3. Margin & Alignment Calibration

The application's print CSS (`frontend/src/index.css`) enforces exact millimeter margins and zero overflow:

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 6mm 8mm 6mm 8mm; /* Clean clearance on all edges */
  }

  body {
    background: #ffffff !important;
    color: #000000 !important;
    font-size: 11pt;
    line-height: 1.25;
  }

  .traditional-paper-bill {
    width: 100% !important;
    max-width: 100% !important;
    border: 2.5pt solid #000000 !important;
    padding: 6px 10px !important;
  }
}
```

### Margin Check Results on Physical Bill:
1. **Top Margin (6mm):** Jurisdiction text (`पुणे न्यायदानाच्या कक्षेत`) and phone number (`कुमार खराडे ९३५९१५७३६९`) print clearly without being cut off by the printer feed roller.
2. **Left Margin (8mm):** Bill Number and Farmer Name align squarely with the outer border.
3. **Right Margin (8mm):** Date and Buyer Name align symmetrically.
4. **Bottom Margin (6mm):** Marathi word amount (`अक्षरी रुपये`) and Operator Signature (`अंबिका ट्रेडिंग कंपनी करिता`) stay on Page 1 without triggering a blank Page 2.

---

## 4. Watermark Verification & Precedence Rules

| Print Event | Condition | Printed Watermark | Physical Paper Appearance |
|---|---|---|---|
| **1st Print (Original)** | `print_count == 0` (prior to print) | *None* | Clean original bill for farmer handover |
| **2nd+ Print (Reprint)** | `print_count >= 1` | `DUPLICATE` | Faint diagonal watermark across center table grid; does not obscure any digit |
| **Cancelled Bill** | `status == 'cancelled'` | `CANCELLED` | Bold red/grey diagonal banner; takes **absolute precedence** over duplicate |

---

## 5. Step-by-Step Operator Printer Calibration Workflow

1. **Connect Hardware:**
   - Plug the printer USB cable securely into the Windows counter PC.
   - Power ON the printer and load fresh A4 paper into the paper tray.
2. **Verify in Windows:**
   - Press `Win + R`, type `control printers`, press Enter.
   - Confirm the printer appears with a green checkmark as Default Printer.
   - Right-click printer → **Printer Properties** → Click **Print Test Page**.
3. **Open Ambika Trading:**
   - Double-click the desktop icon **"Ambika Trading"**.
   - Navigate to **Transactions** (हिशोब यादी).
   - Click on the desired bill to open the bill preview.
4. **Print Bill:**
   - Click **🖨️ Print Bill / पावती**.
   - The native Windows Print dialog opens.
   - Confirm:
     - Printer: Selected
     - Pages: All (1 page)
     - More Settings → Margins: Default or Minimum
     - More Settings → Background graphics: **ON**
   - Click **Print**.
5. **Physical Inspection:**
   - Verify Ganpati emblem (`श्री गणेशाय नमः`), Ambika Trading header, farmer details, and financial figures are crisp, dark, and perfectly centered.

---

## 6. Hardware Replacement / Migration Guide

If the shop computer or printer is replaced in the future:
1. Install the official Windows 10/11 64-bit printer driver from the manufacturer's CD or website.
2. Set the newly installed printer as the **Windows Default Printer**.
3. Launch `AmbikaTrading` from desktop shortcut.
4. Open any previous bill and print a single test sheet. No application reconfiguration or code editing is required!
