export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  email: string | null;
  public_repos: number;
  total_private_repos?: number;
}

export interface AuthStatus {
  authenticated: boolean;
  oauthConfigured: boolean;
  callbackUrl: string;
  user: GitHubUser | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
  commit: {
    sha: string;
  };
}

export interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  html_url: string;
}

export interface GitHubFileDetail {
  name: string;
  path: string;
  sha: string;
  size: number;
  html_url: string;
  content: string;
  isBinary: boolean;
  tooLarge?: boolean;
}

export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
}
