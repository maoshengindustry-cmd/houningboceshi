import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

const PORT = Number(process.env.PORT) || 3000;
const SESSION_COOKIE = 'gh_studio_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  email: string | null;
  public_repos: number;
  total_private_repos?: number;
}

interface SessionPayload {
  token: string;
  user: GitHubUser;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  ghSession?: SessionPayload;
}

const fallbackSecret = crypto.randomBytes(32).toString('hex');
function getEncryptionKey(): Buffer {
  const raw =
    process.env.SESSION_SECRET ||
    process.env.GITHUB_CLIENT_SECRET ||
    fallbackSecret;
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptSession(payload: SessionPayload): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

function decryptSession(cookieValue: string): SessionPayload | null {
  try {
    const parts = cookieValue.split('.');
    if (parts.length !== 3) return null;
    const [ivStr, tagStr, dataStr] = parts;
    const iv = Buffer.from(ivStr, 'base64url');
    const tag = Buffer.from(tagStr, 'base64url');
    const data = Buffer.from(dataStr, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted) as SessionPayload;
    if (!parsed.token || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function getAppUrl(): string {
  const raw = process.env.APP_URL || `http://localhost:${PORT}`;
  return raw.replace(/\/+$/, '');
}

function getCallbackUrl(): string {
  return `${getAppUrl()}/auth/callback`;
}

function isOAuthConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

interface PendingAuthEntry {
  status: 'pending' | 'completed' | 'error';
  sessionToken?: string;
  error?: string;
  exp: number;
}

// In-memory CSRF state & handshake store with 10-minute expiration
const oauthStates = new Map<string, number>();
const pendingAuths = new Map<string, PendingAuthEntry>();

function pruneAuthMaps(): void {
  const now = Date.now();
  for (const [k, exp] of oauthStates.entries()) {
    if (now > exp) oauthStates.delete(k);
  }
  for (const [k, entry] of pendingAuths.entries()) {
    if (now > entry.exp) pendingAuths.delete(k);
  }
}

function createOAuthState(): string {
  pruneAuthMaps();
  const state = crypto.randomBytes(24).toString('hex');
  const exp = Date.now() + 10 * 60 * 1000;
  oauthStates.set(state, exp);
  pendingAuths.set(state, { status: 'pending', exp });
  return state;
}

function consumeOAuthState(state: string | undefined): boolean {
  if (!state) return false;
  const exp = oauthStates.get(state);
  oauthStates.delete(state);
  if (!exp || Date.now() > exp) return false;
  return true;
}

function updatePendingAuth(
  state: string | undefined,
  update: Omit<PendingAuthEntry, 'exp'>
): void {
  if (!state) return;
  if (!pendingAuths.has(state)) return;
  pendingAuths.set(state, {
    ...update,
    exp: Date.now() + 3 * 60 * 1000,
  });
}

function encodeGitHubPath(rawPath: string): string {
  return rawPath
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

async function githubFetch(
  token: string,
  apiPath: string,
  init: RequestInit = {}
): Promise<globalThis.Response> {
  const url = apiPath.startsWith('https://')
    ? apiPath
    : `https://api.github.com${apiPath}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  headers.set('User-Agent', 'GitHub-Repo-Studio');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...init, headers });
}

function setSessionCookie(res: Response, session: SessionPayload): string {
  const encrypted = encryptSession(session);
  res.cookie(SESSION_COOKIE, encrypted, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
  return encrypted;
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });
}

function extractSessionFromRequest(req: Request): {
  session: SessionPayload | null;
  hadInvalidCookie: boolean;
} {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    const bearerSession = decryptSession(bearerToken);
    if (bearerSession) {
      return { session: bearerSession, hadInvalidCookie: false };
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[SESSION_COOKIE];
  if (!raw) {
    return { session: null, hadInvalidCookie: false };
  }
  const cookieSession = decryptSession(raw);
  return {
    session: cookieSession,
    hadInvalidCookie: !cookieSession,
  };
}

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const { session, hadInvalidCookie } = extractSessionFromRequest(req);
  if (!session) {
    if (hadInvalidCookie) clearSessionCookie(res);
    res.status(401).json({ error: '未登录 GitHub，请先完成授权登录。' });
    return;
  }
  req.ghSession = session;
  next();
}

function renderPopupResultHtml(result: {
  ok: boolean;
  error?: string;
  sessionToken?: string;
}): string {
  const messagePayload = JSON.stringify(
    result.ok
      ? { type: 'OAUTH_AUTH_SUCCESS', sessionToken: result.sessionToken || '' }
      : { type: 'OAUTH_AUTH_ERROR', error: result.error || 'GitHub 授权失败' }
  );

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GitHub 授权结果</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f8fafc;
        color: #0f172a;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        padding: 24px;
      }
      .box {
        max-width: 420px;
        width: 100%;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 24px;
        text-align: center;
      }
      h1 { font-size: 18px; margin: 0 0 8px; }
      p { font-size: 14px; color: #475569; margin: 0 0 16px; line-height: 1.5; }
      button {
        background: #0f172a;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 10px 18px;
        font-size: 14px;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div class="box">
      <h1>${result.ok ? 'GitHub 授权成功' : 'GitHub 授权未完成'}</h1>
      <p>${
        result.ok
          ? '主界面已自动同步登录状态，如果此窗口未自动关闭，请手动关闭并返回工作台。'
          : escapeHtml(result.error || '授权流程被取消或发生错误。')
      }</p>
      <button onclick="window.close()">关闭窗口</button>
    </div>
    <script>
      (function() {
        var payload = ${messagePayload};
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, '*');
          }
        } catch (e) {}
        if (${result.ok ? 'true' : 'false'}) {
          setTimeout(function() {
            try { window.close(); } catch (e) {}
          }, 150);
        }
      })();
    </script>
  </body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Auth status endpoint
  app.get('/api/auth/status', async (req: AuthenticatedRequest, res: Response) => {
    const { session, hadInvalidCookie } = extractSessionFromRequest(req);

    if (hadInvalidCookie) {
      clearSessionCookie(res);
    }

    res.json({
      authenticated: Boolean(session),
      oauthConfigured: isOAuthConfigured(),
      callbackUrl: getCallbackUrl(),
      user: session ? session.user : null,
    });
  });

  // Construct GitHub OAuth authorization URL
  app.get('/api/auth/github/url', (_req: Request, res: Response) => {
    if (!isOAuthConfigured()) {
      res.status(503).json({
        error: '尚未配置 GITHUB_CLIENT_ID 或 GITHUB_CLIENT_SECRET。',
        oauthConfigured: false,
        callbackUrl: getCallbackUrl(),
      });
      return;
    }

    const state = createOAuthState();
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: getCallbackUrl(),
      scope: 'repo read:user user:email',
      state,
    });

    const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
    res.json({ url, state });
  });

  // Poll OAuth handshake status (works even when window.opener or 3P cookies are blocked)
  app.get('/api/auth/poll', (req: Request, res: Response) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!state) {
      res.status(400).json({ status: 'expired' });
      return;
    }
    const entry = pendingAuths.get(state);
    if (!entry || Date.now() > entry.exp) {
      pendingAuths.delete(state);
      res.json({ status: 'expired' });
      return;
    }
    if (entry.status === 'pending') {
      res.json({ status: 'pending' });
      return;
    }
    if (entry.status === 'error') {
      pendingAuths.delete(state);
      res.json({ status: 'error', error: entry.error || 'GitHub 授权失败' });
      return;
    }
    pendingAuths.delete(state);
    if (entry.sessionToken) {
      res.cookie(SESSION_COOKIE, entry.sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: SESSION_TTL_MS,
      });
    }
    res.json({ status: 'completed', sessionToken: entry.sessionToken || '' });
  });

  // Logout
  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // GitHub OAuth callback (handles optional trailing slash)
  app.get(['/auth/callback', '/auth/callback/'], async (req: Request, res: Response) => {
    const error = typeof req.query.error === 'string' ? req.query.error : '';
    const errorDescription =
      typeof req.query.error_description === 'string'
        ? req.query.error_description
        : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (error) {
      const msg = errorDescription || error;
      updatePendingAuth(state, { status: 'error', error: msg });
      res.status(400).send(renderPopupResultHtml({ ok: false, error: msg }));
      return;
    }

    if (!code || !consumeOAuthState(state)) {
      const msg = '授权校验状态无效或已过期，请重新点击登录。';
      updatePendingAuth(state, { status: 'error', error: msg });
      res.status(400).send(renderPopupResultHtml({ ok: false, error: msg }));
      return;
    }

    if (!isOAuthConfigured()) {
      const msg = '服务端缺少 GITHUB_CLIENT_ID 或 GITHUB_CLIENT_SECRET。';
      updatePendingAuth(state, { status: 'error', error: msg });
      res.status(500).send(renderPopupResultHtml({ ok: false, error: msg }));
      return;
    }

    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: getCallbackUrl(),
        }),
      });

      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (!tokenRes.ok || !tokenData.access_token) {
        const msg =
          tokenData.error_description ||
          tokenData.error ||
          '无法获取 GitHub Access Token。';
        updatePendingAuth(state, { status: 'error', error: msg });
        res.status(400).send(renderPopupResultHtml({ ok: false, error: msg }));
        return;
      }

      const userRes = await githubFetch(tokenData.access_token, '/user');
      if (!userRes.ok) {
        const msg = '获取 GitHub 用户信息失败。';
        updatePendingAuth(state, { status: 'error', error: msg });
        res.status(400).send(renderPopupResultHtml({ ok: false, error: msg }));
        return;
      }

      const user = (await userRes.json()) as GitHubUser;
      const encryptedSession = setSessionCookie(res, {
        token: tokenData.access_token,
        user,
        exp: Date.now() + SESSION_TTL_MS,
      });

      updatePendingAuth(state, {
        status: 'completed',
        sessionToken: encryptedSession,
      });

      res.send(
        renderPopupResultHtml({ ok: true, sessionToken: encryptedSession })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络请求失败';
      updatePendingAuth(state, { status: 'error', error: message });
      res.status(500).send(renderPopupResultHtml({ ok: false, error: message }));
    }
  });

  // List repositories
  app.get('/api/repos', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const token = req.ghSession!.token;
      const ghRes = await githubFetch(
        token,
        '/user/repos?sort=updated&direction=desc&per_page=100&affiliation=owner,collaborator,organization_member'
      );
      const data = await ghRes.json();
      if (!ghRes.ok) {
        res.status(ghRes.status).json({ error: data.message || '获取仓库列表失败' });
        return;
      }
      res.json({ repos: data });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '请求失败' });
    }
  });

  // Create repository
  app.post('/api/repos', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const token = req.ghSession!.token;
      const { name, description, isPrivate, autoInit } = req.body as {
        name?: string;
        description?: string;
        isPrivate?: boolean;
        autoInit?: boolean;
      };

      if (!name || !name.trim()) {
        res.status(400).json({ error: '请输入仓库名称。' });
        return;
      }

      const ghRes = await githubFetch(token, '/user/repos', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: (description || '').trim(),
          private: Boolean(isPrivate),
          auto_init: autoInit !== false,
        }),
      });
      const data = await ghRes.json();
      if (!ghRes.ok) {
        res.status(ghRes.status).json({ error: data.message || '创建仓库失败' });
        return;
      }
      res.status(201).json({ repo: data });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '请求失败' });
    }
  });

  // List branches
  app.get(
    '/api/repos/:owner/:repo/branches',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const owner = String(req.params.owner);
        const repo = String(req.params.repo);
        const token = req.ghSession!.token;
        const ghRes = await githubFetch(
          token,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`
        );
        const data = await ghRes.json();
        if (!ghRes.ok) {
          res.status(ghRes.status).json({ error: data.message || '获取分支列表失败' });
          return;
        }
        res.json({ branches: data });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : '请求失败' });
      }
    }
  );

  // Create branch
  app.post(
    '/api/repos/:owner/:repo/branches',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const owner = String(req.params.owner);
        const repo = String(req.params.repo);
        const { name, sourceBranch } = req.body as {
          name?: string;
          sourceBranch?: string;
        };

        if (!name || !name.trim() || !sourceBranch) {
          res.status(400).json({ error: '请填写新分支名称并选择基准分支。' });
          return;
        }

        const token = req.ghSession!.token;
        const cleanName = name.trim();
        const refRes = await githubFetch(
          token,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeGitHubPath(sourceBranch)}`
        );
        const refData = await refRes.json();
        if (!refRes.ok || !refData?.object?.sha) {
          res
            .status(refRes.status || 400)
            .json({ error: refData.message || '读取基准分支 SHA 失败' });
          return;
        }

        const createRes = await githubFetch(
          token,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,
          {
            method: 'POST',
            body: JSON.stringify({
              ref: `refs/heads/${cleanName}`,
              sha: refData.object.sha,
            }),
          }
        );
        const createData = await createRes.json();
        if (!createRes.ok) {
          res
            .status(createRes.status)
            .json({ error: createData.message || '创建分支失败' });
          return;
        }

        res.status(201).json({ branch: cleanName, sha: refData.object.sha });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : '请求失败' });
      }
    }
  );

  // List directory contents
  app.get(
    '/api/repos/:owner/:repo/contents',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const owner = String(req.params.owner);
        const repo = String(req.params.repo);
        const dirPath = typeof req.query.path === 'string' ? req.query.path : '';
        const ref = typeof req.query.ref === 'string' ? req.query.ref : '';
        const token = req.ghSession!.token;

        const encodedPath = encodeGitHubPath(dirPath);
        const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '';
        const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents${encodedPath ? `/${encodedPath}` : ''}${qs}`;

        const ghRes = await githubFetch(token, endpoint);
        const data = await ghRes.json();

        if (!ghRes.ok) {
          if (
            ghRes.status === 404 &&
            typeof data.message === 'string' &&
            data.message.toLowerCase().includes('empty')
          ) {
            res.json({ empty: true, items: [] });
            return;
          }
          res.status(ghRes.status).json({ error: data.message || '读取目录失败' });
          return;
        }

        const items = Array.isArray(data) ? data : [data];
        items.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        res.json({ empty: false, items });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : '请求失败' });
      }
    }
  );

  // Read single file
  app.get(
    '/api/repos/:owner/:repo/file',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const owner = String(req.params.owner);
        const repo = String(req.params.repo);
        const filePath = typeof req.query.path === 'string' ? req.query.path : '';
        const ref = typeof req.query.ref === 'string' ? req.query.ref : '';

        if (!filePath) {
          res.status(400).json({ error: '缺少文件路径参数。' });
          return;
        }

        const token = req.ghSession!.token;
        const encodedPath = encodeGitHubPath(filePath);
        const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '';
        const ghRes = await githubFetch(
          token,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${qs}`
        );
        const data = await ghRes.json();
        if (!ghRes.ok) {
          res.status(ghRes.status).json({ error: data.message || '读取文件失败' });
          return;
        }

        if (Array.isArray(data) || data.type !== 'file') {
          res.status(400).json({ error: '目标路径不是文件。' });
          return;
        }

        let rawBase64 = typeof data.content === 'string' ? data.content : '';
        if (!rawBase64 && data.sha && data.size <= 2 * 1024 * 1024) {
          const blobRes = await githubFetch(
            token,
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(data.sha)}`
          );
          if (blobRes.ok) {
            const blobData = await blobRes.json();
            if (typeof blobData.content === 'string') {
              rawBase64 = blobData.content;
            }
          }
        }

        if (!rawBase64 && data.size > 0) {
          res.json({
            name: data.name,
            path: data.path,
            sha: data.sha,
            size: data.size,
            html_url: data.html_url,
            content: '',
            isBinary: false,
            tooLarge: true,
          });
          return;
        }

        const buf = Buffer.from(rawBase64.replace(/\n/g, ''), 'base64');
        const isBinary = buf.includes(0);

        res.json({
          name: data.name,
          path: data.path,
          sha: data.sha,
          size: data.size,
          html_url: data.html_url,
          content: isBinary ? '' : buf.toString('utf8'),
          isBinary,
          tooLarge: false,
        });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : '请求失败' });
      }
    }
  );

  // Create or update file
  app.put(
    '/api/repos/:owner/:repo/file',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const owner = String(req.params.owner);
        const repo = String(req.params.repo);
        const { path: filePath, content, message, sha, branch } = req.body as {
          path?: string;
          content?: string;
          message?: string;
          sha?: string;
          branch?: string;
        };

        if (!filePath || !filePath.trim()) {
          res.status(400).json({ error: '请提供有效的文件路径。' });
          return;
        }
        if (typeof content !== 'string') {
          res.status(400).json({ error: '文件内容格式无效。' });
          return;
        }
        if (!message || !message.trim()) {
          res.status(400).json({ error: '请输入提交信息（Commit Message）。' });
          return;
        }

        const token = req.ghSession!.token;
        const encodedPath = encodeGitHubPath(filePath.trim());
        const bodyPayload: Record<string, string> = {
          message: message.trim(),
          content: Buffer.from(content, 'utf8').toString('base64'),
        };
        if (sha) bodyPayload.sha = sha;
        if (branch) bodyPayload.branch = branch;

        const ghRes = await githubFetch(
          token,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`,
          {
            method: 'PUT',
            body: JSON.stringify(bodyPayload),
          }
        );
        const data = await ghRes.json();
        if (!ghRes.ok) {
          res.status(ghRes.status).json({ error: data.message || '提交文件修改失败' });
          return;
        }

        res.json({
          content: data.content,
          commit: data.commit,
        });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : '请求失败' });
      }
    }
  );

  // Delete file
  app.delete(
    '/api/repos/:owner/:repo/file',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const owner = String(req.params.owner);
        const repo = String(req.params.repo);
        const { path: filePath, message, sha, branch } = req.body as {
          path?: string;
          message?: string;
          sha?: string;
          branch?: string;
        };

        if (!filePath || !sha) {
          res.status(400).json({ error: '删除文件需要提供路径和 SHA。' });
          return;
        }

        const token = req.ghSession!.token;
        const encodedPath = encodeGitHubPath(filePath);
        const bodyPayload: Record<string, string> = {
          message: (message || `Delete ${filePath}`).trim(),
          sha,
        };
        if (branch) bodyPayload.branch = branch;

        const ghRes = await githubFetch(
          token,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`,
          {
            method: 'DELETE',
            body: JSON.stringify(bodyPayload),
          }
        );
        const data = await ghRes.json();
        if (!ghRes.ok) {
          res.status(ghRes.status).json({ error: data.message || '删除文件失败' });
          return;
        }

        res.json({ commit: data.commit });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : '请求失败' });
      }
    }
  );

  // List commits
  app.get(
    '/api/repos/:owner/:repo/commits',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const owner = String(req.params.owner);
        const repo = String(req.params.repo);
        const sha = typeof req.query.sha === 'string' ? req.query.sha : '';
        const token = req.ghSession!.token;

        const params = new URLSearchParams({ per_page: '30' });
        if (sha) params.set('sha', sha);

        const ghRes = await githubFetch(
          token,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${params.toString()}`
        );
        const data = await ghRes.json();
        if (!ghRes.ok) {
          if (ghRes.status === 409) {
            res.json({ commits: [] });
            return;
          }
          res.status(ghRes.status).json({ error: data.message || '获取提交记录失败' });
          return;
        }
        res.json({ commits: data });
      } catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : '请求失败' });
      }
    }
  );

  // Container-local inspection endpoints guarded by a random per-boot nonce file (never externally accessible)
  const localInspectNonce = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync('/tmp/.gh_inspect_nonce', localInspectNonce, { mode: 0o600 });
  } catch {
    // Ignore if /tmp is unavailable
  }

  function getPatToken(): string | undefined {
    return process.env.GITHUB_PAT || process.env.GITHUB_REPO_TOKEN;
  }

  function requireLocalInspect(req: Request, res: Response, next: NextFunction): void {
    const provided = req.headers['x-local-nonce'];
    if (typeof provided !== 'string') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(localInspectNonce, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (!getPatToken()) {
      res.status(503).json({ error: 'GITHUB_PAT not configured' });
      return;
    }
    next();
  }

  app.get('/api/internal/github/repos', requireLocalInspect, async (_req: Request, res: Response) => {
    try {
      const token = getPatToken()!;
      const uRes = await githubFetch(token, '/user');
      const user = await uRes.json();
      const rRes = await githubFetch(
        token,
        '/user/repos?sort=updated&direction=desc&per_page=50&affiliation=owner,collaborator,organization_member'
      );
      const repos = await rRes.json();
      if (!rRes.ok) {
        res.status(rRes.status).json({ error: repos });
        return;
      }
      res.json({
        user: { login: user.login, name: user.name },
        repos: Array.isArray(repos)
          ? repos.map((r) => ({
              full_name: r.full_name,
              private: r.private,
              default_branch: r.default_branch,
              language: r.language,
              updated_at: r.updated_at,
              description: r.description,
              html_url: r.html_url,
            }))
          : [],
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed' });
    }
  });

  app.get('/api/internal/github/tree', requireLocalInspect, async (req: Request, res: Response) => {
    try {
      const owner = String(req.query.owner || '');
      const repo = String(req.query.repo || '');
      const branch = String(req.query.branch || 'main');
      const token = getPatToken()!;
      const ghRes = await githubFetch(
        token,
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`
      );
      const data = await ghRes.json();
      if (!ghRes.ok) {
        res.status(ghRes.status).json({ error: data });
        return;
      }
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed' });
    }
  });

  app.get('/api/internal/github/file', requireLocalInspect, async (req: Request, res: Response) => {
    try {
      const owner = String(req.query.owner || '');
      const repo = String(req.query.repo || '');
      const filePath = String(req.query.path || '');
      const ref = String(req.query.ref || '');
      const token = getPatToken()!;
      const encodedPath = encodeGitHubPath(filePath);
      const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '';
      const ghRes = await githubFetch(
        token,
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}${qs}`
      );
      const data = await ghRes.json();
      if (!ghRes.ok) {
        res.status(ghRes.status).json({ error: data });
        return;
      }
      const raw = typeof data.content === 'string' ? data.content : '';
      const buf = Buffer.from(raw.replace(/\n/g, ''), 'base64');
      res.json({
        path: data.path,
        sha: data.sha,
        size: data.size,
        content: buf.includes(0) ? '[binary]' : buf.toString('utf8'),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed' });
    }
  });

  app.post('/api/internal/github/commit', requireLocalInspect, async (req: Request, res: Response) => {
    try {
      const { owner, repo, branch = 'main', message, files } = req.body as {
        owner: string;
        repo: string;
        branch?: string;
        message: string;
        files: Array<{ path: string; content: string; encoding?: 'utf-8' | 'base64' }>;
      };
      if (!owner || !repo || !message || !Array.isArray(files) || files.length === 0) {
        res.status(400).json({ error: 'Invalid commit payload' });
        return;
      }

      const token = getPatToken()!;
      const repoBase = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

      const refRes = await githubFetch(token, `${repoBase}/git/ref/heads/${encodeGitHubPath(branch)}`);
      const refData = await refRes.json();
      if (!refRes.ok || !refData?.object?.sha) {
        res.status(refRes.status || 400).json({ error: refData });
        return;
      }
      const baseCommitSha = refData.object.sha as string;

      const commitRes = await githubFetch(token, `${repoBase}/git/commits/${baseCommitSha}`);
      const commitData = await commitRes.json();
      if (!commitRes.ok || !commitData?.tree?.sha) {
        res.status(commitRes.status || 400).json({ error: commitData });
        return;
      }
      const baseTreeSha = commitData.tree.sha as string;

      const treeEntries: Array<{ path: string; mode: string; type: string; sha: string }> = [];
      for (const file of files) {
        const blobRes = await githubFetch(token, `${repoBase}/git/blobs`, {
          method: 'POST',
          body: JSON.stringify({
            content: file.content,
            encoding: file.encoding === 'base64' ? 'base64' : 'utf-8',
          }),
        });
        const blobData = await blobRes.json();
        if (!blobRes.ok || !blobData?.sha) {
          res.status(blobRes.status || 400).json({ error: blobData });
          return;
        }
        treeEntries.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha as string,
        });
      }

      const treeRes = await githubFetch(token, `${repoBase}/git/trees`, {
        method: 'POST',
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeEntries,
        }),
      });
      const treeData = await treeRes.json();
      if (!treeRes.ok || !treeData?.sha) {
        res.status(treeRes.status || 400).json({ error: treeData });
        return;
      }

      const newCommitRes = await githubFetch(token, `${repoBase}/git/commits`, {
        method: 'POST',
        body: JSON.stringify({
          message,
          tree: treeData.sha,
          parents: [baseCommitSha],
        }),
      });
      const newCommitData = await newCommitRes.json();
      if (!newCommitRes.ok || !newCommitData?.sha) {
        res.status(newCommitRes.status || 400).json({ error: newCommitData });
        return;
      }

      const updateRefRes = await githubFetch(token, `${repoBase}/git/refs/heads/${encodeGitHubPath(branch)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: newCommitData.sha }),
      });
      const updateRefData = await updateRefRes.json();
      if (!updateRefRes.ok) {
        res.status(updateRefRes.status || 400).json({ error: updateRefData });
        return;
      }

      res.json({
        sha: newCommitData.sha,
        html_url: newCommitData.html_url,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'failed' });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (!isProd || !fs.existsSync(distDir)) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
