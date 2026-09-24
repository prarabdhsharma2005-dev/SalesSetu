# SalesSetu — Backend API Service

Express & TypeScript API backend powering the **SalesSetu** AI Sales Operating System.

## Architecture
- **Framework:** Express + TypeScript
- **AI Engine:** Google Gemini API (`@google/genai`)
- **Database ORM:** Prisma ORM with PostgreSQL
- **Validation:** Zod

## API Endpoints
- `GET /health` — Service health check
- `POST /api/ai/icp-parse` — Natural language ICP query conversion to structured filters
- `POST /api/ai/draft-email` — Dynamic cold outreach email generation
- `POST /api/ai/extract-mom` — Minutes of Meeting extraction with action items & deal health
- `GET /api/leads` — Lead discovery & filtering
- `GET /api/pipeline/deals` — Pipeline deals & stage tracking

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Add your GEMINI_API_KEY and DATABASE_URL
   ```

3. Run in development:
   ```bash
   npm run dev
   ```
