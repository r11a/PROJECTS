# PROJECTS

![PROJECTS logo](brand/projects-logo.svg)

PROJECTS is a premium project-management application for smart-home and low-voltage installation teams. This repository contains the full application and its Home Assistant App packaging.

## Current status

Version `0.2.0` is a single full-stack Home Assistant App containing the React frontend, Node API, PostgreSQL, database migrations, role-based users, audit logging, health checks and backup/restore tooling. Project changes are shared between users and persisted under the App's `/data` volume.

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
