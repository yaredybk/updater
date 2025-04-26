const { exec } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(process.env.ROOT || '../');
console.log(new Date());
let foundUpdate = false;
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
          if (
            stdout.includes('Updating') &&
            !stdout.includes('Already up to date') &&
            !foundUpdate
          ) {
            foundUpdate = true;
            console.log(`**** Found update in ${repo} ****`);
          }
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
(async () => {
  await pullFromOrigin(repos);
  console.log('**** Pulling from origin completed ****');
  if (foundUpdate) {
    console.log('**** Found update ****');
    let headers3 = {
      __from: 'proxy_local',
    };
    let baseurl = process.env.LOCAL_URL || 'http://127.0.0.1:10001';
    let url = `${baseurl}/api/dev/update`;
    Promise.all([
      fetch(url, {
        method: 'POST',
        headers: headers3,
        body: JSON.stringify({ update: true }),
      }),
      fetch(`http://127.0.0.1:10002/api/dev/update`, {
        method: 'POST',
        headers: headers3,
        body: JSON.stringify({ update: true }),
      }),
    ])
      .then((response) => {
        if (response[0].ok) {
          console.log('**** Update notification sent ****');
        } else {
          console.error('**** Failed to send update notification ****');
        }
      })
      .catch((error) => {
        console.error('**** Error sending update notification ****', error);
      });
  } else {
    console.log('**** No updates found ****');
  }
  process.exit();
})();
