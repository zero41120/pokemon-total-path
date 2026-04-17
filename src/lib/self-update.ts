const DEFAULT_SELF_UPDATE_COMMAND = [
  "git pull",
  "sudo systemctl restart pokemon-tools-mcp",
  "sudo systemctl status pokemon-tools-mcp --no-pager",
  "sudo systemctl restart pokemon-tools",
  "sudo systemctl status pokemon-tools --no-pager",
].join(" && ");

const DEFAULT_SELF_UPDATE_LOG_PATH = "/tmp/pokemon-tools-self-update.log";

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function getSelfUpdateCommand() {
  return Bun.env.SELF_UPDATE_COMMAND?.trim() || DEFAULT_SELF_UPDATE_COMMAND;
}

export function getSelfUpdateLogPath() {
  return Bun.env.SELF_UPDATE_LOG_PATH?.trim() || DEFAULT_SELF_UPDATE_LOG_PATH;
}

export function scheduleSelfUpdate(command = getSelfUpdateCommand()) {
  const logPath = getSelfUpdateLogPath();
  const backgroundCommand = `nohup bash -lc ${shellQuote(command)} >> ${shellQuote(logPath)} 2>&1 &`;
  const child = Bun.spawn({
    cmd: ["bash", "-lc", backgroundCommand],
    cwd: process.cwd(),
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });

  return {
    pid: child.pid,
    command,
  };
}
