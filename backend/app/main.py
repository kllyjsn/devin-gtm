from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
import uuid
import asyncio
import logging
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

from app.models import AnalysisRequest, AnalysisResult, AnalysisStatus
from app.database import init_db, save_analysis, get_analysis, list_analyses
from app.github_service import discover_github_org, list_org_repos, analyze_repo
from app.perplexity_service import research_company_light, research_company_deep
from app.business_case import generate_business_case, generate_gtm_assets
from app.deck_generator import generate_deck_html

app = FastAPI()

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


@app.on_event("startup")
async def startup():
    await init_db()


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.post("/api/analyze")
async def start_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Start a new company/repo analysis."""
    job_id = str(uuid.uuid4())[:8]
    result = AnalysisResult(
        job_id=job_id,
        status=AnalysisStatus.PENDING,
        input_url=request.input_url,
        created_at=datetime.now(timezone.utc).isoformat(),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    await save_analysis(result)
    background_tasks.add_task(run_analysis, job_id)
    return {"job_id": job_id, "status": "pending"}


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    """Get analysis status."""
    result = await get_analysis(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {
        "job_id": result.job_id,
        "status": result.status,
        "company_name": result.company_name,
        "github_org": result.github_org,
        "repo_count": len(result.repos),
        "research_depth": result.research_depth,
        "updated_at": result.updated_at,
        "error": result.error,
    }


@app.get("/api/results/{job_id}")
async def get_results(job_id: str):
    """Get full analysis results."""
    result = await get_analysis(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return result


@app.get("/api/analyses")
async def get_analyses():
    """List all past analyses."""
    return await list_analyses()


@app.get("/api/generate-deck/{job_id}")
async def generate_deck(job_id: str):
    """Generate an HTML pitch deck for a completed analysis."""
    result = await get_analysis(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if result.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Analysis not yet completed")
    deck_html = generate_deck_html(result)
    return HTMLResponse(content=deck_html, media_type="text/html")


@app.post("/api/deep-research/{job_id}")
async def start_deep_research(job_id: str, background_tasks: BackgroundTasks):
    """Trigger deep research for an existing light analysis."""
    result = await get_analysis(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if result.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Analysis must be completed before deep research")
    if result.research_depth == "deep":
        raise HTTPException(status_code=400, detail="Deep research already completed")
    background_tasks.add_task(run_deep_research, job_id)
    return {"job_id": job_id, "status": "deep_researching"}


async def run_analysis(job_id: str):
    """Background task that runs the full analysis pipeline."""
    result = await get_analysis(job_id)
    if not result:
        return

    try:
        # Step 1: Discover GitHub org
        result.status = AnalysisStatus.DISCOVERING
        await save_analysis(result)

        logger.info(f"[{job_id}] Discovering GitHub org for: {result.input_url}")
        github_org, company_name = await discover_github_org(result.input_url)
        logger.info(f"[{job_id}] Found org={github_org}, company={company_name}")
        result.github_org = github_org
        result.company_name = company_name
        await save_analysis(result)

        # Step 2: List repos
        result.status = AnalysisStatus.ANALYZING_REPOS
        await save_analysis(result)

        repos = await list_org_repos(github_org, max_repos=20)
        logger.info(f"[{job_id}] Found {len(repos)} repos for {github_org}")
        result.repos = repos
        await save_analysis(result)

        # Step 3: Analyze top repos (limit to top 10 by stars)
        # Run full enhancements (classification, trends, security) on top 5 only
        # to stay within GitHub's 60 req/hr unauthenticated rate limit
        top_repos = repos[:10]
        analyses = []
        for i, repo in enumerate(top_repos):
            try:
                run_enhancements = (i < 5)  # Full analysis for top 5, basic for rest
                analysis = await analyze_repo(repo, run_enhancements=run_enhancements)
                analyses.append(analysis)
                result.repo_analyses = analyses
                await save_analysis(result)
            except Exception as e:
                logger.warning(f"[{job_id}] Repo analysis failed for {repo.full_name}: {e}")
                continue  # Skip repos that fail
            await asyncio.sleep(2)  # Rate limit courtesy (GitHub: 60 req/hr unauthenticated)

        result.repo_analyses = analyses

        # Step 4: Light company research (Perplexity — single fast call)
        result.status = AnalysisStatus.RESEARCHING_COMPANY
        await save_analysis(result)

        company_research = await research_company_light(company_name, github_org)
        result.company_research = company_research
        await save_analysis(result)

        # Step 5: Generate business case
        result.status = AnalysisStatus.GENERATING_BUSINESS_CASE
        await save_analysis(result)

        business_case = generate_business_case(
            company_name, result.repo_analyses, company_research
        )
        result.business_case = business_case
        await save_analysis(result)

        # Step 6: Generate GTM assets
        result.status = AnalysisStatus.GENERATING_ASSETS
        await save_analysis(result)

        gtm_assets = generate_gtm_assets(
            company_name, github_org, result.repo_analyses,
            company_research, business_case,
        )
        result.gtm_assets = gtm_assets
        await save_analysis(result)

        # Done (light research)
        result.status = AnalysisStatus.COMPLETED
        result.research_depth = "light"
        await save_analysis(result)

    except Exception as e:
        logger.error(f"[{job_id}] Analysis failed: {e}", exc_info=True)
        result.status = AnalysisStatus.FAILED
        result.error = str(e)
        await save_analysis(result)


async def run_deep_research(job_id: str):
    """Background task that upgrades a light analysis to deep research."""
    result = await get_analysis(job_id)
    if not result:
        return

    try:
        result.status = AnalysisStatus.DEEP_RESEARCHING
        await save_analysis(result)

        logger.info(f"[{job_id}] Starting deep research for {result.company_name}")

        if result.company_research:
            await research_company_deep(result.company_research, result.github_org)
            await save_analysis(result)

            # Regenerate business case with enriched data
            result.status = AnalysisStatus.GENERATING_BUSINESS_CASE
            await save_analysis(result)

            business_case = generate_business_case(
                result.company_name, result.repo_analyses, result.company_research
            )
            result.business_case = business_case
            await save_analysis(result)

            # Regenerate GTM assets with enriched data
            result.status = AnalysisStatus.GENERATING_ASSETS
            await save_analysis(result)

            gtm_assets = generate_gtm_assets(
                result.company_name, result.github_org, result.repo_analyses,
                result.company_research, business_case,
            )
            result.gtm_assets = gtm_assets
            await save_analysis(result)

        result.status = AnalysisStatus.COMPLETED
        result.research_depth = "deep"
        await save_analysis(result)
        logger.info(f"[{job_id}] Deep research completed for {result.company_name}")

    except Exception as e:
        logger.error(f"[{job_id}] Deep research failed: {e}", exc_info=True)
        result.status = AnalysisStatus.COMPLETED  # Revert to completed (light still valid)
        result.error = f"Deep research failed: {str(e)}"
        await save_analysis(result)
