// Direct GitHub upload script using Octokit API
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

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
    throw new Error('X_REPLIT_TOKEN not found');
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

// Files/folders to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.cache',
  '.config',
  '.upm',
  'dist',
  '.replit',
  'replit.nix',
  '.breakpoints',
  'generated-icon.png',
  '.local',
  'package-lock.json',
  'scripts/github-push.ts',
  'scripts/github-upload.ts'
];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (shouldIgnore(fullPath)) return;
    
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function main() {
  const repoName = 'PanelX-V3.0.0-PRO';
  
  console.log('Connecting to GitHub...');
  const octokit = await getUncachableGitHubClient();
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);
  
  const owner = user.login;
  
  // First, create initial README to initialize the repo
  console.log('Initializing repository with README...');
  try {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: 'README.md',
      message: 'Initial commit',
      content: Buffer.from('# PanelX V3.0.0 PRO\n\nIPTV Management Panel - Xtream Codes v2.9 Compatible\n').toString('base64')
    });
    console.log('README created!');
  } catch (e: any) {
    if (e.status === 422) {
      console.log('README already exists, continuing...');
    } else {
      throw e;
    }
  }
  
  // Get the latest commit SHA
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo: repoName,
    ref: 'heads/main'
  });
  const latestCommitSha = ref.object.sha;
  
  // Get the tree SHA from that commit
  const { data: commit } = await octokit.git.getCommit({
    owner,
    repo: repoName,
    commit_sha: latestCommitSha
  });
  const baseTreeSha = commit.tree.sha;
  
  // Get all files
  console.log('Collecting files...');
  const files = getAllFiles('.');
  console.log(`Found ${files.length} files to upload`);
  
  // Create blobs for each file
  console.log('Creating file blobs...');
  const tree: Array<{path: string, mode: '100644', type: 'blob', sha: string}> = [];
  
  let uploaded = 0;
  for (const file of files) {
    const relativePath = file.startsWith('./') ? file.slice(2) : file;
    const content = fs.readFileSync(file);
    const base64Content = content.toString('base64');
    
    try {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo: repoName,
        content: base64Content,
        encoding: 'base64'
      });
      
      tree.push({
        path: relativePath,
        mode: '100644',
        type: 'blob',
        sha: blob.sha
      });
      
      uploaded++;
      if (uploaded % 10 === 0) {
        console.log(`Uploaded ${uploaded}/${files.length} files...`);
      }
    } catch (e: any) {
      console.error(`\nError uploading ${relativePath}: ${e.message}`);
    }
  }
  console.log(`\nAll ${uploaded} blobs created!`);
  
  // Create tree
  console.log('Creating tree...');
  const { data: treeData } = await octokit.git.createTree({
    owner,
    repo: repoName,
    tree,
    base_tree: baseTreeSha
  });
  
  // Create commit
  console.log('Creating commit...');
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo: repoName,
    message: 'PanelX IPTV Management Panel v3.0.0 PRO - Full codebase',
    tree: treeData.sha,
    parents: [latestCommitSha]
  });
  
  // Update main branch reference
  console.log('Updating main branch...');
  await octokit.git.updateRef({
    owner,
    repo: repoName,
    ref: 'heads/main',
    sha: newCommit.sha
  });
  
  console.log('\n✅ Successfully pushed to GitHub!');
  console.log(`📦 Repository: https://github.com/${owner}/${repoName}`);
}

main().catch(console.error);
