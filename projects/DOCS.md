# PROJECTS

PROJECTS is an initial Home Assistant App for managing smart-home installation projects.

## Access

- Use **Open Web UI** for the standalone interface. Its default host port is `8686`.
- Use the **PROJECTS** sidebar entry for authenticated Home Assistant Ingress.

## Changing the standalone port

Open the PROJECTS App page, expand **Network**, change the host port mapped to `8686/tcp`, save and restart the App. For example, you can map the internal port to host port `9080` without rebuilding the App. **Open Web UI** automatically uses the effective host port.

Leave the mapping disabled if you want to use PROJECTS through Ingress only. The internal Ingress port `8099` is managed by Home Assistant and should not be exposed or changed.

## Pilot security notice

Ingress is authenticated by Home Assistant. The standalone port is intended for trusted LAN access during the pilot and does not yet provide its own login screen. Do not expose port `8686` directly to the Internet.

## Persistence

This initial UI validation release stores edits in each browser's local storage. Multi-user storage, PostgreSQL and role-based permissions are planned for the next stage.
