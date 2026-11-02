# ParkSmart - Campus Parking Slot Management and Vehicle Tracking System

## Run
    docker compose up --build
API health: http://localhost:5000/api/health
Default admin: admin@parksmart.local / admin123

## Modules
- Module 1 (backend/src/routes/access.js): roles, vehicles/permits, zones/slots, entry/exit, find my vehicle
- Module 2 (backend/src/routes/visitors.js): QR bookings, violations + points + auto suspension, analytics
