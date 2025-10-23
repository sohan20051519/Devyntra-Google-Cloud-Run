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
