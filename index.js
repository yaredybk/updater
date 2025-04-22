// deno
import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(process.env.ROOT || '../');

async function pullFromOrigin(repos = []) {
  for (const repo of repos) {
    const repoPath = path.join(ROOT, repo);
    if (!existsSync(repoPath)) {
      console.log(`**** Skipped ${repo} ****`);
      continue;
    }
    console.log(`**** Pulling ${repo} ****`);
    try {
      await new Promise((resolve, reject) => {
        exec('git pull --force', { cwd: repoPath }, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error pulling ${repo}: ${error.message}`);
            reject(error);
          } else if (stderr) {
            console.error(`Error pulling ${repo}: ${stderr}`);
            reject(new Error(stderr));
          } else {
            console.log(`Successfully pulled ${repo}: ${stdout}`);
            resolve(stdout);
          }
        });
      });
    } catch (error) {
      console.error(error);
      console.error(
        `Failed to pull ${repo}. Please check the repository manually.`
      );
    }
  }
}

const repos = ['garage_v5'];
if (Deno.env.get('NODE_ENV') !== 'development') {
  repos.push('proxy_local', 'print_server', 'updater');
}
await pullFromOrigin(repos);
