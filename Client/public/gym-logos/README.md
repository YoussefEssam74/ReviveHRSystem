# Gym logos

The development brand assets used by the portal sidebar, the HR header and the
attendance station. The gym record has no logo column yet, so `lib/gym-brand.ts`
maps the seeded gym names/ids to these files.

To use a real logo, replace the matching file and keep the file name, or add the
new gym to the maps in `Client/src/lib/gym-brand.ts`. A gym with no mapping
falls back to a monogram tile, so a missing logo never breaks navigation.
