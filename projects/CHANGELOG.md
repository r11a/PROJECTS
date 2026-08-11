# Changelog

## 0.5.5

- Refined the sidebar brand into a single balanced icon-and-name row.
- Replaced the wrapping product description with the compact “Do It Smarter!” tagline.
- Applied the new tagline consistently to the standalone login brand.

## 0.5.4

- Replaced the static project-count badge with the live PostgreSQL-backed project count.
- Replaced the static finance badge with the current number of projects that have an open balance.

## 0.5.3

- Fixed API base-path calculation when a Home Assistant Ingress URL is opened without a trailing slash.
- Derived the application base from the loaded JavaScript bundle URL for consistent Ingress and standalone routing.
- Added the resolved API path to the startup diagnostic screen.

## 0.5.2

- Prevented incomplete legacy project data from blocking API startup during relationship normalization.
- Made optional legacy-data conversion non-fatal while preserving strict required fields for new clients.
- Added a dedicated startup/data error screen instead of incorrectly falling back to the login form.

## 0.5.1

- Fixed Home Assistant Ingress incorrectly displaying the standalone login screen when a Supervisor omits user identity headers.
- Stopped unrelated API or migration errors from being misreported as authentication failures.
- Forwarded the official Ingress path header for consistent gateway context.

## 0.5.0

- Separated login accounts from the professional directory so people can work on projects without application access.
- Added a reusable professional directory with company/external affiliation, multiple roles, optional user linking and custom role creation.
- Replaced fixed project-manager values with editable company professionals and migrated existing manager names automatically.
- Added hierarchical system-type, system and component catalogs with manufacturer, model, SKU and usage protection.
- Added a central 100MB document repository for plans, scans, PDFs, orders, photos and spreadsheets with client/project assignment, tags and versions.
- Added administrator-only deletion, role-aware editing and Audit Log coverage for the new management records.
- Connected the saved company name and logo to the application sidebar and improved responsive management layouts.

## 0.4.0

- Replaced the static forms prototype with PostgreSQL-backed templates and completed-form records.
- Added a dynamic template builder, draft/completed/approved workflow and client/project assignment.
- Preserved a template-version snapshot with every filled form for future PDF and export fidelity.
- Added role-aware editing, administrator-only deletion and Audit Log coverage.
- Replaced placeholder document rows with actual uploaded client files.
- Added a responsive phone layout with touch-size controls and contained horizontal scrolling.
- Added persistent company-logo upload for branding and future reports.

## 0.3.1

- Fixed settings refresh so saved company and system data cannot be replaced by a cached response.
- Added authoritative save confirmation, dirty-state feedback and a clear text save button.
- Raised the minimum working-area typography size while preserving the compact sidebar.
- Added an end-to-end company-settings persistence check to the App container validation.

## 0.3.0

- Added operational client cards with required name, address and phone fields.
- Added professional contacts, referrers, additional phones/emails, files, site inspections and tasks.
- Added dynamic catalogs, custom fields, company, map, notification, numbering and backup settings.
- Added admin-only deletion and a searchable administrator Audit Log.
- Added automatic insights, overdue-task alert aggregation and per-user Snooze.
- Added a live calendar with day, week, month, detailed-month and year views, project filtering and retained history.
- Added per-user colors and icons without color uniqueness restrictions.
- Reworked the PROJECTS icon and in-app brand mark.

## 0.2.0

- Combined React, Node API, PostgreSQL and Nginx into one Home Assistant App.
- Added shared project persistence, ordered migrations and audit logging.
- Added standalone login and five role-based permission levels.
- Added database-aware health checks and in-app backup/restore management.
- Switched Home Assistant backups to cold mode for PostgreSQL consistency.

## 0.1.1

- Fixed the blank Home Assistant Ingress screen by emitting relative JavaScript, CSS and favicon asset paths.
- Added the Vite React plugin configuration used by production builds.

## 0.1.0

- Initial PROJECTS visual dashboard.
- Home Assistant Ingress support.
- Standalone LAN web interface on port 8686.
- Editable standalone host-port mapping with Hebrew and English descriptions.
- Projects, map, clients, forms and finance prototype screens.
