# Ambika Trading — Windows Installation Guide (स्थापना मार्गदर्शक)

**Application:** Ambika Trading — Farmer Settlement Management System  
**Version:** `1.0.0`  
**Platform:** Windows 10 / Windows 11 (64-bit)  
**Deployment Mode:** 100% Offline Standalone Desktop Application  

---

## 1. System Requirements (किमान संगणक आवश्यकता)

| Component | Minimum Requirement | Recommended |
|---|---|---|
| **Operating System** | Windows 10 (64-bit) | Windows 10 / 11 (64-bit) |
| **Processor (CPU)** | Intel Core i3 / AMD Ryzen 3 | Intel Core i5 / AMD Ryzen 5 or better |
| **Memory (RAM)** | 4 GB RAM | 8 GB RAM |
| **Disk Space** | 2 GB free disk space | 5 GB SSD free space |
| **Display Resolution** | 1280 x 720 pixels | 1920 x 1080 pixels (Full HD) |
| **Printer** | Any Windows-compatible printer (Thermal, Laser, Dot-matrix, or Inkjet) | Standard 80mm / A4 Printer |
| **Internet Connection** | None required (100% Offline) | None required |

---

## 2. Prerequisites Checklist (आवश्यक सॉफ्टवेअर)

Before installing, ensure the host Windows machine has:

1. **Python 3.11+ (64-bit):**
   * Download from [python.org](https://www.python.org/downloads/)
   * ⚠️ **IMPORTANT:** During installation, check the box: **"Add python.exe to PATH"**.
2. **Node.js LTS (v18 or higher):**
   * Download from [nodejs.org](https://nodejs.org/) (LTS recommended).
3. **Microsoft Visual C++ Redistributable (x64):**
   * Typically pre-installed on Windows 10/11.

---

## 3. Fresh Installation Procedure (नवीन स्थापना पद्धत)

1. **Extract Release Folder:**
   * Copy the folder `release/v1.0.0` to your preferred installation directory, for example:
     `C:\Program Files\AmbikaTrading` or `C:\AmbikaTrading`.
2. **First-Time Setup (स्वयंचलित सेटअप):**
   * Double-click **`Install_AmbikaTrading.bat`** (or open `start_app.bat`).
   * The script will automatically:
     * Verify Python & Node.js environment
     * Install required dependencies (`fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`, `alembic`)
     * Prepare the native desktop application
     * Create a **Desktop Shortcut** ("मे. अंबिका ट्रेडिंग कंपनी") on the operator's Windows desktop.
3. **Launch the Application:**
   * Double-click the **Ambika Trading** desktop icon or **`Launch_Ambika_Trading.vbs`**.
   * The native desktop window will open immediately.

---

## 4. Where User Data is Stored (डेटा साठवणूक स्थान)

To ensure your financial records are 100% protected and will **never** be deleted during application updates or reinstalls, all application data is stored in the Windows User Profile:

* **Main Database File:**
  `%USERPROFILE%\AmbikaTrading\ambika_trading.db`
  *(e.g., `C:\Users\<Username>\AmbikaTrading\ambika_trading.db`)*
* **Automated Backups Directory:**
  `%USERPROFILE%\AmbikaTrading\Backups\`
* **Application Activity Logs:**
  `%USERPROFILE%\AmbikaTrading\Logs\`

---

## 5. Updating / Reinstalling Safely (अद्यतन व सुरक्षितता)

When installing future updates:
1. Simply replace the application folder files with the new release files.
2. **DO NOT** delete `%USERPROFILE%\AmbikaTrading\`.
3. Launch the new version. Your existing farmers, transactions, and settings will load seamlessly.
