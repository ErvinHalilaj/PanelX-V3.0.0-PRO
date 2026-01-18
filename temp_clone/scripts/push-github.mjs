// GitHub push script using Replit's GitHub connection
// Integration: connection:conn_github_01KF7DBXW93ZKS5VWQE7GA1NQ1
import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

let connectionSettings = null;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function pushToGitHub(commitMessage) {
  const owner = 'ErvinHalilaj';
  const repo = 'PanelX-V3.0.0-PRO';
  const branch = 'main';

  console.log('Getting GitHub client...');
  const octokit = await getUncachableGitHubClient();

  console.log('Getting latest commit...');
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`
  });
  const latestCommitSha = refData.object.sha;

  console.log('Getting latest commit tree...');
  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha
  });
  const baseTreeSha = commitData.tree.sha;

  console.log('Building tree from workspace files...');
  const workspaceDir = '/home/runner/workspace';
  const treeItems = [];

  function getFilesRecursively(dir, baseDir = workspaceDir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (!item.name.startsWith('.') && item.name !== 'node_modules' && item.name !== '.git') {
          files.push(...getFilesRecursively(fullPath, baseDir));
        }
      } else {
        const relativePath = path.relative(baseDir, fullPath);
        files.push({ fullPath, relativePath });
      }
    }
    return files;
  }

  const files = getFilesRecursively(workspaceDir);
  console.log(`Found ${files.length} files to push...`);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file.fullPath, 'base64');
      const { data: blobData } = await octokit.git.createBlob({
        owner,
        repo,
        content,
        encoding: 'base64'
      });
      treeItems.push({
        path: file.relativePath,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      });
    } catch (err) {
      console.log(`Skipping ${file.relativePath}: ${err.message}`);
    }
  }

  console.log('Creating new tree...');
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    tree: treeItems,
    base_tree: baseTreeSha
  });

  console.log('Creating commit...');
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage || 'Update from Replit',
    tree: newTree.sha,
    parents: [latestCommitSha]
  });

  console.log('Updating branch reference...');
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha
  });

  console.log(`Successfully pushed commit: ${newCommit.sha}`);
  console.log(`View at: https://github.com/${owner}/${repo}/commit/${newCommit.sha}`);
}

const message = process.argv[2] || 'Update from Replit';
pushToGitHub(message).catch(err => {
  console.error('Push failed:', err.message);
  process.exit(1);
});
