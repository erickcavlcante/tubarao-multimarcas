/**
 * Um destino de redirecionamento só é seguro se resolver para a MESMA origem.
 * Checar `startsWith("/")` não basta: "//evil.com" passa nessa checagem e o
 * navegador resolve como protocolo-relativo, indo parar em evil.com.
 */
export function isSafeRedirectPath(url: string | null | undefined, origin: string): url is string {
  if (!url) {
    return false;
  }
  try {
    return new URL(url, origin).origin === origin;
  } catch {
    return false;
  }
}
