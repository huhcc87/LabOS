/** Avatar letters for a person: first and last name initials ("Mudasir Rashid" -> "MR"), or one letter for a single name. */
export function initials(name?: string | null, fallback = '?'): string {
  const words = (name ?? '').replace(/\(.*?\)/g, '').split(/[\s.]+/).filter(Boolean)
  if (words.length === 0) return fallback
  const first = words[0].charAt(0)
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : ''
  return (first + last).toUpperCase()
}
