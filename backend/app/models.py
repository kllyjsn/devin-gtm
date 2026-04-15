"""Pydantic models for the GTM Engine."""
from pydantic import BaseModel
from typing import Optional
from enum import Enum


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    DISCOVERING = "discovering"
    ANALYZING_REPOS = "analyzing_repos"
    RESEARCHING_COMPANY = "researching_company"
    GENERATING_BUSINESS_CASE = "generating_business_case"
    GENERATING_ASSETS = "generating_assets"
    COMPLETED = "completed"
    DEEP_RESEARCHING = "deep_researching"
    FAILED = "failed"


class AnalysisRequest(BaseModel):
    input_url: str  # Company URL, GitHub org URL, or repo URL


class RepoInfo(BaseModel):
    name: str
    full_name: str
    description: Optional[str] = None
    url: str
    stars: int = 0
    forks: int = 0
    open_issues: int = 0
    language: Optional[str] = None
    last_pushed: Optional[str] = None
    topics: list[str] = []
    size_kb: int = 0


class RepoAnalysis(BaseModel):
    repo: RepoInfo
    issues_by_label: dict[str, int] = {}
    top_issues: list[dict] = []
    stale_prs: list[dict] = []
    recent_prs: list[dict] = []
    languages: dict[str, int] = {}
    test_file_ratio: float = 0.0
    contributor_count: int = 0
    devin_opportunities: list[dict] = []
    # Enhancement 1: Issue body analysis + classification
    issue_classifications: dict[str, int] = {}  # {"bug": 5, "tech_debt": 3, "security": 2, ...}
    issue_deep_examples: list[dict] = []  # [{"title": ..., "body_snippet": ..., "classification": ..., "severity": ...}]
    # Enhancement 2: Historical trend analysis
    trend_data: dict = {}  # {"issues_opened_by_month": [...], "issues_closed_by_month": [...], "pr_merge_times": [...], "backlog_trend": "growing"|"shrinking"|"stable"}
    # Enhancement 3: Security vulnerability scan
    security_findings: list[dict] = []  # [{"type": "outdated_dep"|"vulnerability"|"secret_leak", "severity": ..., "detail": ...}]
    dependency_health: dict = {}  # {"total_deps": N, "outdated": N, "has_lockfile": bool}


class CompanyResearch(BaseModel):
    company_name: str
    summary: str = ""
    key_initiatives: list[str] = []
    engineering_culture: str = ""
    tech_stack: list[str] = []
    recent_news: list[str] = []
    key_people: list[dict] = []
    strategic_priorities: list[str] = []
    is_public_company: bool = False
    ticker_symbol: str = ""
    # Public company fields
    annual_revenue: str = ""
    engineering_headcount: str = ""
    rd_spend: str = ""
    financial_highlights: list[str] = []
    # Private company fields
    engineering_blog_insights: list[str] = []
    open_source_strategy: str = ""
    funding_stage: str = ""
    # Enhancement 4: Multi-source research
    job_postings_insights: list[str] = []  # Pain points revealed by job postings
    hackernews_sentiment: str = ""  # Community perception from HN
    conference_talks: list[str] = []  # Recent tech talks / presentations
    # Enhancement 5: Competitor analysis
    market_segment: str = ""  # e.g. "Payment Infrastructure", "Developer Tools"
    competitors: list[dict] = []  # [{"name": ..., "ai_adoption": ..., "relevance": ...}]
    competitor_ai_adoption_summary: str = ""
    # Enhancement 6: Firmographic enrichment
    estimated_headcount: str = ""  # Total company headcount estimate
    estimated_engineering_pct: str = ""  # % of headcount that's engineering
    estimated_revenue_range: str = ""  # Revenue range for private companies


class BusinessCase(BaseModel):
    executive_summary: str = ""
    roi_estimate: dict = {}
    build_vs_buy: dict = {}
    three_tier_impact: dict = {}
    opportunity_mapping: list[dict] = []


class GTMAssets(BaseModel):
    pre_meeting_email: str = ""
    discovery_questions: list[str] = []
    executive_summary_doc: str = ""
    cost_model: dict = {}
    pitch_outline: list[dict] = []


class AnalysisResult(BaseModel):
    job_id: str
    status: AnalysisStatus
    input_url: str
    company_name: str = ""
    github_org: str = ""
    repos: list[RepoInfo] = []
    repo_analyses: list[RepoAnalysis] = []
    company_research: Optional[CompanyResearch] = None
    business_case: Optional[BusinessCase] = None
    gtm_assets: Optional[GTMAssets] = None
    research_depth: str = "light"  # "light" or "deep"
    error: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
