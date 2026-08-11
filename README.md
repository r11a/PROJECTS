# PROJECTS

![PROJECTS logo](brand/projects-logo.svg)

PROJECTS is a premium project-management application for smart-home and low-voltage installation teams. This private repository contains the web application and its Home Assistant App packaging.

## Current status

Version `0.1.1` is an interactive UI/UX pilot. It includes projects, dashboards, maps, clients, forms and finance views. Project edits are currently persisted per browser using `localStorage`.

The next product stage will introduce a backend, PostgreSQL, multi-user synchronization and role-based access control.

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

## Home Assistant installation from this private repository

Home Assistant does not provide a safe built-in GitHub login flow for cloning private App repositories. Do not embed a personal access token in a repository URL.

For the private pilot, install PROJECTS as a Local App:

1. Install the official Samba or SSH App in Home Assistant.
2. Clone/download this private repository on an authenticated computer.
3. Copy the complete `projects/` folder into `/addons/projects` on the HAOS host.
4. In **Settings → Apps → App store**, reload the store.
5. Find **PROJECTS** under **Local Apps**, install it and enable **Show in sidebar**.

This is the Home Assistant-documented path for testing private/local Apps. A later release can publish a pre-built image and a separate distribution repository.

The App exposes:

- Home Assistant Ingress on its internal port `8099`.
- A standalone LAN interface on host port `8686` by default.

The standalone host port is editable from the PROJECTS App **Network** section. Changing it does not require rebuilding the App, and **Open Web UI** follows the effective mapped port automatically. The internal Ingress port remains Supervisor-managed and should not be exposed.

### Pilot security

Ingress is protected by Home Assistant authentication. Port `8686` does not yet have an independent login screen and must remain limited to a trusted LAN. Do not expose it through port forwarding, Cloudflare Tunnel or a public reverse proxy in this release.

## Repository structure

```text
brand/                 Vector brand assets
projects/              Home Assistant App and React application
  config.yaml          Home Assistant App manifest
  Dockerfile           Multi-stage App image
  rootfs/              Nginx and service configuration
  src/                 React source
repository.yaml        Home Assistant repository metadata
```

## Brand

The brand emphasizes **PRO** in **PROJECTS** while retaining a restrained dark-violet visual identity. Editable SVG sources are in [`brand/`](brand/), and Home Assistant PNG assets are generated in the App folder.
