import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env")) {
  loadEnvFile(".env");
}

const turboExecutable = process.platform === "win32" ? "turbo.cmd" : "turbo";
const turbo = spawn(turboExecutable, ["dev"], {
  env: process.env,
  stdio: "inherit",
});

turbo.once("error", (error) => {
  console.error(`No se pudo iniciar Turbo: ${error.message}`);
  process.exitCode = 1;
});

turbo.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
