import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = __dirname;
const projectRoot = path.resolve(frontendDir, "..");
const backendDir = path.resolve(projectRoot, "backend");

const venvPythonMac = path.resolve(backendDir, "venv", "bin", "python");
const venvPythonWin = path.resolve(backendDir, "venv", "Scripts", "python.exe");

let pythonExec = "python3";
if (fs.existsSync(venvPythonMac)) {
  pythonExec = venvPythonMac;
} else if (fs.existsSync(venvPythonWin)) {
  pythonExec = venvPythonWin;
}

console.log(`\x1b[36m[OryxOps]\x1b[0m Starting Backend API on http://127.0.0.1:8000 using ${pythonExec}...`);

const backend = spawn(pythonExec, ["run.py"], {
  cwd: backendDir,
  stdio: "inherit",
});

console.log(`\x1b[35m[OryxOps]\x1b[0m Starting Frontend Dev Server on http://localhost:3000...`);

const vite = spawn("npx", ["vite"], {
  cwd: frontendDir,
  stdio: "inherit",
  shell: true,
});

let isShuttingDown = false;
const cleanup = () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  try { backend.kill(); } catch {}
  try { vite.kill(); } catch {}
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

backend.on("exit", (code) => {
  if (code && code !== 0 && !isShuttingDown) {
    console.error(`\x1b[31m[OryxOps Backend]\x1b[0m Exited with code ${code}`);
  }
});

vite.on("exit", () => {
  cleanup();
});
