# Security policy for this pilot

**This is a demonstration static website and is not an access-controlled ward directory.**

1. GitHub Pages output is public, including for private repositories on plans that offer Pages from private repos.
2. An HTML/JS passcode is only an interface demonstration: its value and comparison logic are inspectable and circumventable. Do not rely on it for private records.
3. The project **must not contain** actual names, email addresses, phone numbers, family lists, member records, birth dates, or precise homes.
4. If a user selects Excel or CSV files, the page reads them in the local browser session and does not deliberately send them to our server. The browser loads third-party scripts and makes map-tile requests; their providers are separate data processors. Real data should only be used under organizational approval for those providers and services.
5. Do not put confidential files in Git or an external static host, even when the GitHub repository is private. Check your commit history if a file was previously committed; `.gitignore` does not purge history.
6. For actual multiuser ward deployment, use organization-approved identity and access management (individual accounts, role-based access, auditing), a private backend/database, and a formal policy for sharing personal data including data relating to minors.
7. Loaded browser data is erased on refresh; coordinate CSV downloads must be stored securely by the user.
