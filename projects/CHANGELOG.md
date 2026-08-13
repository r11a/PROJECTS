# Changelog

## 0.12.2

- Replaced volatile in-memory AI chat jobs with durable PostgreSQL-backed jobs.
- Added automatic recovery of interrupted AI work after an Add-on web-process restart, while preserving per-user isolation.
- Persisted completed answers and sanitized errors for ten minutes so polling remains idempotent across Ingress and Cloudflare retries.
- Added automatic expiry indexes and cleanup for old chat jobs.
- Added a regression test that resumes a persisted working job after a simulated process interruption.

## 0.12.1

- Made completed AI chat jobs idempotent for ten minutes so Home Assistant Ingress or Cloudflare retries cannot consume and lose a response.
- Added client-side recovery for short Cloudflare and upstream gateway interruptions while an AI answer is being prepared.
- Combined systems saved directly on projects with quantities assigned from the equipment catalog, fixing incomplete system and camera counts.
- Added a structured in-product guide for project creation, Outlook calendar sharing, PDF reports and AI settings.
- Added regression coverage for repeated chat polling, direct project systems and software-help questions.

## 0.12.0

- Completed an end-to-end reliability review of AI settings, encrypted keys, provider tests, database context, asynchronous chat polling, usage logging and automated insights.
- Added an automated AI integration suite covering the full settings-to-answer workflow plus SQL regression, Gemini/OpenAI response parsing, errors, usage costs, schema dependencies and release metadata.
- Corrected OpenAI GPT-5.6 Luna and Terra cost estimates and refreshed their UI pricing labels from official API pricing.
- Removed deprecated Gemini sampling parameters, increased provider-test output allowance and made empty, incomplete and safety-blocked responses report distinct actionable errors.
- Prevented UI error messages from being sent back to the model as conversation history.
- Enforced the configured monthly AI budget, displayed current estimated monthly usage and prevented duplicate in-flight questions per user.
- Updated the AI settings copy to reflect the live chat, automatic insights, read-only operation and usage controls.

## 0.11.11

- Fixed the AI chat overview query for PostgreSQL by applying the active-project filter to `AVG(progress)` before rounding the aggregate result.
- Prevented context preparation from failing before the question reaches the configured AI provider.

## 0.11.10

- Moved AI chat generation to short-lived asynchronous jobs so slow provider calls no longer keep a Cloudflare, Home Assistant or Ingress request open.
- Added authenticated polling for chat completion with per-user isolation and automatic cleanup.
- Kept the chat thinking state active until the background answer or a precise provider error is ready.

## 0.11.9

- Added one safe retry for temporary AI-provider network, rate-limit and upstream failures.
- Replaced the generic chat 502 response with the exact sanitized provider error for invalid keys, unavailable models, exhausted quota and Home Assistant network/DNS failures.
- Made the client preserve readable errors returned through Home Assistant Ingress even when the response is not JSON.

## 0.11.8

- Fixed AI chat help and message updates scrolling the entire Home Assistant Ingress document into a blank area.
- Confined automatic scrolling to the chat transcript and stabilized all drawer grid rows across help, loading and response states.
- Added explicit non-submit behavior to every chat help/control button and a local error boundary so chat failures cannot blank the PROJECTS interface.

## 0.11.7

- Added a full read-only AI chat drawer next to notifications and team messages, using the configured Gemini or OpenAI provider.
- Added intent-aware context selection so each question sends only the relevant PROJECTS data and remains cost-efficient.
- Added an in-chat help center with categorized, clickable example questions and guidance for more precise prompts.
- Added per-call token and estimated-cost tracking for AI chat and automatic insights.
- Added a live 30-day AI usage section to Reports & Analytics with questions, background insights, tokens and estimated list-price cost.

## 0.11.6

- Connected the dashboard insights tile to the selected Gemini or OpenAI provider with concise Hebrew management analysis.
- Added privacy-conscious aggregate snapshots, validated structured output, a 30-minute cache and a five-minute change cooldown to keep usage inexpensive.
- Kept deterministic local insights as a permanent fallback when AI is disabled, unconfigured or temporarily unavailable.
- Added live data refresh, explicit manual AI refresh, provider/model status and actionable navigation from every insight.
- Fixed Outlook ICS subscriptions being intercepted by authenticated API routers and repeatedly prompting for Windows credentials.

## 0.11.5

- Added secure Gemini and OpenAI provider configuration with encrypted server-side API keys.
- Added curated current model presets, cost guidance, direct key-creation links and one-click provider switching.
- Added real connection tests, last-test status, read-only safety mode and a configurable monthly budget guardrail.
- Included the AI encryption key in full PROJECTS backup packages so restored credentials remain usable.
- Added administrator-only permanent project deletion from the archive with two-step confirmation, serial-code verification, server-side password re-authentication and Audit Log coverage.
- Added immutable unique eight-character alphanumeric serial codes to every existing and new project; permanent deletion now verifies this serial code.
- Expanded live analytics into structured project, systems, execution, workload, documents and finance sections with responsive dynamic charts and honest empty states.

## 0.11.4

- Fixed the project media picker layout on desktop and mobile and hid native file-input controls.
- Added immediate global search results for projects, clients, and professionals from the dashboard header.
- Localized report stage names, chart tooltips, axes, and legends to Hebrew.
- Reworked chart direction, spacing, contrast, and the dashboard collection legend.

## 0.11.3

- Fixed the PDF report wizard height, scrolling, sticky actions, and responsive width so it is no longer clipped by the viewport.
- Removed Arabic script from Photon results, runtime project/client responses, manual address saves, and existing stored addresses.
- Added Hebrew labels for the current project stage inside generated reports.

## 0.11.2

- Fixed the reports overview endpoint so one incompatible analytics query can no longer blank the entire reports screen.
- Hardened manager, finance, and monthly aggregation queries for upgraded and historical databases.
- Added safe zero-value fallbacks for empty report datasets while logging the exact failing aggregation in the add-on log.

## 0.11.1

- Fixed a CSS class collision that compressed the customer tile view into narrow project-board columns.
- Made the customer tile grid use the full available page width while preserving the compact table view.

## 0.11.0

- Split customer first and last names, added apartment number, richer table/board views, and deterministic sorting.
- Embedded the project map inside Projects and promoted Systems & Components to a dedicated main workspace.
- Added project NAS folders, in-app document previews, reliable mobile gallery/camera inputs, desktop webcam capture, and controlled video uploads.
- Added same-project task dependencies, due-day indicators, dependency lines on Gantt, scoped overdue alerts, working snooze/dismiss actions, and direct task opening.
- Added user presence, session login/logout audit entries, bulk message deletion, and users/permissions inside system settings.
- Added a real PDF report wizard with optional project-document/NAS storage.
- Added Priority order PDF text extraction, SKU and quantity detection, catalog matching, and project assignment.
- Removed obsolete client referral/summary widgets and the document repository from Professionals.
- Updated the project stages by removing electrician threading and renaming the final stage to Ready for Handover.

## 0.10.0

- Added full PROJECTS backup packages containing PostgreSQL, internal uploads, and company branding.
- Added automatic daily or weekly backup scheduling with retention control and Israel timezone support.
- Added verified backup storage in an internal directory or a configurable Home Assistant `/share` path.
- Added backup export/download, package import validation, and controlled full restore.
- Preserved manually typed house numbers when Photon only knows the street, with an approximate-location indicator.
- Added explicit CA certificates for reliable HTTPS address lookup.

## 0.9.5

- Enabled Photon street suggestions in both new-client and edit-client forms.
- Added automatic city completion when an address suggestion is selected.
- Preserved manual address entry when an address is missing from OpenStreetMap.
- Synchronized the package, add-on, health endpoint, sidebar, and Docker versions.

## 0.9.4

- Replaced the generic browser icon with the PROJECTS P mark.
- Added the PROJECTS icon for mobile home-screen shortcuts.

## 0.9.3

- Added the installed application version to the sidebar.
- Added Photon street suggestions to the new-project wizard with automatic city selection.
- Made the health endpoint report the package version instead of a stale hard-coded value.
- Added responsive light/dark styling for the address suggestions.

## 0.9.2

- Replaced Google address lookup and project geocoding with free Photon/OpenStreetMap search.
- Added Israel-focused results, request timeout, short typing delay, and a 15-minute server cache.
- Added configurable Photon server URL for a future private/self-hosted instance.
- Removed the Google API key requirement from map settings.

## 0.9.1

- Replaced the crowded project-stage chip row with a compact responsive selector.
- Added live project counts and a colored stage indicator to the selector.
- Improved filtering layout on desktop, tablet, mobile, and dark mode.

## 0.9.0

- Added Priority customer numbers to client cards and live client-list refresh after creation.
- Replaced the project workflow with the requested 12 fixed stages and automatic stage-based progress.
- Added project size and contractor-progress tracking.
- Added task dependencies with same-project validation and self-dependency protection.
- Added per-project folders under the selected Synology/Share document root.
- Added direct phone camera/gallery uploads with accompanying project update text.
- Added read-only Outlook ICS subscriptions with personal revocable links.
- Added real-time in-app messages between users with unread state and history.
- Added PostgreSQL-driven live updates over SSE, with silent UI refreshes and no full-screen reload.
- Added Google geocoding on project address changes when a Google API key is configured.
- Changed the navigation label from “Clients and contacts” to “Clients” and added project names to task calendar entries.

## 0.8.1

- Made the compact contact-row view explicit and available on desktop, tablet and mobile.
- Added visible Rows/Cards labels and remembered the selected contact view in the browser.
- Refined tablet column widths while preserving horizontal scrolling on narrow screens.

## 0.8.0

- Added a reversible project archive with a dedicated active/archive view and admin/manager audit entries.
- Made every new project link to an existing client or atomically create a complete client card with required name, address and phone.
- Added full project editing, including client reassignment, client creation and synchronized client-name editing.
- Synchronized client-name changes from the client card across every linked project.
- Added a data migration that repairs legacy project/client links by normalized client name.

## 0.7.5

- Rebuilt the client contact list as compact rows with Name, Phone, Role and Email columns.
- Kept a one-click toggle between compact rows and visual contact cards.
- Added a fixed compact header, ellipsis handling and horizontal mobile scrolling for long contact details.

## 0.7.4

- Restored clear weekday labels in month view, including compact Hebrew labels on phones.
- Added a direct date picker that navigates within the active calendar view.
- Added explicit previous-day and next-day navigation in day view.
- Added horizontal swipe navigation on mobile while preserving vertical scrolling and control interactions.
- Added an admin-only Audit Log cleanup action with confirmation and a retained cleanup audit record.

## 0.7.3

- Replaced the blue dark-mode sidebar with a deeper black and graphite surface.
- Increased sidebar text and icon contrast for clearer navigation.
- Restyled workspace and user cards with neutral charcoal tones.
- Limited purple to the brand and active-navigation accent for a cleaner granite hierarchy.

## 0.7.2

- Made the full sidebar vertically scrollable on desktop, Home Assistant Ingress and mobile devices.
- Added dynamic viewport-height and safe-area handling for phone screens.
- Prevented navigation buttons, workspace details and the user footer from shrinking when space is limited.
- Added a subtle sidebar scrollbar and native momentum scrolling for touch devices.

## 0.7.1

- Added per-user light, granite dark and automatic appearance modes under Settings → Appearance.
- Preserved the existing light interface without visual overrides.
- Added high-contrast dark styling across dashboards, forms, tables, calendars, maps, modals and mobile layouts.
- Made Appearance settings available to every user while retaining all administrative settings for admins only.
- Persisted each user's appearance preference in PostgreSQL and recorded changes in the Audit Log.
- Replaced the overlapping mobile close button with accessible click/keyboard closing on the PROJECTS brand area.
- Added migration `008_user_appearance.sql`.

## 0.7.0

- Added a built-in smart-home, multimedia, camera, alarm and communications catalog with assignable quantities.
- Added client-level system assignments and custom image icons for catalog items.
- Added a three-step project creation wizard with client, manager, schedule, value and initial systems.
- Added a live project Gantt generated from tasks, milestones, start dates and due dates.
- Added direct project document upload, inline PDF/image preview and Office-file open/download actions.
- Added verified internal, Home Assistant Share and Media storage modes with a safe folder browser for Synology storage.
- Added printable client summary reports suitable for Save as PDF.
- Added compact contact-list and card views.
- Added a prominent live task counter with an accessible overdue animation.
- Changed calendar view controls to compact numeric buttons for mobile navigation.
- Fixed map stacking and cropped sidebar user avatars.
- Added migration `007_field_operations.sql` and Home Assistant read/write mappings for `/share` and `/media`.

## 0.6.0

- Added operational task center with project, owner, due date, priority, type, effort, status, editing, admin-only deletion and calendar history.
- Added project milestones with ownership, progress, target dates, delay state and automatic calendar history.
- Added real payment and collection management with references, due dates, status, audit logging and automatic project balance synchronization.
- Rebuilt the project workspace: live overview, tasks, milestones, project team, equipment, forms, documents, finance and activity timeline.
- Added project team assignments independently from software access permissions.
- Added equipment allocation with quantity, location, status, serial number and notes.
- Added management reports based on live PostgreSQL data and CSV export.
- Connected all sidebar management shortcuts to dedicated working screens.
- Added project filters and live map search.
- Added custom-field activation and deletion controls.
- Removed remaining hard-coded dashboard counts and made actions navigate to their actual workspaces.
- Improved responsive behavior for project resources, operational lists, forms and reports.
- Added migration `006_project_operations.sql` and expanded health/version metadata.

## 0.5.5

- Refined the sidebar brand into a single balanced icon-and-name row.
- Replaced the wrapping product description with the focused “Manage Smarter. Deliver Better.” tagline.
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
