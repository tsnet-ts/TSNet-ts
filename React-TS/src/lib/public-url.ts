/** Resolve a path under `public/` for the current Vite base (e.g. `/TSNet-ts/` on GitHub Pages). */
export function publicUrl(path: string): string {
  const normalized = path.replace(/^\//, '');
  return `${import.meta.env.BASE_URL}${normalized}`;
}
