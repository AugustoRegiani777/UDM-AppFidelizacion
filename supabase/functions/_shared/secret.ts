/** Comparación en tiempo constante de un secreto (no filtra datos por diferencias de tiempo). */
export function sameSecret(received: string, expected: string): boolean {
  if (!expected || received.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= received.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}
