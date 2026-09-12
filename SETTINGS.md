# SciAgent Protocol — Settings & Profile Management

## Overview

The settings subsystem manages user profile metadata, academic credentials (ORCID ID verification), linked wallet associations, and project-level administration settings.

---

## API Endpoints

### 1. User Account Settings
- `GET /api/user/settings` — Retrieve profile metadata and linked wallet records.
- `PUT /api/user/settings` — Update display name, bio, ORCID ID, and wallet settings (`userSettingsSchema`).

### 2. Project Administration Settings
- `GET /api/projects/[id]/settings` — Retrieve project configuration and metadata (Owner / Admin only).
- `PUT /api/projects/[id]/settings` — Update project title, metadata URI, and lifecycle status transition (`projectSettingsSchema`).
