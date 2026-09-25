import { readConfig, setUser } from "./config.js";
import { createFeed, getFeedsWithUsers } from "./lib/db/queries/feeds.js";
import {
  createUser,
  deleteAllUsers,
  getUser,
  getUsers,
} from "./lib/db/queries/users.js";
import { fetchFeed } from "./lib/rss.js";
import { Feed, User } from "./lib/db/schema.js";

function printFeed(feed: Feed, user: User) {
  console.log(`* ID:            ${feed.id}`);
  console.log(`* Created:       ${feed.createdAt}`);
  console.log(`* Updated:       ${feed.updatedAt}`);
  console.log(`* Name:          ${feed.name}`);
  console.log(`* URL:           ${feed.url}`);
  console.log(`* User:          ${user.name}`);
}

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

export async function handlerAgg(cmdName: string, ...args: string[]) {
  const feed = await fetchFeed("https://www.wagslane.dev/index.xml");
  console.log(JSON.stringify(feed, null, 2));
}

export async function handlerAddFeed(cmdName: string, ...args: string[]) {
  if (args.length < 2) {
    throw new Error(`usage: ${cmdName} <name> <url>`);
  }

  const [name, url] = args;

  const cfg = readConfig();
  if (!cfg.currentUserName) {
    throw new Error("you must be logged in to add a feed");
  }

  const currentUser = await getUser(cfg.currentUserName);
  if (!currentUser) {
    throw new Error(`user ${cfg.currentUserName} does not exist`);
  }

  const feed = await createFeed(name, url, currentUser.id);

  printFeed(feed, currentUser);
}

export async function handlerFeeds(cmdName: string, ...args: string[]) {
  const feedsList = await getFeedsWithUsers();

  for (const feed of feedsList) {
    console.log(`* ${feed.name}`);
    console.log(`  URL:  ${feed.url}`);
    console.log(`  User: ${feed.userName}`);
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