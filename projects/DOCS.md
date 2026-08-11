# PROJECTS

PROJECTS is an initial Home Assistant App for managing smart-home installation projects.

## Access

- Use **Open Web UI** for the standalone interface on port `8686`.
- Use the **PROJECTS** sidebar entry for authenticated Home Assistant Ingress.

## Pilot security notice

Ingress is authenticated by Home Assistant. The standalone port is intended for trusted LAN access during the pilot and does not yet provide its own login screen. Do not expose port `8686` directly to the Internet.

## Persistence

This initial UI validation release stores edits in each browser's local storage. Multi-user storage, PostgreSQL and role-based permissions are planned for the next stage.
