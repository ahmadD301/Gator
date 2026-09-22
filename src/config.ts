import fs from "fs";
import os from "os";
import path from "path";

export type Config = {
  dbUrl: string;
  currentUserName?: string;
};

const CONFIG_FILE_NAME = ".gatorconfig.json";

function getConfigFilePath(): string {
  return path.join(os.homedir(), CONFIG_FILE_NAME);
}

function writeConfig(cfg: Config): void {
  const rawConfig = {
    db_url: cfg.dbUrl,
    current_user_name: cfg.currentUserName,
  };
  const data = JSON.stringify(rawConfig, null, 2);
  fs.writeFileSync(getConfigFilePath(), data, { encoding: "utf-8" });
}

function validateConfig(rawConfig: any): Config {
  if (!rawConfig || typeof rawConfig.db_url !== "string") {
    throw new Error("db_url is missing or invalid in config file");
  }

  const cfg: Config = {
    dbUrl: rawConfig.db_url,
  };

  if (rawConfig.current_user_name !== undefined) {
    if (typeof rawConfig.current_user_name !== "string") {
      throw new Error("current_user_name must be a string if present");
    }
    cfg.currentUserName = rawConfig.current_user_name;
  }

  return cfg;
}

export function readConfig(): Config {
  const fullPath = getConfigFilePath();
  const data = fs.readFileSync(fullPath, { encoding: "utf-8" });
  const rawConfig = JSON.parse(data);
  return validateConfig(rawConfig);
}

export function setUser(cfg: Config, userName: string): void {
  cfg.currentUserName = userName;
  writeConfig(cfg);
}