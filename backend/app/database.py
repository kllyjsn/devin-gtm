"""SQLite database for persisting analysis results."""
import aiosqlite
import json
import os
from datetime import datetime, timezone
from app.models import AnalysisResult, AnalysisStatus


DB_PATH = os.environ.get("DATABASE_PATH", "/data/app.db")

# Fallback for local dev
if not os.path.exists(os.path.dirname(DB_PATH)):
    DB_PATH = os.path.join(os.path.dirname(__file__), "..", "app.db")


async def init_db():
    """Create tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                job_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                input_url TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        await db.commit()


async def save_analysis(result: AnalysisResult):
    """Save or update an analysis result."""
    now = datetime.now(timezone.utc).isoformat()
    if not result.created_at:
        result.created_at = now
    result.updated_at = now

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT OR REPLACE INTO analyses (job_id, status, input_url, data, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                result.job_id,
                result.status.value,
                result.input_url,
                result.model_dump_json(),
                result.created_at,
                result.updated_at,
            ),
        )
        await db.commit()


async def get_analysis(job_id: str) -> AnalysisResult | None:
    """Get an analysis by job ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT data FROM analyses WHERE job_id = ?", (job_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return AnalysisResult.model_validate_json(row[0])
            return None


async def list_analyses(limit: int = 20) -> list[dict]:
    """List recent analyses (summary only)."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT job_id, status, input_url, created_at, updated_at FROM analyses ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ) as cursor:
            rows = await cursor.fetchall()
            results = []
            for row in rows:
                # Get company_name from the full data
                full = await get_analysis(row[0])
                results.append({
                    "job_id": row[0],
                    "status": row[1],
                    "input_url": row[2],
                    "company_name": full.company_name if full else "",
                    "github_org": full.github_org if full else "",
                    "repo_count": len(full.repos) if full else 0,
                    "created_at": row[3],
                    "updated_at": row[4],
                })
            return results
