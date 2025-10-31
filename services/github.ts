import { Repository } from '../types';

export async function fetchUserRepos(): Promise<Repository[]> {
  const token = localStorage.getItem('github_access_token');
  if (!token) {
    throw new Error('No GitHub access token found. Please connect your GitHub account.');
  }

  const headers = new Headers({
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json'
  });

  const url = 'https://api.github.com/user/repos?per_page=100&sort=updated';
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API error: ${resp.status} ${resp.statusText} - ${text}`);
  }

  const data = await resp.json();
  // Map GitHub repo objects to our Repository type
  const repos: Repository[] = data.map((r: any) => ({
    id: String(r.id),
    name: r.name,
    owner: r.owner?.login || r.owner,
    url: r.html_url,
    lastUpdate: new Date(r.updated_at).toLocaleString(),
  }));

  return repos;
}

export async function checkRepoPermission(owner: string, repo: string): Promise<{ isAdmin: boolean }> {
  const token = localStorage.getItem('github_access_token');
  if (!token) {
    throw new Error('No GitHub access token found.');
  }

  const headers = new Headers({
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github+json'
  });

  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const resp = await fetch(url, { headers });

  if (!resp.ok) {
    const text = await resp.text();
    console.error(`GitHub API error checking permissions for ${owner}/${repo}: ${resp.status} ${resp.statusText} - ${text}`);
    // Default to false if we can't fetch for any reason (e.g., private repo, deleted, etc.)
    return { isAdmin: false };
  }

  const data = await resp.json();
  const isAdmin = data.permissions?.admin === true;

  return { isAdmin };
}

export const getRepoLanguages = async (owner: string, repo: string): Promise<string[]> => {
  const token = localStorage.getItem('github_access_token');
  if (!token) {
    throw new Error('GitHub token not found');
  }
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
    headers: {
      Authorization: `token ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch repo languages: ${response.statusText}`);
  }
  const data = await response.json();
  return Object.keys(data);
};
