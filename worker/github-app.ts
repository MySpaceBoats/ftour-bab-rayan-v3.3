/**
 * GitHub App Authentication Module
 * Generates installation access tokens for secure Git operations
 * 
 * This module implements GitHub App authentication using JWT and
 * installation tokens, following GitHub's recommended security practices.
 * 
 * @see https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app
 */

// ============================================
// TYPES
// ============================================

export interface GitHubAppConfig {
  appId: string;
  installationId: string;
  privateKey: string;
}

export interface InstallationToken {
  token: string;
  expires_at: string;
}

// ============================================
// JWT GENERATION (RS256)
// ============================================

/**
 * Generate a JWT for GitHub App authentication
 * Uses RS256 algorithm with the app's private key
 */
async function generateJWT(appId: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  
  const payload = {
    iat: now - 60, // Issued 60 seconds ago (clock skew tolerance)
    exp: now + 600, // Expires in 10 minutes (max allowed by GitHub)
    iss: appId,
  };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  
  const signature = await signRS256(signingInput, privateKey);
  
  return `${signingInput}.${signature}`;
}

/**
 * Base64 URL encode (RFC 4648)
 */
function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sign data using RS256 (RSA-SHA256)
 */
async function signRS256(data: string, privateKeyPem: string): Promise<string> {
  // Parse PEM to extract the key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  // Import the private key
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    convertPKCS1ToPKCS8(binaryKey),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
  
  // Sign the data
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(data)
  );
  
  // Convert to base64url
  const signatureArray = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  return signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert PKCS#1 RSA private key to PKCS#8 format
 * GitHub provides PKCS#1 keys, but Web Crypto API requires PKCS#8
 */
function convertPKCS1ToPKCS8(pkcs1Key: Uint8Array): ArrayBuffer {
  // PKCS#8 wrapper for RSA private key
  // OID for rsaEncryption: 1.2.840.113549.1.1.1
  const pkcs8Header = new Uint8Array([
    0x30, 0x82, // SEQUENCE
    0x00, 0x00, // Length placeholder (will be filled)
    0x02, 0x01, 0x00, // INTEGER 0 (version)
    0x30, 0x0d, // SEQUENCE (AlgorithmIdentifier)
    0x06, 0x09, // OID
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // rsaEncryption OID
    0x05, 0x00, // NULL
    0x04, 0x82, // OCTET STRING
    0x00, 0x00, // Length placeholder (will be filled)
  ]);
  
  // Calculate lengths
  const keyLength = pkcs1Key.length;
  const totalLength = pkcs8Header.length - 4 + keyLength;
  
  // Create the PKCS#8 key
  const pkcs8Key = new Uint8Array(4 + totalLength);
  pkcs8Key.set(pkcs8Header);
  pkcs8Key.set(pkcs1Key, pkcs8Header.length);
  
  // Fill in the length fields
  pkcs8Key[2] = (totalLength >> 8) & 0xff;
  pkcs8Key[3] = totalLength & 0xff;
  pkcs8Key[pkcs8Header.length - 2] = (keyLength >> 8) & 0xff;
  pkcs8Key[pkcs8Header.length - 1] = keyLength & 0xff;
  
  return pkcs8Key.buffer;
}

// ============================================
// INSTALLATION TOKEN
// ============================================

/**
 * Get an installation access token for the GitHub App
 * This token is short-lived (1 hour) and scoped to the installation
 */
export async function getInstallationToken(config: GitHubAppConfig): Promise<InstallationToken> {
  const jwt = await generateJWT(config.appId, config.privateKey);
  
  const response = await fetch(
    `https://api.github.com/app/installations/${config.installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ftour-bab-rayan-cms',
      },
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[GitHub App] Failed to get installation token:', error);
    throw new Error(`Failed to get installation token: ${response.status}`);
  }
  
  const data = await response.json() as InstallationToken;
  return data;
}

// ============================================
// GITHUB API PROXY
// ============================================

/**
 * Proxy a request to the GitHub API using the installation token
 */
export async function proxyGitHubRequest(
  config: GitHubAppConfig,
  path: string,
  method: string,
  body?: string | null,
  additionalHeaders?: Record<string, string>
): Promise<Response> {
  const token = await getInstallationToken(config);
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token.token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ftour-bab-rayan-cms',
    ...additionalHeaders,
  };
  
  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers,
    body: method !== 'GET' ? body : undefined,
  });
  
  return response;
}
