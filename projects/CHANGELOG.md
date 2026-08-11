# Changelog

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
