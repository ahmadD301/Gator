import { readConfig, setUser } from "./config.js";
import {
  createFeed,
  getFeedByUrl,
  getFeedsWithUsers,
} from "./lib/db/queries/feeds.js";
import {
  createFeedFollow,
  deleteFeedFollow,
  getFeedFollowsForUser,
} from "./lib/db/queries/feed_follows.js";
import {
  createUser,
  deleteAllUsers,
  getUser,
  getUsers,
} from "./lib/db/queries/users.js";
import { getPostsForUser } from "./lib/db/queries/posts.js";
import { formatDuration, parseDuration, scrapeFeeds } from "./lib/aggregate.js";
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

export type UserCommandHandler = (
  cmdName: string,
  user: User,
  ...args: string[]
) => Promise<void>;

export type CommandsRegistry = Record<string, CommandHandler>;

export function middlewareLoggedIn(handler: UserCommandHandler): CommandHandler {
  return async (cmdName: string, ...args: string[]) => {
    const cfg = readConfig();
    if (!cfg.currentUserName) {
      throw new Error("you must be logged in");
    }

    const user = await getUser(cfg.currentUserName);
    if (!user) {
      throw new Error(`user ${cfg.currentUserName} does not exist`);
    }

    await handler(cmdName, user, ...args);
  };
}

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
  if (args.length < 1) {
    throw new Error(`usage: ${cmdName} <time_between_reqs>`);
  }

  const [timeBetweenReqsStr] = args;
  const timeBetweenRequests = parseDuration(timeBetweenReqsStr);

  console.log(`Collecting feeds every ${formatDuration(timeBetweenRequests)}`);

  const handleError = (err: unknown) => {
    console.error(
      `Error scraping feeds: ${err instanceof Error ? err.message : err}`,
    );
  };

  scrapeFeeds().catch(handleError);

  const interval = setInterval(() => {
    scrapeFeeds().catch(handleError);
  }, timeBetweenRequests);

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.log("Shutting down feed aggregator...");
      clearInterval(interval);
      resolve();
    });
  });
}

export async function handlerAddFeed(
  cmdName: string,
  user: User,
  ...args: string[]
) {
  if (args.length < 2) {
    throw new Error(`usage: ${cmdName} <name> <url>`);
  }

  const [name, url] = args;

  const feed = await createFeed(name, url, user.id);

  printFeed(feed, user);

  const feedFollow = await createFeedFollow(user.id, feed.id);
  console.log(`${feedFollow.userName} is now following ${feedFollow.feedName}`);
}

export async function handlerFeeds(cmdName: string, ...args: string[]) {
  const feedsList = await getFeedsWithUsers();

  for (const feed of feedsList) {
    console.log(`* ${feed.name}`);
    console.log(`  URL:  ${feed.url}`);
    console.log(`  User: ${feed.userName}`);
  }
}

export async function handlerFollow(
  cmdName: string,
  user: User,
  ...args: string[]
) {
  if (args.length < 1) {
    throw new Error(`usage: ${cmdName} <url>`);
  }

  const [url] = args;

  const feed = await getFeedByUrl(url);
  if (!feed) {
    throw new Error(`no feed found for url: ${url}`);
  }

  const feedFollow = await createFeedFollow(user.id, feed.id);
  console.log(`${feedFollow.userName} is now following ${feedFollow.feedName}`);
}

export async function handlerFollowing(
  cmdName: string,
  user: User,
  ...args: string[]
) {
  const feedFollows = await getFeedFollowsForUser(user.id);

  for (const feedFollow of feedFollows) {
    console.log(`* ${feedFollow.feedName}`);
  }
}

export async function handlerUnfollow(
  cmdName: string,
  user: User,
  ...args: string[]
) {
  if (args.length < 1) {
    throw new Error(`usage: ${cmdName} <url>`);
  }

  const [url] = args;

  const feed = await getFeedByUrl(url);
  if (!feed) {
    throw new Error(`no feed found for url: ${url}`);
  }

  await deleteFeedFollow(user.id, feed.id);
  console.log(`${user.name} has unfollowed ${feed.name}`);
}

export async function handlerBrowse(
  cmdName: string,
  user: User,
  ...args: string[]
) {
  let limit = 2;

  if (args.length > 0) {
    const parsedLimit = parseInt(args[0], 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      throw new Error(`usage: ${cmdName} [limit]`);
    }
    limit = parsedLimit;
  }

  const userPosts = await getPostsForUser(user.id, limit);

  for (const post of userPosts) {
    console.log(`* ${post.title}`);
    console.log(`  ${post.url}`);
    if (post.publishedAt) {
      console.log(`  Published: ${post.publishedAt}`);
    }
    if (post.description) {
      console.log(`  ${post.description}`);
    }
    console.log("");
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