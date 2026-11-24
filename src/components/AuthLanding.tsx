import { useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  FileCode2,
  FolderGit2,
  GitBranch,
  History,
  KeyRound,
} from 'lucide-react';
import type { AuthStatus } from '../types/github';

interface AuthLandingProps {
  authStatus: AuthStatus | null;
  authError: string | null;
  loggingIn: boolean;
  onLogin: () => void;
}

export function AuthLanding({
  authStatus,
  authError,
  loggingIn,
  onLogin,
}: AuthLandingProps) {
  const [copied, setCopied] = useState(false);

  const callbackUrl =
    authStatus?.callbackUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : '');

  const handleCopyCallback = async () => {
    if (!callbackUrl) return;
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  const oauthReady = authStatus?.oauthConfigured ?? false;

  return (
    <main className="flex-1 bg-slate-50 py-12 px-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8">
          <div className="text-xs font-medium text-slate-500 mb-3">
            GitHub OAuth 工作台 · 实时读写远程仓库
          </div>
          <h1
            className="font-display text-3xl font-bold tracking-tight text-slate-900 mb-4"
            style={{ textWrap: 'balance' }}
          >
            登录 GitHub 账号，在线浏览与修改你的代码仓库
          </h1>
          <p className="text-[15px] leading-relaxed text-slate-600 mb-8 max-w-xl">
            通过 GitHub 官方 OAuth 弹窗完成安全授权后，你可以直接列出名下公开与私有仓库、切换或新建分支、查看提交历史，并在线编辑、创建或删除文件并提交 Commit。
          </p>

          {authError && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
              <span>{authError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 mb-10">
            <button
              type="button"
              onClick={onLogin}
              disabled={loggingIn || !oauthReady}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderGit2 className="w-4 h-4" />
              <span>
                {loggingIn ? '等待 GitHub 授权完成...' : '使用 GitHub 登录'}
              </span>
            </button>
            {!oauthReady && authStatus !== null && (
              <span className="text-xs text-amber-700 font-medium">
                需先在右侧完成 OAuth 环境变量配置后方可登录
              </span>
            )}
          </div>

          <div className="border-t border-slate-200 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-1">
                <FileCode2 className="w-4 h-4 text-slate-600" />
                <span>在线读写文件</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                浏览目录树、编辑代码与文档、新建或删除文件并生成真实 Commit。
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-1">
                <GitBranch className="w-4 h-4 text-slate-600" />
                <span>分支切换与创建</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                支持跨分支读取目录结构，或基于任意基准分支新建开发分支。
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-1">
                <History className="w-4 h-4 text-slate-600" />
                <span>提交历史追踪</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                实时查看当前分支的最近 Commit 记录、作者与变更时间。
              </p>
            </div>
          </div>
        </section>

        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-600" />
              <span>GitHub OAuth 应用配置</span>
            </h2>
            <span
              className={`text-xs font-medium ${
                oauthReady ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {authStatus === null
                ? '检查中...'
                : oauthReady
                ? '密钥已就绪'
                : '待配置密钥'}
            </span>
          </div>

          <ol className="space-y-4 text-xs text-slate-600 leading-relaxed">
            <li>
              <div className="font-medium text-slate-900 mb-1">
                1. 在 GitHub 创建 OAuth App
              </div>
              <p className="mb-1.5">
                前往 GitHub Developer Settings 新建 OAuth App：
              </p>
              <a
                href="https://github.com/settings/developers"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
              >
                <span>github.com/settings/developers</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>

            <li>
              <div className="font-medium text-slate-900 mb-1">
                2. 填写 Authorization callback URL
              </div>
              <p className="mb-2">
                将下方完整回调地址复制到 GitHub OAuth App 的回调 URL 栏位：
              </p>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <code className="font-mono text-[11px] text-slate-800 break-all flex-1">
                  {callbackUrl}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCallback}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>复制</span>
                    </>
                  )}
                </button>
              </div>
            </li>

            <li>
              <div className="font-medium text-slate-900 mb-1">
                3. 配置环境变量（Secrets）
              </div>
              <p className="mb-2">
                在运行环境的 Secrets / 环境变量中填入以下两项：
              </p>
              <div className="font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-slate-700">
                <div>GITHUB_CLIENT_ID=&quot;你的 Client ID&quot;</div>
                <div>GITHUB_CLIENT_SECRET=&quot;你的 Client Secret&quot;</div>
              </div>
            </li>
          </ol>
        </aside>
      </div>
    </main>
  );
}
