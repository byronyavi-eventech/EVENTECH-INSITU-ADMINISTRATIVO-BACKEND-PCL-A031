# Backend - Eventech InSitu

This is the backend API for Eventech InSitu, built with Node.js, Express, Drizzle ORM, and PostgreSQL.

## Prerequisites

Before you begin, ensure you have the following installed on your local machine:

- **Node.js** (v18 or higher recommended)
- **pnpm** (recommended, as the project uses `pnpm-lock.yaml`)
- **Docker & Docker Compose** (to easily run the PostgreSQL database locally)

## Local Setup Instructions

1. **Clone the repository** (if you haven't already):

   ```bash
   git clone <repository-url>
   cd backend-insitu
   ```

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

3. **Set up the Database (Docker)**:
   The project includes a `docker-compose.yml` file to spin up a PostgreSQL instance.
   Ensure your Docker daemon is running, then start the database in the background:

   ```bash
   docker-compose up -d
   ```

4. **Configure Environment Variables**:
   Copy the example environment file to `.env`:

   ```bash
   cp .env.example .env
   ```

   _Note: If you are using the default Docker setup, the credentials in `.env.example` will work out of the box for the local database._

5. **Initialize the Database Schema**:
   Generate and push the Drizzle schema to your running PostgreSQL database:

   ```bash
   pnpm run db:generate
   pnpm run db:push
   pnpm run db:seed
   ```

6. **Run the Development Server**:
   Start the backend server in watch mode:
   ```bash
   pnpm run dev
   ```
   The API should now be listening at `http://localhost:3000` (by default).
