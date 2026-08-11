# PROJECTS

Premium project management for smart-home professionals, packaged as a Home Assistant App.

## Included in the pilot

- Executive dashboard and analytics
- Project list and Kanban board
- Interactive project map
- Customer and contact views
- Forms and document views
- Payment and collection overview
- Home Assistant Ingress
- Standalone LAN web interface

The standalone host port defaults to `8686` and can be changed from the App's **Network** section without rebuilding the image. Ingress continues to use its internal Supervisor-managed port.

> The pilot stores edits locally in the browser. Do not expose the standalone port directly to the Internet until application authentication is added.
