import { getNextFeedToFetch, markFeedFetched } from "./db/queries/feeds.js";
import { createPost } from "./db/queries/posts.js";
import { fetchFeed } from "./rss.js";

function parsePubDate(pubDate: string): Date | null {
  const parsed = new Date(pubDate);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function parseDuration(durationStr: string): number {
  const regex = /^(\d+)(ms|s|m|h)$/;
  const match = durationStr.match(regex);

  if (!match) {
    throw new Error(`invalid duration: ${durationStr}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 1000 * 60;
    case "h":
      return value * 1000 * 60 * 60;
    default:
      throw new Error(`invalid duration unit: ${unit}`);
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let result = "";
  if (hours > 0) {
    result += `${hours}h`;
  }
  if (hours > 0 || minutes > 0) {
    result += `${minutes}m`;
  }
  result += `${seconds}s`;

  return result;
}

export async function scrapeFeeds() {
  const feed = await getNextFeedToFetch();
  if (!feed) {
    console.log("No feeds to fetch");
    return;
  }

  console.log(`Fetching feed: ${feed.name} (${feed.url})`);

  await markFeedFetched(feed.id);

  const rssFeed = await fetchFeed(feed.url);

  for (const item of rssFeed.channel.item) {
    const publishedAt = parsePubDate(item.pubDate);

    const post = await createPost(
      item.title,
      item.link,
      item.description || null,
      publishedAt,
      feed.id,
    );

    if (post) {
      console.log(`* Saved: ${post.title}`);
    }
  }
}