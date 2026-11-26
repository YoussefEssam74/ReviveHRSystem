# Gym logos

Fallback brand assets used by the portal sidebar, the HR header and the
attendance station.

A gym's real logo is uploaded through `PUT /api/gyms/{id}/logo` and streamed back
by `GET /api/gyms/{id}/logo`; `GymLogo` requests that endpoint first and only
falls back to these files when the gym has no uploaded logo.
`Client/src/lib/gym-brand.ts` maps the seeded development gyms onto them.

To use a real logo, replace the matching file and keep the file name, or add the
new gym to the maps in `Client/src/lib/gym-brand.ts`. A gym with no mapping
falls back to a monogram tile, so a missing logo never breaks navigation.
