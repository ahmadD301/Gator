# Gator 

A multi-user RSS feed aggregator CLI, built with TypeScript, PostgreSQL, and [Drizzle ORM](https://orm.drizzle.team/).

Add RSS feeds, follow the ones other users have added, and let `gator` scrape them in the background while you browse the latest posts from the terminal.

Built as part of the [Boot.dev](https://boot.dev) backend course.

## Requirements

Before running `gator`, make sure you have:

- **Node.js v22.15.0** — managed with [nvm](https://github.com/nvm-sh/nvm). Run `nvm use` from the project root to activate the right version.
- **PostgreSQL 16+** — installed and running locally.
- **npm** (comes with Node).

## Installation

Clone the repo and install dependencies:

```bash
git clone https://github.com/ahmadD301/Gator.git
cd gator
nvm use
npm install
```

## Configuration

`gator` reads its settings from a config file at `~/.gatorconfig.json` in your home directory. Create it manually:

```bash
cat > ~/.gatorconfig.json << 'EOF'
{
  "db_url": "postgres://postgres:postgres@localhost:5432/gator?sslmode=disable"
}
EOF
```

Adjust the connection string for your own Postgres setup (username, password, host, port, and database name). The `current_user_name` field will be added automatically once you log in or register — you don't need to set it yourself.

## Database setup

Create the database and run the migrations:

```bash
# In psql:
CREATE DATABASE gator;

# From the project root:
npm run migrate
```

## Usage

Run any command with:

```bash
npm run start <command> [args...]
```

### Account commands

| Command | Description |
|---|---|
| `register <name>` | Create a new user and log in as them |
| `login <name>` | Switch the current logged-in user |
| `users` | List all registered users, marking the current one |
| `reset` | Delete all users (and, by cascade, all their feeds/follows/posts) — mainly useful for development |

### Feed commands

| Command | Description |
|---|---|
| `addfeed <name> <url>` | Add a new RSS feed and automatically follow it |
| `feeds` | List every feed in the database and who added it |
| `follow <url>` | Follow a feed that already exists in the database |
| `unfollow <url>` | Stop following a feed |
| `following` | List the feeds the current user follows |

### Aggregation & browsing

| Command | Description |
|---|---|
| `agg <time_between_reqs>` | Start the long-running aggregator, scraping the oldest-fetched feed on a loop (e.g. `agg 1m` for once a minute). Press `Ctrl+C` to stop. |
| `browse [limit]` | Show the most recent posts from feeds you follow (defaults to 2) |

### Example session

```bash
npm run start register alice
npm run start addfeed "Hacker News" "https://news.ycombinator.com/rss"

# In a separate terminal, leave this running to collect posts:
npm run start agg 1m

# Back in your main terminal:
npm run start browse 5
```

## A note on rate limiting

The aggregator fetches one feed at a time on an interval you control — don't set `time_between_reqs` too aggressively, especially against feeds you don't control. Be a good citizen of the web.
