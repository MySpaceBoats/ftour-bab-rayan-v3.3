/**
 * CMS Handlers for Decap CMS Integration
 * 
 * Implements the OAuth proxy and Git Gateway endpoints required by Decap CMS
 * to work with Supabase Auth and GitHub App authentication.
 * 
 * Endpoints:
 * - GET  /api/cms/session  : Validate Supabase session and return user info
 * - GET  /api/cms/auth     : Initiate OAuth flow (redirect to Supabase login)
 * - GET  /api/cms/callback : Handle OAuth callback
 * - *    /api/cms/*        : Proxy GitHub API requests
 * 
 * Security:
 * - Only users with role 'admin' or 'super_admin' can access the CMS
 * - GitHub tokens are never exposed to the client
 * - CORS is strictly limited to allowed origins
 */

import { createClient } from '@supabase/supabase-js';
import { proxyGitHubRequest, GitHubAppConfig } from './github-app';

// ============================================
// TYPES
// ============================================

export interface CMSEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_INSTALLATION_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  CMS_ALLOWED_ORIGINS?: string;
}

interface UserSession {
  id: string;
  email: string;
  role: string;
  name?: string;
}

// ============================================
// CONSTANTS
// ============================================

const GITHUB_REPO_OWNER = 'MySpaceBoats';
const GITHUB_REPO_NAME = 'ftour-bab-rayan-v2';
const GITHUB_BRANCH = 'main';
const CONTENT_PATH = 'content';

const ADMIN_ROLES = ['admin', 'super_admin'];

// ============================================
// CORS HEADERS
// ============================================

function getCorsHeaders(origin: string, env: CMSEnv): Record<string, string> {
  const allowedOrigins = new Set([
    'https://ftourbabrayan.ma',
    'https://www.ftourbabrayan.ma',
    'https://ftour-bab-rayan-v2.pages.dev',
    ...(env.CMS_ALLOWED_ORIGINS?.split(',') || []),
  ]);
  
  const allowOrigin = allowedOrigins.has(origin) ? origin : 'https://www.ftourbabrayan.ma';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

// ============================================
// SESSION VALIDATION
// ============================================

/**
 * Validate Supabase session from Authorization header
 * Returns user info if valid admin, null otherwise
 */
async function validateSession(request: Request, env: CMSEnv): Promise<UserSession | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  
  // Create Supabase client with the user's token
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  
  // Get the user from the token
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    console.error('[CMS] Auth error:', authError?.message);
    return null;
  }
  
  // Get user profile with role from users table
  const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile, error: profileError } = await adminClient
    .from('users')
    .select('id, email, role, name')
    .eq('email', user.email)
    .single();
  
  if (profileError || !profile) {
    console.error('[CMS] Profile error:', profileError?.message);
    return null;
  }
  
  // Check if user has admin role
  if (!ADMIN_ROLES.includes(profile.role)) {
    console.warn('[CMS] Access denied for non-admin user:', profile.email);
    return null;
  }
  
  return {
    id: profile.id.toString(),
    email: profile.email,
    role: profile.role,
    name: profile.name,
  };
}

// ============================================
// HANDLERS
// ============================================

/**
 * Handle /api/cms/session - Return current session info
 */
async function handleSession(request: Request, env: CMSEnv): Promise<Response> {
  const origin = request.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin, env);
  
  const session = await validateSession(request, env);
  
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify({
    user: {
      id: session.id,
      email: session.email,
      name: session.name || session.email,
      role: session.role,
    },
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle /api/cms/auth - Initiate OAuth flow
 * For Decap CMS, we use implicit flow with Supabase
 */
async function handleAuth(request: Request, env: CMSEnv): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin, env);
  
  // Return auth configuration for Decap CMS
  // Decap will handle the actual OAuth flow with Supabase
  return new Response(JSON.stringify({
    provider: 'supabase',
    site_url: 'https://www.ftourbabrayan.ma',
    auth_url: `${env.SUPABASE_URL}/auth/v1/authorize`,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle GitHub API proxy requests
 * All requests to /api/cms/github/* are proxied to GitHub API
 */
async function handleGitHubProxy(
  request: Request,
  env: CMSEnv,
  path: string
): Promise<Response> {
  const origin = request.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin, env);
  
  // Validate session first
  const session = await validateSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Log access for audit
  console.log(`[CMS] GitHub API access by ${session.email}: ${request.method} ${path}`);
  
  // Prepare GitHub App config
  const githubConfig: GitHubAppConfig = {
    appId: env.GITHUB_APP_ID,
    installationId: env.GITHUB_APP_INSTALLATION_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  };
  
  // Get request body if present
  let body: string | null = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
  }
  
  try {
    // Proxy the request to GitHub
    const githubResponse = await proxyGitHubRequest(
      githubConfig,
      path,
      request.method,
      body
    );
    
    // Clone the response and add CORS headers
    const responseBody = await githubResponse.text();
    
    return new Response(responseBody, {
      status: githubResponse.status,
      headers: {
        ...corsHeaders,
        'Content-Type': githubResponse.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error) {
    console.error('[CMS] GitHub proxy error:', error);
    return new Response(JSON.stringify({ error: 'GitHub API error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle content operations (CRUD for content files)
 * Maps Decap CMS operations to GitHub API calls
 */
async function handleContentOperation(
  request: Request,
  env: CMSEnv,
  contentPath: string
): Promise<Response> {
  const origin = request.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin, env);
  
  // Validate session
  const session = await validateSession(request, env);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const githubConfig: GitHubAppConfig = {
    appId: env.GITHUB_APP_ID,
    installationId: env.GITHUB_APP_INSTALLATION_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  };
  
  const fullPath = `${CONTENT_PATH}/${contentPath}`;
  const repoPath = `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${fullPath}`;
  
  try {
    switch (request.method) {
      case 'GET': {
        // Get file content
        const response = await proxyGitHubRequest(
          githubConfig,
          `${repoPath}?ref=${GITHUB_BRANCH}`,
          'GET'
        );
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'PUT':
      case 'POST': {
        // Create or update file
        const body = await request.json() as { content: string; message?: string; sha?: string };
        
        // First, try to get existing file SHA if updating
        let sha = body.sha;
        if (!sha && request.method === 'PUT') {
          try {
            const existingResponse = await proxyGitHubRequest(
              githubConfig,
              `${repoPath}?ref=${GITHUB_BRANCH}`,
              'GET'
            );
            if (existingResponse.ok) {
              const existing = await existingResponse.json() as { sha: string };
              sha = existing.sha;
            }
          } catch {
            // File doesn't exist, will create new
          }
        }
        
        const commitMessage = body.message || `Update ${contentPath} via CMS by ${session.email}`;
        
        const updateBody = {
          message: commitMessage,
          content: body.content, // Should be base64 encoded
          branch: GITHUB_BRANCH,
          ...(sha ? { sha } : {}),
          committer: {
            name: session.name || session.email,
            email: session.email,
          },
        };
        
        const response = await proxyGitHubRequest(
          githubConfig,
          repoPath,
          'PUT',
          JSON.stringify(updateBody)
        );
        
        const data = await response.json();
        
        // Log the commit
        console.log(`[CMS] Content ${sha ? 'updated' : 'created'}: ${fullPath} by ${session.email}`);
        
        return new Response(JSON.stringify(data), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      case 'DELETE': {
        // Delete file
        const body = await request.json() as { sha: string; message?: string };
        
        const deleteBody = {
          message: body.message || `Delete ${contentPath} via CMS by ${session.email}`,
          sha: body.sha,
          branch: GITHUB_BRANCH,
          committer: {
            name: session.name || session.email,
            email: session.email,
          },
        };
        
        const response = await proxyGitHubRequest(
          githubConfig,
          repoPath,
          'DELETE',
          JSON.stringify(deleteBody)
        );
        
        console.log(`[CMS] Content deleted: ${fullPath} by ${session.email}`);
        
        return new Response(null, {
          status: response.status,
          headers: corsHeaders,
        });
      }
      
      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('[CMS] Content operation error:', error);
    return new Response(JSON.stringify({ error: 'Content operation failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// ============================================
// MAIN HANDLER
// ============================================

/**
 * Main CMS request handler
 * Routes requests to appropriate handlers based on path
 */
export async function handleCMSRequest(
  request: Request,
  env: CMSEnv,
  path: string
): Promise<Response> {
  const origin = request.headers.get('Origin') || '';
  const corsHeaders = getCorsHeaders(origin, env);
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Route to appropriate handler
  if (path === '/session' || path === '/session/') {
    return handleSession(request, env);
  }
  
  if (path === '/auth' || path === '/auth/') {
    return handleAuth(request, env);
  }
  
  if (path.startsWith('/github/')) {
    // Proxy GitHub API requests
    const githubPath = path.substring(7); // Remove '/github'
    return handleGitHubProxy(request, env, githubPath);
  }
  
  if (path.startsWith('/content/')) {
    // Handle content operations
    const contentPath = path.substring(9); // Remove '/content/'
    return handleContentOperation(request, env, contentPath);
  }
  
  // List repository contents (for file browser)
  if (path === '/tree' || path.startsWith('/tree/')) {
    const treePath = path === '/tree' ? '' : path.substring(6);
    const fullPath = treePath ? `${CONTENT_PATH}/${treePath}` : CONTENT_PATH;
    const githubPath = `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${fullPath}?ref=${GITHUB_BRANCH}`;
    return handleGitHubProxy(request, env, githubPath);
  }
  
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
