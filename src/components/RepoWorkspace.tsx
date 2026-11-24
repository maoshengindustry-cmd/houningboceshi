import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  File as FileIcon,
  FilePlus2,
  Folder,
  FolderPlus,
  GitBranch,
  History,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  GitHubBranch,
  GitHubCommit,
  GitHubContentItem,
  GitHubFileDetail,
  GitHubRepo,
} from '../types/github';
import { clearStoredSession, getAuthHeaders } from '../App';
import {
  CreateBranchModal,
  CreateFileModal,
  CreateRepoModal,
} from './Modals';

interface RepoWorkspaceProps {
  onSelectRepoName: (fullName: string | undefined) => void;
  onUnauthorized: () => void;
}

type VisibilityFilter = 'all' | 'public' | 'private';
type WorkspaceTab = 'files' | 'commits';

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function RepoWorkspace({
  onSelectRepoName,
  onUnauthorized,
}: RepoWorkspaceProps) {
  // Repositories state
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [repoSearch, setRepoSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>('all');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

  // Branch & tab state
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('files');

  // Directory & file state
  const [currentDir, setCurrentDir] = useState<string>('');
  const [dirItems, setDirItems] = useState<GitHubContentItem[]>([]);
  const [repoEmpty, setRepoEmpty] = useState(false);
  const [loadingDir, setLoadingDir] = useState(false);

  const [selectedFile, setSelectedFile] = useState<GitHubFileDetail | null>(
    null
  );
  const [loadingFile, setLoadingFile] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [savingFile, setSavingFile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingFile, setDeletingFile] = useState(false);

  // Commits state
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(false);

  // Feedback & Modals
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    text: string;
    url?: string;
  } | null>(null);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [showRepoModal, setShowRepoModal] = useState(false);

  const apiRequest = useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const headers = getAuthHeaders(init?.headers);
      const res = await fetch(url, { ...init, headers });
      if (res.status === 401) {
        clearStoredSession();
        onUnauthorized();
        throw new Error('登录已失效，请重新授权登录。');
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '请求 GitHub 接口失败');
      }
      return data as T;
    },
    [onUnauthorized]
  );

  const loadRepos = useCallback(
    async (selectFullName?: string) => {
      setLoadingRepos(true);
      setErrorMsg(null);
      try {
        const data = await apiRequest<{ repos: GitHubRepo[] }>('/api/repos');
        setRepos(data.repos);
        if (selectFullName) {
          const matched = data.repos.find((r) => r.full_name === selectFullName);
          if (matched) setSelectedRepo(matched);
        } else if (!selectedRepo && data.repos.length > 0) {
          setSelectedRepo(data.repos[0]);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : '加载仓库失败');
      } finally {
        setLoadingRepos(false);
      }
    },
    [apiRequest, selectedRepo]
  );

  useEffect(() => {
    void loadRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onSelectRepoName(selectedRepo?.full_name);
  }, [selectedRepo, onSelectRepoName]);

  const loadBranchesAndRoot = useCallback(
    async (repo: GitHubRepo) => {
      setErrorMsg(null);
      setNotice(null);
      setSelectedFile(null);
      setEditorContent('');
      setCommitMessage('');
      setConfirmDelete(false);
      setCurrentDir('');
      try {
        const branchData = await apiRequest<{ branches: GitHubBranch[] }>(
          `/api/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/branches`
        );
        setBranches(branchData.branches);
        const defaultName =
          branchData.branches.find((b) => b.name === repo.default_branch)
            ?.name ||
          branchData.branches[0]?.name ||
          repo.default_branch ||
          'main';
        setCurrentBranch(defaultName);
      } catch (err) {
        setBranches([]);
        setCurrentBranch(repo.default_branch || 'main');
        setErrorMsg(err instanceof Error ? err.message : '读取分支失败');
      }
    },
    [apiRequest]
  );

  useEffect(() => {
    if (selectedRepo) {
      void loadBranchesAndRoot(selectedRepo);
    }
  }, [selectedRepo, loadBranchesAndRoot]);

  const loadDirectory = useCallback(
    async (repo: GitHubRepo, dirPath: string, branch: string) => {
      setLoadingDir(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams();
        if (dirPath) params.set('path', dirPath);
        if (branch) params.set('ref', branch);
        const data = await apiRequest<{
          empty: boolean;
          items: GitHubContentItem[];
        }>(
          `/api/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/contents?${params.toString()}`
        );
        setRepoEmpty(data.empty);
        setDirItems(data.items);
      } catch (err) {
        setDirItems([]);
        setErrorMsg(err instanceof Error ? err.message : '读取目录失败');
      } finally {
        setLoadingDir(false);
      }
    },
    [apiRequest]
  );

  const loadCommits = useCallback(
    async (repo: GitHubRepo, branch: string) => {
      setLoadingCommits(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams();
        if (branch) params.set('sha', branch);
        const data = await apiRequest<{ commits: GitHubCommit[] }>(
          `/api/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/commits?${params.toString()}`
        );
        setCommits(data.commits);
      } catch (err) {
        setCommits([]);
        setErrorMsg(err instanceof Error ? err.message : '获取提交历史失败');
      } finally {
        setLoadingCommits(false);
      }
    },
    [apiRequest]
  );

  useEffect(() => {
    if (!selectedRepo || !currentBranch) return;
    if (activeTab === 'files') {
      void loadDirectory(selectedRepo, currentDir, currentBranch);
    } else {
      void loadCommits(selectedRepo, currentBranch);
    }
  }, [
    selectedRepo,
    currentBranch,
    currentDir,
    activeTab,
    loadDirectory,
    loadCommits,
  ]);

  const openFile = useCallback(
    async (filePath: string) => {
      if (!selectedRepo) return;
      setLoadingFile(true);
      setErrorMsg(null);
      setConfirmDelete(false);
      try {
        const params = new URLSearchParams({ path: filePath });
        if (currentBranch) params.set('ref', currentBranch);
        const detail = await apiRequest<GitHubFileDetail>(
          `/api/repos/${encodeURIComponent(selectedRepo.owner.login)}/${encodeURIComponent(selectedRepo.name)}/file?${params.toString()}`
        );
        setSelectedFile(detail);
        setEditorContent(detail.content);
        setCommitMessage(`Update ${detail.name}`);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : '读取文件内容失败');
      } finally {
        setLoadingFile(false);
      }
    },
    [apiRequest, currentBranch, selectedRepo]
  );

  const handleSaveFile = async () => {
    if (!selectedRepo || !selectedFile) return;
    setSavingFile(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      const msg = commitMessage.trim() || `Update ${selectedFile.path}`;
      const result = await apiRequest<{
        content: { sha: string };
        commit: { sha: string; html_url?: string };
      }>(
        `/api/repos/${encodeURIComponent(selectedRepo.owner.login)}/${encodeURIComponent(selectedRepo.name)}/file`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: selectedFile.path,
            content: editorContent,
            message: msg,
            sha: selectedFile.sha,
            branch: currentBranch,
          }),
        }
      );

      setSelectedFile((prev) =>
        prev
          ? {
              ...prev,
              sha: result.content.sha,
              content: editorContent,
              size: new Blob([editorContent]).size,
            }
          : null
      );
      setNotice({
        text: `已提交到 ${currentBranch}（${result.commit.sha.slice(0, 7)}）`,
        url: result.commit.html_url,
      });
      void loadDirectory(selectedRepo, currentDir, currentBranch);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '提交修改失败');
    } finally {
      setSavingFile(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!selectedRepo || !selectedFile) return;
    setDeletingFile(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      const result = await apiRequest<{
        commit: { sha: string; html_url?: string };
      }>(
        `/api/repos/${encodeURIComponent(selectedRepo.owner.login)}/${encodeURIComponent(selectedRepo.name)}/file`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: selectedFile.path,
            message: `Delete ${selectedFile.path}`,
            sha: selectedFile.sha,
            branch: currentBranch,
          }),
        }
      );
      setNotice({
        text: `已删除 ${selectedFile.path}（${result.commit.sha.slice(0, 7)}）`,
        url: result.commit.html_url,
      });
      setSelectedFile(null);
      setEditorContent('');
      setConfirmDelete(false);
      void loadDirectory(selectedRepo, currentDir, currentBranch);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '删除文件失败');
    } finally {
      setDeletingFile(false);
    }
  };

  const handleCreateBranch = async (name: string, sourceBranch: string) => {
    if (!selectedRepo) return;
    await apiRequest(
      `/api/repos/${encodeURIComponent(selectedRepo.owner.login)}/${encodeURIComponent(selectedRepo.name)}/branches`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sourceBranch }),
      }
    );
    const branchData = await apiRequest<{ branches: GitHubBranch[] }>(
      `/api/repos/${encodeURIComponent(selectedRepo.owner.login)}/${encodeURIComponent(selectedRepo.name)}/branches`
    );
    setBranches(branchData.branches);
    setCurrentBranch(name);
    setNotice({ text: `已基于 ${sourceBranch} 创建并切换到分支 ${name}` });
  };

  const handleCreateFile = async (
    filePath: string,
    content: string,
    message: string
  ) => {
    if (!selectedRepo) return;
    const result = await apiRequest<{
      content: { path: string };
      commit: { sha: string; html_url?: string };
    }>(
      `/api/repos/${encodeURIComponent(selectedRepo.owner.login)}/${encodeURIComponent(selectedRepo.name)}/file`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: filePath,
          content,
          message,
          branch: currentBranch,
        }),
      }
    );
    setNotice({
      text: `已创建并提交 ${filePath}（${result.commit.sha.slice(0, 7)}）`,
      url: result.commit.html_url,
    });
    const parts = filePath.split('/');
    const parentDir = parts.slice(0, -1).join('/');
    setCurrentDir(parentDir);
    await loadDirectory(selectedRepo, parentDir, currentBranch);
    await openFile(filePath);
  };

  const handleCreateRepo = async (payload: {
    name: string;
    description: string;
    isPrivate: boolean;
    autoInit: boolean;
  }) => {
    const res = await apiRequest<{ repo: GitHubRepo }>('/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setNotice({
      text: `已创建仓库 ${res.repo.full_name}`,
      url: res.repo.html_url,
    });
    await loadRepos(res.repo.full_name);
  };

  const filteredRepos = useMemo(() => {
    const q = repoSearch.trim().toLowerCase();
    return repos.filter((repo) => {
      if (visibilityFilter === 'public' && repo.private) return false;
      if (visibilityFilter === 'private' && !repo.private) return false;
      if (!q) return true;
      return (
        repo.full_name.toLowerCase().includes(q) ||
        (repo.description || '').toLowerCase().includes(q)
      );
    });
  }, [repos, repoSearch, visibilityFilter]);

  const isDirty =
    selectedFile !== null &&
    !selectedFile.isBinary &&
    !selectedFile.tooLarge &&
    editorContent !== selectedFile.content;

  const breadcrumbs = useMemo(() => {
    if (!currentDir) return [];
    const parts = currentDir.split('/').filter(Boolean);
    return parts.map((label, idx) => ({
      label,
      path: parts.slice(0, idx + 1).join('/'),
    }));
  }, [currentDir]);

  const lineCount = useMemo(() => {
    if (!editorContent) return 0;
    return editorContent.split('\n').length;
  }, [editorContent]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 bg-slate-50">
      {/* Left Sidebar: Repositories */}
      <aside className="w-full lg:w-[276px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col max-h-[340px] lg:max-h-none">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              我的仓库 ({repos.length})
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void loadRepos(selectedRepo?.full_name)}
                title="刷新仓库列表"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loadingRepos ? 'animate-spin' : ''}`}
                />
              </button>
              <button
                type="button"
                onClick={() => setShowRepoModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新建</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={repoSearch}
              onChange={(e) => setRepoSearch(e.target.value)}
              placeholder="搜索仓库名称..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: '全部' },
                { id: 'public', label: '公开' },
                { id: 'private', label: '私有' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setVisibilityFilter(tab.id)}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  visibilityFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loadingRepos ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              {repos.length === 0
                ? '当前账号下暂无可访问仓库，点击右上角“新建”创建一个。'
                : '没有匹配的仓库。'}
            </div>
          ) : (
            filteredRepos.map((repo) => {
              const active = selectedRepo?.id === repo.id;
              return (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => {
                    setSelectedRepo(repo);
                    setActiveTab('files');
                  }}
                  className={`w-full text-left px-4 py-2.5 transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-50/70 text-slate-900'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm truncate ${
                        active ? 'font-semibold text-blue-700' : 'font-medium'
                      }`}
                    >
                      {repo.name}
                    </span>
                    {repo.private && (
                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 tabular-nums truncate">
                    <span>{repo.private ? '私有' : '公开'}</span>
                    {repo.language && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{repo.language}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>★ {repo.stargazers_count}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatRelativeDate(repo.updated_at)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="flex-1 min-w-0 flex flex-col">
        {!selectedRepo ? (
          <div className="flex-1 flex items-center justify-center p-12 text-center">
            <div className="max-w-sm">
              <p className="text-sm font-medium text-slate-900 mb-1">
                请从左侧选择一个仓库
              </p>
              <p className="text-xs text-slate-500">
                选择仓库后即可浏览目录、切换分支、修改文件并提交到 GitHub。
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Repo Toolbar */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-base font-semibold text-slate-900 truncate">
                      {selectedRepo.full_name}
                    </h1>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {selectedRepo.private ? '私有' : '公开'}
                    </span>
                    <a
                      href={selectedRepo.html_url}
                      target="_blank"
                      rel="noreferrer"
                      title="在 GitHub 中打开"
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  {selectedRepo.description && (
                    <p className="text-xs text-slate-500 truncate max-w-xl mt-0.5">
                      {selectedRepo.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Branch Selector */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <select
                    value={currentBranch}
                    onChange={(e) => {
                      setCurrentBranch(e.target.value);
                      setSelectedFile(null);
                      setCurrentDir('');
                    }}
                    aria-label="选择分支"
                    className="text-xs font-mono text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                  >
                    {branches.length === 0 ? (
                      <option value={currentBranch}>{currentBranch}</option>
                    ) : (
                      branches.map((b) => (
                        <option key={b.name} value={b.name}>
                          {b.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBranchModal(true)}
                  disabled={branches.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>新建分支</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowFileModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>新建文件</span>
                </button>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setActiveTab('files')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'files'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    文件浏览
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('commits')}
                    className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'commits'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>提交历史</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Alerts & Notices */}
            {(errorMsg || notice) && (
              <div className="px-6 pt-3 space-y-2 shrink-0">
                {errorMsg && (
                  <div
                    role="alert"
                    className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setErrorMsg(null)}
                      className="text-red-700 hover:underline shrink-0 cursor-pointer"
                    >
                      关闭
                    </button>
                  </div>
                )}
                {notice && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{notice.text}</span>
                      {notice.url && (
                        <a
                          href={notice.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 font-medium hover:underline"
                        >
                          <span>查看 Commit</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotice(null)}
                      className="text-emerald-800 hover:underline shrink-0 cursor-pointer"
                    >
                      关闭
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab Content */}
            {activeTab === 'files' ? (
              <div className="flex-1 min-h-0 p-6">
                <div className="h-full min-h-[540px] bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-[290px_1fr]">
                  {/* Directory Tree Pane */}
                  <div className="border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col min-h-0">
                    <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex items-center gap-1 text-xs overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => setCurrentDir('')}
                        className={`font-mono hover:text-blue-600 whitespace-nowrap cursor-pointer ${
                          currentDir === ''
                            ? 'font-semibold text-slate-900'
                            : 'text-slate-600'
                        }`}
                      >
                        根目录
                      </button>
                      {breadcrumbs.map((crumb) => (
                        <span
                          key={crumb.path}
                          className="flex items-center gap-1 shrink-0"
                        >
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                          <button
                            type="button"
                            onClick={() => setCurrentDir(crumb.path)}
                            className={`font-mono hover:text-blue-600 whitespace-nowrap cursor-pointer ${
                              currentDir === crumb.path
                                ? 'font-semibold text-slate-900'
                                : 'text-slate-600'
                            }`}
                          >
                            {crumb.label}
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                      {loadingDir ? (
                        <div className="p-4 space-y-2.5">
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className="h-7 bg-slate-100 rounded animate-pulse"
                            />
                          ))}
                        </div>
                      ) : repoEmpty ? (
                        <div className="p-6 text-center space-y-3">
                          <p className="text-xs text-slate-500">
                            该仓库当前为空，尚无任何提交文件。
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowFileModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                          >
                            <FilePlus2 className="w-3.5 h-3.5" />
                            <span>创建第一个文件</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          {currentDir && (
                            <button
                              type="button"
                              onClick={() => {
                                const parts = currentDir.split('/');
                                setCurrentDir(parts.slice(0, -1).join('/'));
                              }}
                              className="w-full h-9 px-4 flex items-center gap-2 text-xs text-slate-600 hover:bg-slate-50 font-mono cursor-pointer"
                            >
                              <span>.. / 返回上级目录</span>
                            </button>
                          )}
                          {dirItems.map((item) => {
                            const isSelected =
                              selectedFile?.path === item.path;
                            return (
                              <button
                                key={item.sha + item.path}
                                type="button"
                                onClick={() => {
                                  if (item.type === 'dir') {
                                    setCurrentDir(item.path);
                                  } else {
                                    void openFile(item.path);
                                  }
                                }}
                                className={`w-full h-10 px-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-50/70 text-blue-700'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {item.type === 'dir' ? (
                                    <Folder className="w-4 h-4 text-blue-600 shrink-0" />
                                  ) : (
                                    <FileIcon className="w-4 h-4 text-slate-400 shrink-0" />
                                  )}
                                  <span
                                    className={`text-[13px] truncate ${
                                      item.type === 'dir' || isSelected
                                        ? 'font-medium'
                                        : ''
                                    }`}
                                  >
                                    {item.name}
                                  </span>
                                </div>
                                {item.type === 'file' && (
                                  <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
                                    {formatBytes(item.size)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>

                  {/* File Viewer & Editor Pane */}
                  <div className="flex flex-col min-w-0 min-h-0">
                    {loadingFile ? (
                      <div className="flex-1 p-6 space-y-3">
                        <div className="h-5 w-1/3 bg-slate-100 rounded animate-pulse" />
                        <div className="h-64 w-full bg-slate-100 rounded animate-pulse" />
                      </div>
                    ) : !selectedFile ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                        <p className="text-sm font-medium text-slate-900 mb-1">
                          未选择文件
                        </p>
                        <p className="text-xs text-slate-500 mb-4 max-w-sm">
                          点击左侧目录中的任意文件即可查看内容、在线编辑并提交修改到 GitHub。
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowFileModal(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          <FilePlus2 className="w-3.5 h-3.5" />
                          <span>在当前目录新建文件</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* File Header */}
                        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono text-xs font-medium text-slate-900 truncate">
                              {selectedFile.path}
                            </span>
                            <span className="text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
                              {lineCount} 行 · {formatBytes(selectedFile.size)}
                            </span>
                            {isDirty && (
                              <span className="text-xs font-medium text-amber-700 whitespace-nowrap">
                                未保存修改
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isDirty && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditorContent(selectedFile.content);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>还原</span>
                              </button>
                            )}
                            <a
                              href={selectedFile.html_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 whitespace-nowrap"
                            >
                              <span>GitHub 原文</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            {!confirmDelete ? (
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(true)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-md hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>删除</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={deletingFile}
                                  onClick={() => void handleDeleteFile()}
                                  className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-60 cursor-pointer"
                                >
                                  {deletingFile ? '删除中...' : '确认删除'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDelete(false)}
                                  className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                                >
                                  取消
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* File Body */}
                        {selectedFile.isBinary || selectedFile.tooLarge ? (
                          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <p className="text-sm font-medium text-slate-900 mb-1">
                              {selectedFile.tooLarge
                                ? '文件体积超过在线编辑限制（2 MB）'
                                : '二进制文件暂不支持在线文本编辑'}
                            </p>
                            <p className="text-xs text-slate-500 mb-4">
                              你可以在 GitHub 页面查看或下载该文件。
                            </p>
                            <a
                              href={selectedFile.html_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                            >
                              <span>前往 GitHub 查看</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-h-[360px] flex flex-col">
                              <textarea
                                value={editorContent}
                                onChange={(e) => setEditorContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Tab') {
                                    e.preventDefault();
                                    const target = e.currentTarget;
                                    const start = target.selectionStart;
                                    const end = target.selectionEnd;
                                    const next =
                                      editorContent.slice(0, start) +
                                      '  ' +
                                      editorContent.slice(end);
                                    setEditorContent(next);
                                    requestAnimationFrame(() => {
                                      target.selectionStart =
                                        target.selectionEnd = start + 2;
                                    });
                                  }
                                }}
                                spellCheck={false}
                                aria-label="代码编辑器"
                                className="flex-1 w-full p-5 font-mono text-[13px] leading-6 text-slate-800 bg-white resize-none focus:outline-none tabular-nums"
                              />
                            </div>

                            {/* Commit Action Footer */}
                            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                              <input
                                type="text"
                                value={commitMessage}
                                onChange={(e) =>
                                  setCommitMessage(e.target.value)
                                }
                                placeholder={`Update ${selectedFile.name}`}
                                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                              />
                              <div className="flex items-center justify-end gap-3 shrink-0">
                                <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                                  分支: {currentBranch}
                                </span>
                                <button
                                  type="button"
                                  disabled={!isDirty || savingFile}
                                  onClick={() => void handleSaveFile()}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  <span>
                                    {savingFile ? '正在提交...' : '提交修改'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Commit History View */
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      分支 <span className="font-mono">{currentBranch}</span>{' '}
                      最近提交记录
                    </h3>
                    <button
                      type="button"
                      onClick={() => void loadCommits(selectedRepo, currentBranch)}
                      className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          loadingCommits ? 'animate-spin' : ''
                        }`}
                      />
                      <span>刷新</span>
                    </button>
                  </div>

                  {loadingCommits ? (
                    <div className="p-5 space-y-3">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-9 bg-slate-100 rounded animate-pulse"
                        />
                      ))}
                    </div>
                  ) : commits.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      当前分支暂无提交记录。
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-500">
                            <th className="py-2.5 px-4 w-28">SHA</th>
                            <th className="py-2.5 px-4">提交说明</th>
                            <th className="py-2.5 px-4 w-44">作者</th>
                            <th className="py-2.5 px-4 w-36 text-right">
                              提交时间
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {commits.map((c) => {
                            const title =
                              c.commit.message.split('\n')[0] || '(无说明)';
                            return (
                              <tr
                                key={c.sha}
                                className="h-11 hover:bg-slate-50 transition-colors"
                              >
                                <td className="py-2 px-4 font-mono tabular-nums">
                                  <a
                                    href={c.html_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                                  >
                                    <span>{c.sha.slice(0, 7)}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </td>
                                <td className="py-2 px-4 text-slate-900 font-medium max-w-md truncate">
                                  {title}
                                </td>
                                <td className="py-2 px-4 text-slate-600 whitespace-nowrap">
                                  {c.author?.login || c.commit.author.name}
                                </td>
                                <td className="py-2 px-4 text-slate-500 text-right tabular-nums whitespace-nowrap">
                                  {formatRelativeDate(c.commit.author.date)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {showBranchModal && (
        <CreateBranchModal
          branches={branches}
          currentBranch={currentBranch}
          onClose={() => setShowBranchModal(false)}
          onSubmit={handleCreateBranch}
        />
      )}

      {showFileModal && (
        <CreateFileModal
          currentDir={currentDir}
          currentBranch={currentBranch}
          onClose={() => setShowFileModal(false)}
          onSubmit={handleCreateFile}
        />
      )}

      {showRepoModal && (
        <CreateRepoModal
          onClose={() => setShowRepoModal(false)}
          onSubmit={handleCreateRepo}
        />
      )}
    </div>
  );
}
