# PROJECTS

> **Proprietary software — All Rights Reserved.** Viewing or downloading this
> repository does not grant permission to use, copy, modify, or distribute it.
> See [LICENSE](LICENSE).

![PROJECTS logo](brand/projects-logo.svg)

PROJECTS is a premium project-management application for smart-home and low-voltage installation teams. This repository contains the full application and its Home Assistant App packaging.

## Current status

Version `0.39.0` is a single full-stack Home Assistant App containing the React frontend, Node API, PostgreSQL, database migrations, role-based users, audit logging, health checks and backup/restore tooling. It includes operational customer cards, a reusable professional directory independent of login access, hierarchical systems/components, a central versioned document repository, tasks, site inspections, configurable catalogs and custom fields, automatic insights, live calendar and Gantt views, editable form templates and records, persistent company branding and responsive desktop/phone layouts. Project changes are shared between users and persisted under the App's `/data` volume.

Equipment research in the smart chat accepts questions such as `מה המידות של המפסקים בפרויקט של לוי?`. It resolves project equipment locally, asks for a precise manufacturer/model when missing or ambiguous, and searches with the configured AI provider. Answers include citations and available source images and PDFs. Choose **קישורים בלבד** for search links without AI tokens. Responses are cached for seven days in `/data/equipment-research-cache.json` (up to 24 public product answers); repeated matching questions reuse them. Web search requires a compatible provider model and may incur search fees beyond the existing token estimate. Check the cited manufacturer drawing and exact variant before installation; unavailable dimensions are not inferred.

Dynamic table imports are available to admins/managers from **פרויקט → מערכות ורכיבים → ייבוא טבלה וקובץ לפרויקט**. Upload XLSX, ODS, UTF-8 CSV or a text PDF; inspect every sheet, confirm the highlighted project suggestion, map stable identifiers and choose systems or planned tasks. Correct product names/manufacturers/models per row or by type, compare changes again, and click **אישור וייבוא לפרויקט**. Nothing is written to project records before approval. Source files are attached to the project in internal storage and reused for identical uploads; source identities prevent duplicate equipment/tasks. Missing rows are retained, conflicting local edits require a decision, and dates are required for planned work. Column mappings and categories are suggestions, not guarantees for arbitrary document layouts. Scanned PDFs need OCR outside this importer; split PDF tables and identifier ranges require correction rather than inferred joins. Floor summaries preserve individual records and identifiers. No AI tokens are used.

## Local development

```powershell
cd projects
npm.cmd install
npm.cmd run dev
```

The default local address is `http://localhost:5173`.

## Production build

```powershell
cd projects
npm.cmd ci
npm.cmd run build
```

## Home Assistant installation

Add `https://github.com/r11a/PROJECTS` as a custom App repository, install PROJECTS and enable **Show in sidebar**.

The App exposes:

- Home Assistant Ingress on its internal port `8099`.
- A standalone authenticated interface on host port `8686` by default.

The standalone host port is editable from the PROJECTS App **Network** section. Changing it does not require rebuilding the App, and **Open Web UI** follows the effective mapped port automatically. The internal Ingress port remains Supervisor-managed and should not be exposed.

### First login and security

Ingress is protected by Home Assistant authentication and restricted to Home Assistant administrators. The standalone interface uses its own login; initial credentials are `admin` / `change-me-now`. Change `admin_password` in the App configuration before exposing the interface. For Internet access, place the standalone port behind HTTPS and an authenticated reverse proxy or VPN—do not forward it directly from the router.

The App runs PostgreSQL only on its internal loopback interface. Manual database backups are available under **גיבוי ומערכת**. Home Assistant backups are configured as cold backups so PostgreSQL is stopped while `/data` is captured consistently.

## Repository structure

```text
brand/                 Vector brand assets
projects/              Home Assistant App and React application
  config.yaml          Home Assistant App manifest
  Dockerfile           Multi-stage App image
  migrations/          Ordered PostgreSQL schema migrations
  rootfs/              Nginx and service configuration
  server/              API, authentication, backups and health checks
  src/                 React source
repository.yaml        Home Assistant repository metadata
```

## Brand

The brand emphasizes **PRO** in **PROJECTS** while retaining a restrained dark-violet visual identity. Editable SVG sources are in [`brand/`](brand/), and Home Assistant PNG assets are generated in the App folder.
