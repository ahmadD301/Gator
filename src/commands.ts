import { readConfig, setUser } from "./config.js";
import {
  createUser,
  deleteAllUsers,
  getUser,
  getUsers,
} from "./lib/db/queries/users.js";

export type CommandHandler = (
  cmdName: string,
  ...args: string[]
) => Promise<void>;

export type CommandsRegistry = Record<string, CommandHandler>;

export async function handlerLogin(cmdName: string, ...args: string[]) {
  if (args.length === 0) {
    throw new Error(`usage: ${cmdName} <username>`);
  }

  const username = args[0];

  const existingUser = await getUser(username);
  if (!existingUser) {
    throw new Error(`user ${username} does not exist`);
  }

  const cfg = readConfig();
  setUser(cfg, username);

  console.log(`User has been set to ${username}`);
}

export async function handlerRegister(cmdName: string, ...args: string[]) {
  if (args.length === 0) {
    throw new Error(`usage: ${cmdName} <username>`);
  }

  const username = args[0];

  const existingUser = await getUser(username);
  if (existingUser) {
    throw new Error(`user ${username} already exists`);
  }

  const user = await createUser(username);

  const cfg = readConfig();
  setUser(cfg, username);

  console.log(`User ${username} was created`);
  console.log(user);
}

export async function handlerReset(cmdName: string, ...args: string[]) {
  try {
    await deleteAllUsers();
    console.log("Database has been reset");
  } catch (err) {
    throw new Error(
      `failed to reset database: ${err instanceof Error ? err.message : err}`,
    );
  }
}

export async function handlerUsers(cmdName: string, ...args: string[]) {
  const cfg = readConfig();
  const allUsers = await getUsers();

  for (const user of allUsers) {
    if (user.name === cfg.currentUserName) {
      console.log(`* ${user.name} (current)`);
    } else {
      console.log(`* ${user.name}`);
    }
  }
}

export function registerCommand(
  registry: CommandsRegistry,
  cmdName: string,
  handler: CommandHandler,
) {
  registry[cmdName] = handler;
}

export async function runCommand(
  registry: CommandsRegistry,
  cmdName: string,
  ...args: string[]
) {
  const handler = registry[cmdName];
  if (!handler) {
    throw new Error(`unknown command: ${cmdName}`);
  }
  await handler(cmdName, ...args);
}