import { GitBranch, LogOut } from 'lucide-react';
import type { GitHubUser } from '../types/github';

interface TopBarProps {
  user: GitHubUser | null;
  selectedRepoFullName?: string;
  onLogin: () => void;
  onLogout: () => void;
  loggingIn: boolean;
}

export function TopBar({
  user,
  selectedRepoFullName,
  onLogin,
  onLogout,
  loggingIn,
}: TopBarProps) {
  return (
    <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between gap-8 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <GitBranch className="w-5 h-5 text-slate-900 shrink-0" />
        <span className="font-display text-base font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          GitHub Repo Studio
        </span>
      </div>

      <nav className="hidden md:flex items-center gap-6 text-sm text-slate-500 min-w-0">
        {user && selectedRepoFullName ? (
          <span className="font-mono text-xs text-slate-600 truncate max-w-md whitespace-nowrap">
            当前仓库 / {selectedRepoFullName}
          </span>
        ) : (
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
            GitHub OAuth 授权与仓库在线读写工作台
          </span>
        )}
      </nav>

      <div className="flex items-center gap-3 shrink-0">
        {user ? (
          <div className="flex items-center gap-3">
            <a
              href={user.html_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <img
                src={user.avatar_url}
                alt={user.login}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full border border-slate-200 object-cover bg-slate-100"
              />
              <span className="font-medium whitespace-nowrap">@{user.login}</span>
            </a>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>退出登录</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            disabled={loggingIn}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loggingIn ? '正在打开授权窗口...' : '使用 GitHub 登录'}
          </button>
        )}
      </div>
    </header>
  );
}
