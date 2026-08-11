# PROJECTS

PROJECTS is a full-stack Home Assistant App for managing smart-home installation projects.

Version 0.7.4 improves calendar navigation with weekday labels, direct date selection, explicit day paging and mobile swipe gestures. Administrators can also clear the Audit Log through a confirmed, audited action. It includes the granite sidebar palette from 0.7.3.

Version 0.4.0 adds an operational forms module with editable templates, structured form records, workflow states, responsive phone layouts and company-logo storage. Version 0.3.1 added reliable settings-save confirmation and a more readable typography scale. Version 0.3.0 added the operational core: detailed client records, professional contacts and referrers, uploads, inspections, dated tasks, dynamic catalogs and custom fields, automatic insights, a multi-view live calendar and an administrator Audit Log.

## Access

- Use **Open Web UI** for the standalone authenticated interface. Its default host port is `8686`.
- Use the **PROJECTS** sidebar entry for authenticated Home Assistant Ingress.

## Changing the standalone port

Open the PROJECTS App page, expand **Network**, change the host port mapped to `8686/tcp`, save and restart the App. For example, you can map the internal port to host port `9080` without rebuilding the App. **Open Web UI** automatically uses the effective host port.

Leave the mapping disabled if you want to use PROJECTS through Ingress only. The internal Ingress port `8099` is managed by Home Assistant and should not be exposed or changed.

## Authentication and permissions

Ingress is authenticated by Home Assistant and limited to Home Assistant administrators. The standalone interface uses PROJECTS users and roles. Initial credentials are `admin` / `change-me-now`; change `admin_password` on the App configuration page before using external access.

Roles are `admin`, `manager`, `technician`, `finance` and `viewer`. Only administrators can manage users, create backups or request restores.

## Database and backups

PostgreSQL data, JWT secrets and manual backups live under the persistent `/data` volume. Schema migrations run automatically before the API starts. Use **גיבוי ומערכת** inside PROJECTS for a manual database backup or restore. A restore restarts the API while replacing the database.

Home Assistant backup mode is `cold`, ensuring the embedded PostgreSQL process is stopped during a Supervisor backup.

## Synology document storage

1. In Home Assistant open **Settings → System → Storage → Add network storage**.
2. Select CIFS, enter the Synology address, user, password and shared-folder name, and choose usage **Share**.
3. Restart PROJECTS after upgrading to 0.7.0 so the new `/share` mapping is active.
4. In PROJECTS open **Settings → Documents & Synology**, choose **Share / Synology**, browse to the mounted folder, and select **Test and save**.

PROJECTS accepts only paths below `/share` or `/media`, validates that the destination is writable, and records the storage location with every uploaded document. Internal storage remains available and is included with the App backup.

PDF and image files open in the browser. Word and Excel files use the device's registered application or download flow because browsers do not include a native Office renderer. Full in-browser Office editing requires a separate OnlyOffice or Collabora service.

## Health checks

Both standalone and Ingress `/health` routes proxy the API health endpoint. A healthy response requires a successful PostgreSQL query.
