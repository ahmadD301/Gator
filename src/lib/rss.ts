import { XMLParser } from "fast-xml-parser";

export type RSSFeed = {
  channel: {
    title: string;
    link: string;
    description: string;
    item: RSSItem[];
  };
};

export type RSSItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
};

export async function fetchFeed(feedURL: string): Promise<RSSFeed> {
  const res = await fetch(feedURL, {
    headers: {
      "User-Agent": "gator",
    },
  });
  const xml = await res.text();

  const parser = new XMLParser({ processEntities: false });
  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel;
  if (!channel) {
    throw new Error("feed is missing a channel field");
  }

  const { title, link, description } = channel;
  if (
    typeof title !== "string" ||
    typeof link !== "string" ||
    typeof description !== "string"
  ) {
    throw new Error("feed channel is missing required metadata fields");
  }

  const rawItems = channel.item
    ? Array.isArray(channel.item)
      ? channel.item
      : [channel.item]
    : [];

  const items: RSSItem[] = [];
  for (const rawItem of rawItems) {
    const {
      title: itemTitle,
      link: itemLink,
      description: itemDescription,
      pubDate,
    } = rawItem ?? {};

    if (
      typeof itemTitle !== "string" ||
      typeof itemLink !== "string" ||
      typeof itemDescription !== "string" ||
      typeof pubDate !== "string"
    ) {
      continue;
    }

    items.push({
      title: itemTitle,
      link: itemLink,
      description: itemDescription,
      pubDate,
    });
  }

  return {
    channel: {
      title,
      link,
      description,
      item: items,
    },
  };
}