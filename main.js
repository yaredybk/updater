/**
 * @deprecated please do not use
 * @use index.js for entry
 */
const { exec } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");
const http = require("http");
let updating = false;
const ROOT = path.resolve(process.env.ROOT || "../");
// console.log(new Date());
const { _localStorage } = require("../utils/localstorage.js");
let autoUpdate = _localStorage.getItem("autoUpdate") || "true";

if (autoUpdate == "true" || autoUpdate == "1" || autoUpdate == "enable")
  autoUpdate = true;
else autoUpdate = false;

const repos = ["garage_v5"];
if (process.env.NODE_ENV !== "development") {
  repos.push("proxy_local", "print_server", "updater");
}

if (autoUpdate) {
  setTimeout(() => {
    checkForUpdates();
  }, 5000); // wait 5 seconds before starting the update process
}
async function checkForUpdates() {
  if (!autoUpdate) {
    return Promise.resolve("Auto update is disabled");
  }
  if (updating) return Promise.resolve("Already updating");
  updating = true;
  // let foundUpdate = false;
  return pullFromOrigin(repos).then(async ([foundUpdate, stdout]) => {
    console.log("**** Pulling from origin completed ****");
    console.log("STDOUT:", stdout);
    if (foundUpdate) {
      console.log("**** Found update ****");
      let headers3 = {
        __from: "updater",
      };
      let baseurl = process.env.LOCAL_URL || "http://127.0.0.1:10001";
      let url = `${baseurl}/api/dev/restart`;
      const print_url = process.env.PRINT_URL || "http://localhost:" + 10003;
      return Promise.all([
        fetch(url, {
          method: "POST",
          headers: headers3,
          body: JSON.stringify({ update: true, stdout }),
        }),
        fetch(`http://127.0.0.1:10002/api/dev/update`, {
          method: "POST",
          headers: headers3,
          body: JSON.stringify({ update: true, stdout }),
        }),
        fetch(`${print_url}/restart`, {
          method: "POST",
          headers: headers3,
          body: JSON.stringify({ update: true, stdout }),
        }),
      ])
        .then((response) => {
          if (response[0].ok) {
            console.log("**** Update notification sent ****");
          } else {
            console.error("**** Failed to send update notification ****");
          }
        })
        .catch((error) => {
          console.error("**** Error sending update notification ****", error);
        })
        .finally(() => {
          updating = false;
        });
    } else {
      console.log("**** No updates found ****");
      updating = false;
      return Promise.resolve("No updates found");
    }
  });
}

http
  .createServer((req, res) => {
    let body = [];
    req
      .on("data", (chunk) => body.push(chunk))
      .on("end", () => {
        body = Buffer.concat(body);
        // extract json load
        try {
          body = JSON.parse(body.toString() || "{}");
        } catch (error) {
          console.warn(error);
        } finally {
          listnner(req, res, body);
        }
      });
  })
  .listen(process.env.UPDATE_PORT || 10004, () => {
    console.log(
      "update server running at http://localhost:" +
        (process.env.UPDATE_PORT || 10004)
    );
  });

async function listnner(req, res, body) {
  let url = new URL(req.url, "http://localhost");
  switch (url.pathname) {
    case "/restart_computer":
      fun = Promise.resolve("restarting computer");
      exec(
        'shutdown /r /t 10 /c "Restarting in 10 seconds for updates"',
        (error, stdout, stderr) => {
          if (error) {
            console.error(`exec error: ${error}`);
            return;
          }
          console.log(`stdout: ${stdout}`);
          console.error(`stderr: ${stderr}`);
        }
      );
      break;
    case "/update":
      // fun = Promise.resolve("updating");
      checkForUpdates()
        .then((r) => {
          res.writeHead(200, "done");
          res.end(r);
        })
        .catch((error) => {
          console.error(error);
          res.writeHead(500, "failed");
          res.end(error);
        });
      break;
    case "/autoupdate":
      return autoupdate(req, res, body, url);
    case "/gitcheckout":
      const branch = body.branch || url.searchParams.get("branch") || "";
      const repo = body.repo || url.searchParams.get("repo") || "";
      const user = body.user || url.searchParams.get("user") || "";
      if (!branch || !repo) {
        res.writeHead(400, "repo and branch are required");
        return res.end("repo and branch are required");
      }
      gitCheckout(repo, branch, user)
        .then((r) => {
          res.writeHead(200, "done");
          res.end(r);
        })
        .catch((error) => {
          console.error(error);
          res.writeHead(500, "failed");
          res.end(error?.message || error?.toString() || "failed");
        });

      break;
    case "/list":
      const list = {};
      for (const repo of repos) {
        const repoPath = path.join(ROOT, repo);
        if (existsSync(repoPath)) {
          list[repo] = repoPath;
        } else {
          list[repo] = "not found";
        }
      }
      res.writeHead(200, "done");
      res.end(JSON.stringify(list, null, 2));
      break;
    default:
      res.writeHead(404, "not found");
      res.end("not found");
      console.error("not found", req.url);

      break;
  }
}

async function autoupdate(req, res, body, url) {
  const a = body.autoUpdate || url.searchParams.get("autoUpdate");
  res.writeHead(200, "done");
  res.end(`Setting autoUpdate to ${a}`);
  if (a === true || a === "true" || a === "1") {
    autoUpdate = true;
    _localStorage.setItem("autoUpdate", "true");
  } else {
    autoUpdate = false;
    _localStorage.setItem("autoUpdate", "false");
  }
}

async function pullFromOrigin(repos = []) {
  let foundUpdate = false;
  const stdOut = [];
  for (const repo of repos) {
    const repoPath = path.join(ROOT, repo);
    if (!existsSync(repoPath)) {
      console.log(`**** Skipped ${repo} ****`);
      continue;
    }
    console.log(`**** Pulling ${repo} ****`);
    try {
      await new Promise((resolve, reject) => {
        exec("git pull --force", { cwd: repoPath }, (error, stdout, stderr) => {
          if (
            error?.message?.includes("conflict") ||
            stdout?.includes("conflict") ||
            error?.message?.includes("Merge conflicts")
          ) {
            console.error(`**** Merge conflicts detected in ${repo} ****`);
            console.error("Please resolve the conflicts manually.");
            exec(
              "git reset --hard HEAD~2",
              {},
              (reseterror, resetStdout, resetStderr) => {
                if (reseterror) {
                  console.error(
                    `Error resetting ${repo}: ${reseterror.message}`
                  );
                }
                console.log(`Reset ${repo} to previous commit.`);
                exec(
                  "git pull --force",
                  {},
                  (pullError, pullStdout, pullStderr) => {
                    if (pullError) {
                      console.error(
                        `Error pulling ${repo} after reset: ${pullError.message}`
                      );
                    } else {
                      console.log(`Pulled ${repo} after reset.`);
                    }
                    resolve(pullStdout);
                  }
                );
              }
            );
          } else {
            if (error) {
              console.error(`Error pulling ${repo}: ${error.message}`);
            }
            console.log(`STDOUT ${repo}: ${stdout}`);
            if (
              stdout.includes("Updating") &&
              // !stdout.includes("Already up to date") &&
              !foundUpdate
            ) {
              foundUpdate = true;
              console.log(`**** Found update in ${repo} ****`);
            }
            stdOut.push(`STDOUT ${repo}: ${stdout}`);
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
  return [foundUpdate, stdOut.join("\n")];
}

async function gitCheckout(repo, branch, user) {
  const repoPath = path.join(ROOT, repo);
  const sanitize = (str) => str.replace(/[^a-zA-Z0-9-_]/g, "");
  repo = sanitize(repo);
  branch = sanitize(branch);
  if (!existsSync(repoPath)) {
    if (user) {
      // sanitize user and repo to prevent command injection
      user = sanitize(user);
      const remoteOrigin = `git@github.com:${user}/${repo}.git`;
      return new Promise((resolve, reject) => {
        exec(
          `git clone ${remoteOrigin} ${repoPath}`,
          { cwd: ROOT },
          (error, stdout, stderr) => {
            if (error) {
              console.error(`Error cloning ${repo}: ${error.message}`);
              return reject(error);
            }
            console.log(`Cloned ${repo} from ${remoteOrigin}`);
            resolve(stdout);
          }
        );
      });
    } else {
      return Promise.reject(
        new Error(`Repository path does not exist: ${repoPath}`)
      );
    }
  }
  await new Promise((resolve, reject) => {
    exec(`git fetch`, { cwd: repoPath }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error fetching ${repoPath}: ${error.message}`);
        return reject(error);
      }
      console.log(`Fetched ${repoPath}`);
      resolve(stdout);
    });
  });
  return new Promise((resolve, reject) => {
    exec(
      `git checkout ${branch}`,
      { cwd: repoPath },
      (error, stdout, stderr) => {
        if (error) {
          console.error(
            `Error checking out ${branch} in ${repoPath}: ${error.message}`
          );
          reject(error);
        } else {
          console.log(`Checked out to [${branch}] in [${repoPath}]`);
          resolve(stdout);
        }
      }
    );
  });
}

if (autoUpdate) {
  setInterval(() => checkForUpdates(), 1000 * 3600 * 3); // every 3 hours
}
