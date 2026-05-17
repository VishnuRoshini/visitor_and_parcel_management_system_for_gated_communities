# Resident Query / Complaint Management — Integration Guide

## Quick Summary

This guide explains every change made to your existing VPM project.

---

## 1. Database — Run FIRST

Run the SQL migration before starting the server:

```bash
mysql -u <user> -p <your_database_name> < migration_add_resident_queries.sql
```

The script creates the `resident_queries` table with a foreign key to `users`.

---

## 2. New Files Created

### Backend (`backend/src/`)
| File | Purpose |
|------|---------|
| `models/ResidentQueryModel.ts` | ORM-style model for `resident_queries` table |
| `controllers/QueryController.ts` | All 7 API handler functions |
| `routes/query.routes.ts` | Express router for `/api/queries/*` |

### Frontend (`frontend/src/app/`)
| File | Purpose |
|------|---------|
| `core/models/query.model.ts` | TypeScript interfaces for queries |
| `core/services/query.service.ts` | Angular HTTP service |
| `query/query.module.ts` | Feature module with lazy-loaded routes |
| `query/my-queries/my-queries.component.ts` | Resident tabbed page wrapper |
| `query/query-form/*` | Resident: submit query form |
| `query/query-history/*` | Resident: view own query history |
| `query/admin-query-management/*` | Admin: full query management table |
| `query/query-details-dialog/*` | Admin: dialog to update status & remarks |

### Root
| File | Purpose |
|------|---------|
| `migration_add_resident_queries.sql` | SQL to create `resident_queries` table |

---

## 3. Existing Files Modified

| File | Change |
|------|--------|
| `backend/src/routes/index.ts` | Added `import queryRoutes` + `router.use('/queries', queryRoutes)` |
| `backend/src/socket/index.ts` | Added `join:admin-room` socket event handler |
| `frontend/src/app/app-routing.module.ts` | Added lazy route for `QueryModule` at path `query` |
| `frontend/src/app/app.component.ts` | Added two nav items: "My Queries" (RESIDENT) and "Resident Queries" (ADMIN) |
| `frontend/src/app/shared/shared.module.ts` | Added `MatTabsModule` import + export |

---

## 4. API Routes Added

| Method | Route | Role | Purpose |
|--------|-------|------|---------|
| POST | `/api/queries/create` | RESIDENT | Submit new query |
| GET | `/api/queries/resident/:id` | RESIDENT / ADMIN | Get resident's queries |
| GET | `/api/queries/all` | ADMIN | Get all queries (filterable) |
| GET | `/api/queries/stats` | ADMIN | Dashboard widget stats |
| PATCH | `/api/queries/update-status/:id` | ADMIN | Update status + optional remark |
| PATCH | `/api/queries/remark/:id` | ADMIN | Add/update admin remark |
| DELETE | `/api/queries/delete/:id` | ADMIN | Delete a query |

---

## 5. Socket.IO Events Added

| Event | Direction | Trigger |
|-------|-----------|---------|
| `query:new` | Server → All clients | Resident submits query |
| `query:high-priority` | Server → All clients | High priority query submitted |
| `query:status-updated` | Server → Resident room | Admin updates status |
| `query:resolved` | Server → Resident room | Admin marks as RESOLVED |
| `query:resolved-ack` | Server → All clients | Confirmation for admin |
| `query:remark-added` | Server → Resident room | Admin adds remark |
| `join:admin-room` | Client → Server | Admin joins notification room |

---

## 6. npm Packages

No new packages are required. The feature uses:
- Existing `express`, `typescript`, `mysql2` (backend)
- Existing `@angular/material`, `socket.io-client` (frontend)

---

## 7. Step-by-Step Integration Checklist

```
[ ] 1. Run migration_add_resident_queries.sql against your MySQL database
[ ] 2. Restart the backend server (npm run dev or npm run build && npm start)
[ ] 3. Restart the Angular dev server (ng serve)
[ ] 4. Login as RESIDENT → see "My Queries" in sidebar
[ ] 5. Submit a test query
[ ] 6. Login as ADMIN → see "Resident Queries" in sidebar
[ ] 7. Open query, update status to "RESOLVED"
[ ] 8. Resident receives real-time notification
```

---

## 8. Environment Variables

No new environment variables needed. The feature uses the existing:
- `DB_*` settings from `.env`
- `JWT_SECRET` for auth middleware
- `CORS_ORIGIN` for Socket.IO

---

## Notification Flow

```
Resident submits query
  ↓ Socket: query:new → Admin sees notification + table updates
Admin opens query details dialog
  ↓ Changes status to "IN_PROGRESS" → query:status-updated → Resident sees update
Admin marks "RESOLVED" + adds remark
  ↓ Socket: query:resolved → Resident gets snackbar "Your query has been resolved!"
  ↓ Socket: query:remark-added → Resident sees admin remarks in history
```
