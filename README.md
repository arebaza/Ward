# Park 5th Ward — Private Household Locator (Python / Streamlit)

## What you get
- **Two-way navigation:** select an address/family name and map centers there; click a pin and member detail panel switches to that address.
- **Search:** member name, surname, address, apartment number; filter to mapped homes.
- **Details:** directory fields (name, gender, age where provided, birth date, phone, email) shown in the private session.
- **Directions:** Google Maps directions link to the selected address. Opens a third-party service only on click.
- **Household coordinates template:** spreadsheet-compatible CSV with stable household IDs, addresses, and blank latitude/longitude.
- **Privacy-first defaults:** public/no-auth app only displays fictional demo. Member data is not embedded in app code, and addresses are not geocoded automatically.

## Important privacy notice
The original Excel contains private Church member information, including minors' details, contact data, and residential addresses. **Do not publish the Excel, converted JSON, contact data, or exact residence markers to an unrestricted public website, map, or GitHub repo.** Use it only with permission and in accordance with your organization's data-handling policies. Do not assume that people living at the same address are a family. Verify household assignments and apartment/unit numbers.

**This code is a functional proof of concept, not a certified Church production system.** For organizational distribution, obtain approval for hosting, identity access, data residency/storage, mapping provider, and geocoding. Prefer Church-approved systems/SSO; audit logging, retention and access-control design need to be supplied by the organization.

## Run locally
1. Install Python 3.11+.
2. Unzip this project. Open a terminal in its folder.
3. Install dependencies: `python -m pip install -r requirements.txt`.
4. Try the **fictional demo**: `streamlit run app.py`.
5. For private local data, copy `.streamlit/secrets.example.toml` to `.streamlit/secrets.toml`, uncomment `PILOT_PASSWORD`, and replace with a long private password. Do not put secrets in GitHub.
6. Restart `streamlit run app.py`, sign in, and upload your **Member List 23 Oct 2026.xlsx** in the sidebar.
7. Download the **household coordinates template**. Fill in verified latitudes and longitudes for each address, then save as **CSV UTF-8**.
8. Upload the completed coordinates CSV. Now search a family/address; select a household to center its marker, or click any pin to open the record details.
9. Coordinates must be for the specific apartment/unit where possible; check for bad zip codes, swapped apartment numbers and incorrect pin placements.

### If you need automatic coordinates
`geocode_with_google.py` is an OPTIONAL local one-time preparation script. It sends ADDRESS STRINGS to Google (no names, phones, or emails) and may incur API costs. Only use if your Church data steward authorizes that provider and you have a Google Maps Geocoding API key. Verify all results before using them. It reads the coordinates CSV and creates a separate CSV with lookup results:

```
# macOS/Linux (Windows: set environment variable differently)
export GOOGLE_MAPS_API_KEY=YOUR_SECRET_KEY
python geocode_with_google.py --input household_coordinates.csv --output verified_later.csv --confirm-third-party
```

Coordinates can instead be entered manually or prepared in a Church-approved geocoding environment; no external lookup is necessary to run the app.

## Publishing
A URL is possible with **approved private hosting**. Never commit actual Excel or completed coordinates CSV to a public repository. Files may be supplied through protected server mounts configured by `DATA_XLSX_PATH` and `COORDINATES_CSV_PATH` only after hosting has been approved. The app refuses real-data uploads unless a pilot password or `st.login()` OIDC authorization is configured. **A shared password is for local proof-of-concept only, not sufficient for production protection.** For a deployed app use approved Microsoft/organizational SSO through Streamlit OIDC (`st.login`) *plus* a strict allowlist (`allowed_emails`) or stronger central role enforcement; place data in approved protected storage; apply auditing/retention rules. Public demonstration may show fictional example people only.

Streamlit hosting docs:
- https://docs.streamlit.io/develop/concepts/connections/authentication
- https://docs.streamlit.io/deploy/streamlit-community-cloud/manage-your-app/app-settings
- https://docs.streamlit.io/deploy/streamlit-community-cloud/deploy-your-app/secrets-management

## Important limitations
- Member workbook has addresses but not verified latitude/longitude, so REAL map pins appear only once coordinates are supplied.
- Selecting a location groups people living at the **same normalized street address including apartment/unit**, not formally linked church households.
- Some source records have blank, inconsistent, or malformed fields; review the imported directory before operational use.
- Pilot uploads stay in memory of each session. They are **not automatically shared with other viewers**. For authorized viewers to see the same directory on an approved private server, let IT mount the sensitive workbook and completed coordinates CSV **outside the Git repository** and set `DATA_XLSX_PATH` / `COORDINATES_CSV_PATH` through protected deployment secrets. The app will then load shared data **after authorization**. An organization-approved storage system with logging and retention is still required for production.
- Browser loads third-party OSM tile graphics. Approve the mapping provider for real private uses.


## Local pilot password setup (personal copy)
This locally configured ZIP contains `.streamlit/secrets.toml` with the pilot password you provided. It is excluded by `.gitignore`. Never upload this ZIP, `secrets.toml`, or member data to GitHub. Use individual identity-based authentication on any published version.
