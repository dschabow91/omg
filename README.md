# Motherlode CMMS — v3.3

## What's inside
- **Auth (JWT)** — default admin: `admin@motherlode.local` / `admin123`
- **RBAC** — techs edit/delete *their own* WOs/Reports/Handoffs; admin full control
- **Work Orders** — due dates, checklists, comments, "Assign to me"
- **PM Schedules** — admin CRUD, next-due calc in UI
- **Assets** — registry (admin CRUD, everyone can view)
- **Inventory** — adjust qty, admin CRUD
- **Handoff Board** — Open → Picked Up → Done
- **Daily Reports** — structured form + image URLs
- **Reports** — KPIs + CSV export (WOs, Inventory, Reports)
- **Theme** — gradient header/bg, lifted panels; "Motherlode" shown once

## Dev quick start
```bash
# Backend
cd backend
npm install
npm run dev   # http://localhost:8080

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:5173
```
Vite is set to proxy `/api/*` to `http://localhost:8080` during dev — no env needed.

## v3.4 (medium-complexity pack)
- **Asset QR codes** (SVG generator + print/download)
- **Work Order Templates** (admin CRUD; create from WO modal; "From Template" on WOs)
- **Bulk Edit** for Work Orders (status, assign-to-me, bulk delete with permissions)
- **Dashboard** adds **Overdue WOs**
- **Theme**: Auto / Light / Dark (follows system when on Auto)


## v3.5
- **Cancel buttons** fixed globally (no more weird navigation)
- **WO Edit** stability: safer defaults to prevent blank page
- **Technician dropdowns** for Assign To (pulls from Technicians list)
- **Assets integrated**: asset dropdowns on WOs & PMs; quick "New WO" from Assets
- **Daily Reports uploads**: real file upload to `/api/upload`, served from `/uploads`
- **Profile page** with change password
