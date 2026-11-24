import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthLanding } from './components/AuthLanding';
import { RepoWorkspace } from './components/RepoWorkspace';
import { CncLandingPage } from './components/CncLandingPage';
import { TopBar } from './components/TopBar';
import type { AuthStatus } from './types/github';

const SESSION_STORAGE_KEY = 'gh_studio_session';
let memorySessionToken: string | null = null;

function setStoredSession(token: string): void {
  memorySessionToken = token;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, token);
  } catch {
    // Ignore storage access restrictions in strict iframes
  }
}

export function getAuthHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  let token = memorySessionToken;
  if (!token) {
    try {
      token = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (token) memorySessionToken = token;
    } catch {
      // Ignore storage access restrictions
    }
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export function clearStoredSession(): void {
  memorySessionToken = null;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export default function App() {
  const isStudioRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/studio');

  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [selectedRepoName, setSelectedRepoName] = useState<string | undefined>(
    undefined
  );
  const [loggingIn, setLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const activePollTimerRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (activePollTimerRef.current !== null) {
      window.clearInterval(activePollTimerRef.current);
      activePollTimerRef.current = null;
    }
  }, []);

  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = (await res.json()) as AuthStatus;
      if (!data.authenticated) {
        clearStoredSession();
      }
      setAuthStatus(data);
    } catch {
      // Ignore transient network errors during boot
    }
  }, []);

  useEffect(() => {
    if (!isStudioRoute) return;
    void fetchAuthStatus();
    return () => stopPolling();
  }, [fetchAuthStatus, isStudioRoute, stopPolling]);

  useEffect(() => {
    if (!isStudioRoute) return;
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        stopPolling();
        if (
          typeof event.data.sessionToken === 'string' &&
          event.data.sessionToken
        ) {
          setStoredSession(event.data.sessionToken);
        }
        setLoggingIn(false);
        setAuthError(null);
        void fetchAuthStatus();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        stopPolling();
        setLoggingIn(false);
        setAuthError(
          typeof event.data.error === 'string'
            ? event.data.error
            : 'GitHub 授权未完成。'
        );
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchAuthStatus, isStudioRoute, stopPolling]);

  if (!isStudioRoute) {
    return <CncLandingPage />;
  }

  const handleLogin = async () => {
    stopPolling();
    setAuthError(null);
    setLoggingIn(true);
    try {
      const res = await fetch('/api/auth/github/url');
      const data = (await res.json()) as {
        url?: string;
        state?: string;
        error?: string;
      };
      if (!res.ok || !data.url || !data.state) {
        setLoggingIn(false);
        setAuthError(data.error || '无法生成 GitHub OAuth 授权链接。');
        return;
      }

      const oauthState = data.state;
      const authWindow = window.open(
        data.url,
        'github_oauth_popup',
        'width=620,height=740'
      );

      if (!authWindow) {
        setLoggingIn(false);
        setAuthError(
          '浏览器拦截了授权弹窗，请允许当前站点打开弹出窗口后重试。'
        );
        return;
      }

      let closedChecksRemaining = 0;

      const pollOnce = async (): Promise<boolean> => {
        try {
          const pollRes = await fetch(
            `/api/auth/poll?state=${encodeURIComponent(oauthState)}`
          );
          if (!pollRes.ok) return false;
          const pollData = (await pollRes.json()) as {
            status: 'pending' | 'completed' | 'error' | 'expired';
            sessionToken?: string;
            error?: string;
          };

          if (pollData.status === 'completed') {
            stopPolling();
            if (pollData.sessionToken) {
              setStoredSession(pollData.sessionToken);
            }
            setLoggingIn(false);
            setAuthError(null);
            await fetchAuthStatus();
            return true;
          }

          if (pollData.status === 'error') {
            stopPolling();
            setLoggingIn(false);
            setAuthError(pollData.error || 'GitHub 授权未完成。');
            return true;
          }

          if (pollData.status === 'expired') {
            stopPolling();
            setLoggingIn(false);
            return true;
          }
        } catch {
          // Ignore transient network poll failures
        }
        return false;
      };

      activePollTimerRef.current = window.setInterval(() => {
        void (async () => {
          const finished = await pollOnce();
          if (finished) return;

          if (authWindow.closed) {
            if (closedChecksRemaining === 0) {
              closedChecksRemaining = 3;
            } else {
              closedChecksRemaining -= 1;
              if (closedChecksRemaining <= 0) {
                stopPolling();
                setLoggingIn(false);
                await fetchAuthStatus();
              }
            }
          }
        })();
      }, 1000);
    } catch (err) {
      setLoggingIn(false);
      setAuthError(err instanceof Error ? err.message : '发起授权请求失败。');
    }
  };

  const handleLogout = async () => {
    stopPolling();
    clearStoredSession();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setSelectedRepoName(undefined);
      await fetchAuthStatus();
    }
  };

  const user = authStatus?.authenticated ? authStatus.user : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        user={user}
        selectedRepoFullName={selectedRepoName}
        onLogin={() => void handleLogin()}
        onLogout={() => void handleLogout()}
        loggingIn={loggingIn}
      />

      {authStatus === null ? (
        <main className="flex-1 flex items-center justify-center p-12">
          <div className="text-sm text-slate-500">正在加载工作台状态...</div>
        </main>
      ) : user ? (
        <RepoWorkspace
          onSelectRepoName={setSelectedRepoName}
          onUnauthorized={() => void fetchAuthStatus()}
        />
      ) : (
        <AuthLanding
          authStatus={authStatus}
          authError={authError}
          loggingIn={loggingIn}
          onLogin={() => void handleLogin()}
        />
      )}
    </div>
  );
}
