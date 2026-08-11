# PROJECTS

PROJECTS is a full-stack Home Assistant App for managing smart-home installation projects.

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

## Health checks

Both standalone and Ingress `/health` routes proxy the API health endpoint. A healthy response requires a successful PostgreSQL query.
