const { exec } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");
const http = require("http");
let updating = false;
const ROOT = path.resolve(process.env.ROOT || "../");
// console.log(new Date());

const repos = ["garage_v5"];
if (process.env.NODE_ENV !== "development") {
  repos.push("proxy_local", "print_server", "updater");
}
setTimeout(() => {
  checkForUpdates();
}, 10000); // wait 10 seconds before starting the update process
async function checkForUpdates() {
  if (updating) return Promise.resolve("Already updating");
  updating = true;
  // let foundUpdate = false;
  return pullFromOrigin(repos).then(async ([foundUpdate, stdout]) => {
    console.log("**** Pulling from origin completed ****");
    if (foundUpdate) {
      console.log("**** Found update ****");
      let headers3 = {
        __from: "updater",
      };
      let baseurl = process.env.LOCAL_URL || "http://127.0.0.1:10001";
      let url = `${baseurl}/api/dev/restart`;
      return Promise.all([
        fetch(url, {
          method: "POST",
          headers: headers3,
          body: JSON.stringify({ update: true , stdout}),
        }),
        fetch(`http://127.0.0.1:10002/api/dev/update`, {
          method: "POST",
          headers: headers3,
          body: JSON.stringify({ update: true , stdout}),
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
  let url = req.url;
  switch (url) {
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

    default:
      break;
  }
}

async function pullFromOrigin(repos = []) {
  let foundUpdate = false;
  const stdOut =[];
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

setInterval(() => checkForUpdates(), 1000 * 3600 * 3); // every 3 hours
