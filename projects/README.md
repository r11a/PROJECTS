# PROJECTS

Premium project management for smart-home professionals, packaged as a Home Assistant App.

## Included

- Executive dashboard and analytics
- Project list and Kanban board
- Interactive project map
- Customer and contact views
- Forms and document views
- Payment and collection overview
- PostgreSQL shared persistence and automatic migrations
- Standalone users with role-based permissions
- Audit logging, health checks, and automatic full backup/restore to internal storage or `/share`
- Detailed customer cards, contacts, files, tasks and site inspections
- Reusable company/external professional directory with multiple roles and optional user access
- Hierarchical system types, systems and components
- Central versioned document repository with project/client assignment and tags
- Configurable catalogs, labels, flags and custom fields
- Live day/week/month/detailed-month/year calendar with project filtering
- Automatic operational insights and aggregated overdue-task snoozing
- Home Assistant Ingress
- Standalone authenticated web interface

The standalone host port defaults to `8686` and can be changed from the App's **Network** section without rebuilding the image. Ingress continues to use its internal Supervisor-managed port.

The initial standalone administrator is configured through `admin_username` and `admin_password` on the App configuration page. Change the default password before use. Internet access should use HTTPS through a VPN or authenticated reverse proxy rather than direct router port forwarding.
