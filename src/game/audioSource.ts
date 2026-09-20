// expo-audio 0.3 Android wraps local sources in File(uri), so it needs a
// filesystem path instead of a file:// URL. Web and iOS keep their URLs.
export function audioFileUri(uri: string, platform: string): string {
  return platform === 'android' && uri.startsWith('file://')
    ? decodeURIComponent(uri.slice(7)) : uri;
}
