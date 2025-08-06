# MOV Backend

A NestJS backend API for the MOV mobile app, handling events, media uploads, user management, and push notifications.

## Prerequisites

- Node.js (v20+)
- npm or yarn
- Docker (for local testing and deployment)
- Supabase account
- Firebase project
- Cloudflare account

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env.local` file based on `.env.example` with your actual values:

```bash
cp .env.example .env.local
```

Then update the values in `.env.local` with your actual credentials for:

- Database URL (Supabase)
- Supabase service role key
- Firebase credentials
- Cloudflare R2 credentials
- Twilio credentials

````

### 3. Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Go to Project Settings > Service Accounts
3. Generate a new private key (JSON file)
4. Extract the following values and add them to your `.env.local`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

### 4. Supabase Setup

1. Create a Supabase project at [Supabase](https://supabase.com/)
2. Get your database URL and service role key from Settings > API
3. Follow the detailed setup instructions in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
4. Run Prisma commands:

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run migrate:dev

# Reset database (if needed)
npm run migrate:reset
````

### 5. Cloudflare R2 Setup

1. Create a Cloudflare account and enable R2 storage
2. Create a new R2 bucket for media storage
3. Create API tokens with R2 permissions
4. Configure CORS settings for your bucket
5. Update your `.env.local` with the Cloudflare credentials

### 6. Local Development

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod

# Debug mode
npm run start:debug
```

### 7. Docker (Local Testing)

```bash
# Build the Docker image
docker build -t mov-backend .

# Run the container
docker run -p 3000:3000 --env-file .env.local mov-backend
```

## Deployment

The application is currently deployed on Railway, but can be deployed on any service that supports Docker containers.

### Railway Deployment

1. Connect your repository to Railway
2. Railway will automatically detect the Dockerfile
3. Set environment variables in Railway dashboard
4. Deploy

### Other Platforms

The application can be deployed on any platform that supports Docker:

- AWS ECS
- Google Cloud Run
- DigitalOcean App Platform
- Heroku (with Docker)
- Vercel (with Docker)

## API Endpoints

The API provides endpoints for:

- User management and authentication
- Event creation and management
- Media upload and processing
- Push notifications
- Real-time messaging

## Project Structure

- `src/` - NestJS application source code
- `prisma/` - Database schema and migrations
- `test/` - Test files
- `Dockerfile` - Docker configuration for deployment
