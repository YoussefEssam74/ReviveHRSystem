/**
 * Seeded gym branding. The API has no logo field yet, so the client maps the
 * known development gyms onto the files under Client/public/gym-logos/. Real
 * logos can replace those files without touching the components; an unknown gym
 * falls back to a monogram of its name.
 */
const LOGO_BY_NAME: Record<string, string> = {
  'revive main gym': '/gym-logos/revive-main-gym.svg',
  'revive second gym': '/gym-logos/revive-second-gym.svg',
}

/** Fallback when only an id is known (seeded gyms 1 = Main, 2 = Second). */
const LOGO_BY_ID: Record<number, string> = {
  1: '/gym-logos/revive-main-gym.svg',
  2: '/gym-logos/revive-second-gym.svg',
}

export interface GymBrandInput {
  id?: number | null
  name?: string | null
  /** The session/me spelling of the same fields. */
  gymId?: number | null
  gymName?: string | null
}

/** Logo URL for a gym, or null when no seeded logo matches. */
export function gymLogoUrl(gym: GymBrandInput | null | undefined): string | null {
  if (!gym) return null

  const name = (gym.name ?? gym.gymName)?.trim().toLowerCase()
  if (name && LOGO_BY_NAME[name]) return LOGO_BY_NAME[name]

  const id = gym.id ?? gym.gymId
  return id != null ? LOGO_BY_ID[id] ?? null : null
}

/** 1–2 letters for the logo fallback (the first two words of the gym name). */
export function gymMonogram(name: string | null | undefined): string {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('') || 'G'
}
