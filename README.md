# Park 5th Ward — Interactive Family Map (GitHub Pages HTML Pilot)

A ready-to-use **HTML + CSS + JavaScript** website that runs on GitHub Pages. No Python, Streamlit, server or database is needed to demonstrate the interface.

> **Public demonstration only.** The files in this repository contain *fictional* families and simulated markers. **Never commit Church member directory exports, private coordinates, passwords, keys or identifying records of children.** The embedded access code is a demonstration UI gate, **not authentication**.

## Features

- Search by surname, member name, address, apartment / unit.
- Select a family from the directory to highlight and locate its household on the map.
- Select a house marker to view people and available details at that address.
- Filter mapped / not-yet-mapped households.
- Load an Excel (`.xlsx` or `.xls`) member list **locally in the browser**.
- Load a `household_id,address,latitude,longitude,review_status` CSV or XLSX of coordinates.
- If a selected address has no coordinates, click **Locate home** to open Google Maps address search (not automatically assumed to be correct).
- Enter verified latitude / longitude or select **Place by map click**, then download a revised coordinates CSV.
- Open Google Maps driving directions for real locally loaded addresses.
- No automatic uploads, cookies, database, or persistence after refresh.

## Project layout

```text
Ward/
├── index.html        # GitHub Pages home page and HTML elements
├── styles.css        # Responsive design
├── app.js            # Family search, Excel parsing, map + coordinates
├── README.md         # These instructions
├── SECURITY.md       # Pilot-only security boundaries
├── .gitignore        # Excludes confidential files
└── .nojekyll         # GitHub Pages serves static HTML directly
```

## Local run in Visual Studio Code

1. Extract the ZIP. Open the extracted **folder containing `index.html`** in VS Code.
2. Open **Terminal → New Terminal**.
3. Run one of these commands:
   ```powershell
   py -m http.server 5500
   ```
   or if `py` is unavailable, use the VS Code **Live Server** extension.
4. Open **http://localhost:5500/**.
5. Enter the **demo access code previously selected for this pilot**.
6. Search and select fictional families to see the map and details. Internet is required for Leaflet, SheetJS, and map tiles.

## Publishing with your GitHub account

Repository: `arebaza/Ward` (verify spelling and capitalization yourself).

1. In VS Code, open the project root, not an enclosing parent folder.
2. Before any commit, run `git status` and `git diff --cached --name-only` to inspect files. Only the project files above should be included.
3. To connect and publish a brand-new local checkout, if your GitHub repository is **empty**:
   ```powershell
   git init
   git branch -M main
   git add index.html styles.css app.js README.md SECURITY.md .gitignore .nojekyll
   git diff --cached --name-only
   git commit -m "Add static HTML interactive map pilot"
   git remote add origin https://github.com/arebaza/Ward.git
   git push -u origin main
   ```
4. If your repository already contains earlier Python files, **clone it instead of reinitializing**, copy these new files into the root, run `git add` only for the new code files, commit, and push. Do not overwrite your remote history.
5. In GitHub open **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main → Folder: /(root) → Save**.
6. Visit the exact URL shown in **Settings → Pages → Visit site**. For a repository named `Ward`, the canonical project path will commonly be `https://arebaza.github.io/Ward/` (path capitalization matters). If you see 404, check that `index.html` is at the root of the published branch, that the build completed, and that Pages is enabled and available on your plan.

### GitHub Pages privacy limitations

- GitHub Pages sites are **publicly accessible**, **even when a paid plan supports Pages from a private repository**. Repository visibility does not make the published website private.
- The `DEMO_ACCESS_CODE` constant in `app.js` can be read or bypassed by website visitors. It does not restrict access.
- Local Excel import uses browser `File` APIs; it does **not send the selected file to our own server**. The selected data is displayed only in the current browser session. However, third-party JavaScript libraries run in the same browser page, and map tile hosts receive tile requests corresponding to viewed areas.
- Do not publish real member data as a static `data.json`, `.csv`, `.xlsx`, `api.js`, or other asset or embed it in HTML/JS.
- Local browsing with real records should be undertaken **only if your organization approves the specific third-party libraries, service providers and mapping workflow**. For private shared data, use organization-approved hosting, real individual authentication, role permissions and a private database.

## Use local Excel and coordinate files

1. Sign into the *demo gate*. Click **Load Excel**. Pick `Member List 23 Oct 2026.xlsx` **from your computer**, not from the GitHub repository.
2. Your file should have a sheet named `Members` (preferably) and a table with headers `Name`, `Gender`, `Age`, `Birth Date`, `Address`, `Phone Number`, `Email`.
3. Click **Load coordinates** and choose your CSV with `household_id,address,latitude,longitude,review_status` columns. Missing latitude and longitude are accepted but not drawn.
4. **Group by address, not necessarily biological family.** Multiple surnames at one address can be roommates, households, or data issues. Confirm each address and apartment before visits.
5. Click an address in the sidebar; view the people listed at that address. Select it on the map (if it has coordinates).
6. For an unlocated address, use **Locate home** (Google Maps search), verify it, and enter coordinates in **Map location → edit coordinates**, or check **Place by map click** and click a point on the map.
7. Click **Download coordinates CSV**. Keep that file locally; never push it to GitHub. Upload it next session to restore locations.
8. Refresh clears all member data loaded in the browser. Each authorized user would need to load their own local file — this static app is not a shared database.

### Important accuracy limits

The Excel has names, addresses and contact information, **not latitude or longitude**. The original coordinates template has blank coordinates for many/all addresses, so most real homes will not have markers immediately. The app never invents them. **Do not assume matching street address means one family**: for large apartment buildings the unit is significant. Member records may be outdated. Verify before visits.

## Third-party assets

- Leaflet v1.9.4 for mapping — https://leafletjs.com/
- OpenStreetMap tile service — https://www.openstreetmap.org/
- SheetJS Community Edition v0.20.3 — https://docs.sheetjs.com/

All external resources are downloaded by the visitor's browser. Review their terms and your organization's requirements before use with non-demonstration information.
