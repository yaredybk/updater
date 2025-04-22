const { exec } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(process.env.ROOT || '../');
console.log(new Date());

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
          } 
          console.log(`STDOUT ${repo}: ${stdout}`);
          resolve(stdout);
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
if (process.env.NODE_ENV !== 'development') {
  repos.push('proxy_local', 'print_server', 'updater');
}
(
  async () => {
    await pullFromOrigin(repos);
    console.log('**** Pulling from origin completed ****');
    process.exit();
  }
)()
