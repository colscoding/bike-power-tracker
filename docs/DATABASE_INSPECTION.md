# Database Inspection Guide

This guide explains how to inspect and query the PostgreSQL database used by the **Bike Power Tracker** service. You can use a web-based interface (Prisma Studio), command-line tools, or external GUI applications.

## Prerequisites

Ensure you are in the `packages/service` directory for these commands, or adjust paths accordingly.

```bash
cd packages/service
```

---

## Method 1: Prisma Studio (Recommended)

Prisma Studio is the easiest way to view and edit your data. It provides a visual interface in your browser.

**When to use:** Local development.

1.  Start Prisma Studio:
    ```bash
    npm run db:studio
    ```
    
2.  Open your browser to [http://localhost:5555](http://localhost:5555).

**Note:** This requires your local `.env` file to contain the correct `DATABASE_URL`.

---

## Method 2: Command Line (Docker)

You can connect directly to the running PostgreSQL container using `psql`.

**When to use:** Quick checks, scripting, or when running in Docker without port exposure.

1.  Connect to the database shell:
    ```bash
    docker compose exec postgres psql -U biketracker -d biketracker
    ```
    *(If your service name or user differs in `docker-compose.yml`, adjust accordingly)*

2.  **Common Commands:**

    | Command | Description |
    |---------|-------------|
    | `\dt` | List all tables |
    | `\d users` | Describe structure of `users` table |
    | `\x` | Toggle expanded display (good for wide tables) |
    | `\q` | Quit |

3.  **Example Queries:**

    ```sql
    -- List all users
    SELECT * FROM users;

    -- Count workouts
    SELECT count(*) FROM workouts;
    ```

---

## Method 3: External GUI Tools (DBeaver, TablePlus, pgAdmin)

To use desktop database tools, you must ensure the PostgreSQL port is exposed to your host machine.

**When to use:** Deep analysis, visualization, complex queries.

### 1. Expose the Port
By default, the `postgres` service in `docker-compose.yml` may not expose port 5432. 

Add the `ports` section to your `docker-compose.yml` (or create a `docker-compose.override.yml`):

```yaml
services:
  postgres:
    ports:
      - "5432:5432"
```

Restart the container:
```bash
docker compose up -d postgres
```

### 2. Connection Settings

Configure your database client with these settings:

| Setting | Value |
|---------|-------|
| **Host** | `localhost` |
| **Port** | `5432` |
| **Database** | `biketracker` (or value of `POSTGRES_DB`) |
| **Username** | `biketracker` (or value of `POSTGRES_USER`) |
| **Password** | Value of `POSTGRES_PASSWORD` (check `.env`) |

### 3. Troubleshooting Connection

If you cannot connect:
*   Ensure the container is running: `docker compose ps`
*   Check logs: `docker compose logs postgres`
*   Verify port mapping: `docker ps` (look for `0.0.0.0:5432->5432/tcp`)
