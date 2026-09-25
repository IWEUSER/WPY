/**
 * Layout jump-links (`?preview-career=`, `?practice=1&flight=header`) stay
 * off the live PWA. They work in Vite and on the Vercel preview for this PR.
 */
export function allowLayoutPreview(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_VERCEL_ENV === 'preview';
}
