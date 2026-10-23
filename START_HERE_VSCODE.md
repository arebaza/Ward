# VS Code quick start — Park 5th Ward private pilot

## 1. Open the correct folder
Unzip this archive. In **Visual Studio Code → File → Open Folder**, choose `park5_private_map_app` (the folder containing `app.py` and `requirements.txt`).

## 2. Create Python environment (Windows PowerShell)
Open **Terminal → New Terminal** within VS Code:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Install VS Code's **Python** and **Python Debugger** extensions if prompted, and select the `.venv` Python interpreter.

## 3. Enable a private local pilot
**Local pilot already configured:** This ZIP includes `.streamlit/secrets.toml` with the access password you requested. On your computer, start the app and enter that password on its access screen. The credential is NOT in the Python source code and is ignored by Git.

**Critical:** This ZIP includes a local credential, so **do not upload the ZIP itself to GitHub**, share it, or publish its contents as-is. Never upload `.streamlit/secrets.toml`. A shared password is suitable only for a limited local demonstration—not for publishing a real member directory. For any hosted deployment, use organization-approved individual-user sign-in and secure data storage.

## 4. Run the app

```powershell
.\.venv\Scripts\python.exe -m streamlit run app.py
```

The terminal will display a local URL (usually `http://localhost:8501`). Open it in the browser.

Alternatively, with the `.venv` interpreter selected, press **F5** and choose **Park 5th Ward — Run Streamlit**.

## 5. Load Excel and coordinates
1. Sign in using your local pilot password.
2. In the left sidebar, upload **`Member List 23 Oct 2026.xlsx`**. This is the *original member workbook* tested with the included `directory.py` importer (385 records / 139 address groups). A differently formatted previously converted workbook will not parse without modifying the importer.
3. In the sidebar, download the address-coordinates CSV template (or use your separate `Park5_Household_Map_Coordinates_2026-10-23.csv`).
4. Add and verify latitude/longitude for each household ID. Save as **CSV UTF-8**.
5. Upload that CSV in the sidebar. Search a surname or address, select a household, click mapped markers, and use **Directions**.

**Important:** Until coordinates are verified and entered, real household pins will not appear. The app does *not* automatically geocode addresses.

### Optional: open your private files automatically every time
Instead of uploading Excel and CSV on every restart, place your own copies in `private/` and add these lines to `.streamlit/secrets.toml` together with your `PILOT_PASSWORD`:

```toml
DATA_XLSX_PATH = "private/Member List 23 Oct 2026.xlsx"
COORDINATES_CSV_PATH = "private/Park5_Household_Map_Coordinates_2026-10-23.csv"
```

Do not commit the data or real secrets to GitHub. When the app starts, real member data will load only after your local pilot sign-in.


## Where the code lives
- `app.py` — UI: sidebar uploads, search, map, household list, details, directions.
- `directory.py` — Excel importer, address grouping, household IDs, coordinate CSV parsing.
- `geocode_with_google.py` — optional local geocoding helper; only with specific permission for sending residential address strings to Google.
- `requirements.txt` — dependencies.
- `.streamlit/secrets.example.toml` — config template; create your private `secrets.toml` locally.
- `.vscode/launch.json` — Run/Debug configuration.
- `.vscode/settings.json` — Python interpreter preference for Windows.
- `.vscode/extensions.json` — recommended extensions.
- `private/` — optional local data directory, ignored by Git.

## Sharing it with authorized viewers
Running on localhost shows the app only on your own computer. An authorized shared web app requires approved private hosting, individual-user SSO, access control, secure centrally stored Excel/coordinates, and data retention/audit controls. Do not publish member data to a public Streamlit deployment or public GitHub.

See `README.md` for the full pilot notes and optional geocoding workflow.
