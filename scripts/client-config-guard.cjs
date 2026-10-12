// Expo inlines EXPO_PUBLIC_* values into the app. Validate before bundling.
function jwtRole(value) {
  try {
    const parts = value.split('.');
    if (parts.length !== 3) return undefined;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role;
  } catch { return undefined; }
}

function assertPublicClientConfig(env) {
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('EXPO_PUBLIC_') || !value) continue;
    if (/SECRET|PRIVATE|SERVICE_ROLE|PASSWORD/i.test(name) ||
        value.includes('sb_secret_') || /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(value) ||
        jwtRole(value) === 'service_role') {
      // Never include the value in build logs.
      throw new Error(`Refusing to bundle a server credential in ${name}. Use server-only configuration.`);
    }
  }
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  if (key && !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && jwtRole(key) !== 'anon') {
    throw new Error('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must contain a publishable key or legacy anon key.');
  }
}

module.exports = { assertPublicClientConfig };
