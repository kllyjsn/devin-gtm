"""GitHub API integration for repo discovery and analysis."""
import httpx
import os
import re
import asyncio
import logging
from typing import Optional
from datetime import datetime, timedelta
from collections import defaultdict
from app.models import RepoInfo, RepoAnalysis

logger = logging.getLogger(__name__)


GITHUB_API = "https://api.github.com"
_gh_token = os.environ.get("GITHUB_TOKEN", "")
HEADERS: dict[str, str] = {"Accept": "application/vnd.github.v3+json"}
if _gh_token:
    HEADERS["Authorization"] = f"token {_gh_token}"
    logger.info("GitHub token configured — using authenticated rate limit (5000 req/hr)")
else:
    logger.warning("No GITHUB_TOKEN set — using unauthenticated rate limit (60 req/hr)")


async def _rate_limited_get(client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response:
    """Make a GET request with rate limit awareness. Waits if rate limited."""
    resp = await client.get(url, **kwargs)
    if resp.status_code in (403, 429):
        remaining = resp.headers.get("x-ratelimit-remaining", "")
        if remaining == "0":
            reset_time = int(resp.headers.get("x-ratelimit-reset", "0"))
            wait_seconds = max(0, reset_time - int(datetime.utcnow().timestamp())) + 1
            if wait_seconds <= 120:
                logger.info(f"Rate limited — waiting {wait_seconds}s for reset")
                await asyncio.sleep(wait_seconds)
                resp = await client.get(url, **kwargs)
            else:
                logger.warning(f"Rate limit reset in {wait_seconds}s — too long, skipping")
    return resp


async def discover_github_org(input_url: str) -> tuple[str, str]:
    """Given a URL, discover the GitHub org and company name.
    
    Returns (github_org, company_name).
    """
    input_url = input_url.strip().rstrip("/")

    # Direct GitHub org/repo URL
    gh_match = re.match(r"(?:https?://)?github\.com/([^/]+)(?:/([^/]+))?", input_url)
    if gh_match:
        org = gh_match.group(1)
        company_name = org.replace("-", " ").title()
        return org, company_name

    # Plain org name (no slashes, no dots)
    if "/" not in input_url and "." not in input_url:
        return input_url, input_url.replace("-", " ").title()

    # Company website URL — try to find GitHub link
    if not input_url.startswith("http"):
        input_url = f"https://{input_url}"

    domain = re.match(r"https?://(?:www\.)?([^/]+)", input_url)
    company_name = domain.group(1).split(".")[0].title() if domain else input_url

    # Search GitHub for orgs matching the domain name
    search_term = company_name.lower()
    async with httpx.AsyncClient(timeout=15) as client:
        # Try direct org lookup first
        resp = await client.get(f"{GITHUB_API}/orgs/{search_term}", headers=HEADERS)
        if resp.status_code == 200:
            data = resp.json()
            return data["login"], data.get("name") or company_name

        # Search users/orgs
        resp = await client.get(
            f"{GITHUB_API}/search/users",
            params={"q": f"{search_term} type:org", "per_page": 5},
            headers=HEADERS,
        )
        if resp.status_code == 200:
            items = resp.json().get("items", [])
            if items:
                org = items[0]["login"]
                return org, company_name

    return search_term, company_name


async def list_org_repos(org: str, max_repos: int = 30) -> list[RepoInfo]:
    """List public repos for a GitHub org, sorted by stars.
    
    Uses the Search API which properly supports star sorting,
    unlike /orgs/{org}/repos which only sorts by created/updated/pushed/name.
    """
    repos = []
    async with httpx.AsyncClient(timeout=15) as client:
        # Use search API for proper star sorting
        page = 1
        while len(repos) < max_repos:
            resp = await client.get(
                f"{GITHUB_API}/search/repositories",
                params={
                    "q": f"org:{org} fork:false",
                    "sort": "stars",
                    "order": "desc",
                    "per_page": min(30, max_repos - len(repos)),
                    "page": page,
                },
                headers=HEADERS,
            )
            if resp.status_code == 200:
                items = resp.json().get("items", [])
                if not items:
                    break
                for r in items:
                    repos.append(RepoInfo(
                        name=r["name"],
                        full_name=r["full_name"],
                        description=r.get("description"),
                        url=r["html_url"],
                        stars=r.get("stargazers_count", 0),
                        forks=r.get("forks_count", 0),
                        open_issues=r.get("open_issues_count", 0),
                        language=r.get("language"),
                        last_pushed=r.get("pushed_at"),
                        topics=r.get("topics", []),
                        size_kb=r.get("size", 0),
                    ))
                page += 1
            else:
                # Fallback to org repos endpoint if search fails
                resp = await client.get(
                    f"{GITHUB_API}/orgs/{org}/repos",
                    params={
                        "type": "public",
                        "sort": "updated",
                        "direction": "desc",
                        "per_page": min(30, max_repos),
                    },
                    headers=HEADERS,
                )
                if resp.status_code != 200:
                    # Try as user instead of org
                    resp = await client.get(
                        f"{GITHUB_API}/users/{org}/repos",
                        params={
                            "type": "public",
                            "sort": "updated",
                            "direction": "desc",
                            "per_page": min(30, max_repos),
                        },
                        headers=HEADERS,
                    )
                if resp.status_code == 200:
                    items = resp.json()
                    for r in items:
                        if r.get("fork"):
                            continue
                        repos.append(RepoInfo(
                            name=r["name"],
                            full_name=r["full_name"],
                            description=r.get("description"),
                            url=r["html_url"],
                            stars=r.get("stargazers_count", 0),
                            forks=r.get("forks_count", 0),
                            open_issues=r.get("open_issues_count", 0),
                            language=r.get("language"),
                            last_pushed=r.get("pushed_at"),
                            topics=r.get("topics", []),
                            size_kb=r.get("size", 0),
                        ))
                break  # Only one page for fallback

    return sorted(repos, key=lambda r: r.stars, reverse=True)[:max_repos]


async def analyze_repo(repo: RepoInfo, run_enhancements: bool = True) -> RepoAnalysis:
    """Analyze a single repo for Devin opportunities.
    
    Args:
        run_enhancements: If True, run issue classification, trends, and security scan.
                         Set False for repos beyond the top 5 to save API calls.
    """
    analysis = RepoAnalysis(repo=repo)

    async with httpx.AsyncClient(timeout=15) as client:
        # Get issues by label + also classify them (combines original + enhancement 1)
        resp = await _rate_limited_get(
            client,
            f"{GITHUB_API}/repos/{repo.full_name}/issues",
            params={"state": "open", "per_page": 30, "sort": "comments", "direction": "desc"},
            headers=HEADERS,
        )
        if resp.status_code == 200:
            issues = resp.json()
            label_counts: dict[str, int] = {}
            top_issues = []
            classifications: dict[str, int] = defaultdict(int)
            deep_examples: list[dict] = []

            for issue in issues:
                if issue.get("pull_request"):
                    continue
                labels = [l["name"] for l in issue.get("labels", [])]
                for label in labels:
                    label_counts[label] = label_counts.get(label, 0) + 1
                if len(top_issues) < 10:
                    top_issues.append({
                        "number": issue["number"],
                        "title": issue["title"],
                        "labels": labels,
                        "url": issue["html_url"],
                        "created_at": issue.get("created_at", ""),
                        "comments": issue.get("comments", 0),
                    })

                # Enhancement 1: Classify issues inline (no extra API call)
                if run_enhancements:
                    title = issue.get("title", "").lower()
                    body = (issue.get("body") or "")[:500].lower()
                    label_names = [l.lower() for l in labels]
                    combined = f"{title} {body} {' '.join(label_names)}"
                    classification = _classify_issue(combined, label_names)
                    severity = _estimate_severity(issue, combined)
                    classifications[classification] += 1

                    if len(deep_examples) < 8:
                        body_raw = (issue.get("body") or "")
                        snippet = body_raw[:200].strip()
                        if len(body_raw) > 200:
                            snippet += "..."
                        deep_examples.append({
                            "number": issue["number"],
                            "title": issue["title"],
                            "body_snippet": snippet,
                            "classification": classification,
                            "severity": severity,
                            "comments": issue.get("comments", 0),
                            "url": issue["html_url"],
                            "labels": labels,
                        })

            analysis.issues_by_label = label_counts
            analysis.top_issues = top_issues
            if run_enhancements:
                analysis.issue_classifications = dict(classifications)
                analysis.issue_deep_examples = deep_examples

        # Get languages
        resp = await _rate_limited_get(
            client,
            f"{GITHUB_API}/repos/{repo.full_name}/languages",
            headers=HEADERS,
        )
        if resp.status_code == 200:
            analysis.languages = resp.json()

        # Get contributor count
        resp = await _rate_limited_get(
            client,
            f"{GITHUB_API}/repos/{repo.full_name}/contributors",
            params={"per_page": 1, "anon": "true"},
            headers=HEADERS,
        )
        if resp.status_code == 200:
            link = resp.headers.get("Link", "")
            last_match = re.search(r'page=(\d+)>; rel="last"', link)
            if last_match:
                analysis.contributor_count = int(last_match.group(1))
            else:
                analysis.contributor_count = len(resp.json())

        # Estimate test file ratio + security scan from root-level tree (single API call for both)
        resp = await _rate_limited_get(
            client,
            f"{GITHUB_API}/repos/{repo.full_name}/git/trees/HEAD",
            headers=HEADERS,
        )
        if resp.status_code == 200:
            tree = resp.json().get("tree", [])
            has_test_dir = any(
                item["type"] == "tree" and any(kw in item["path"].lower() for kw in ["test", "spec", "__tests__", "tests"])
                for item in tree
            )
            total_root_items = len([i for i in tree if i["type"] == "blob"])
            test_root_items = len([i for i in tree if i["type"] == "blob" and any(kw in i["path"].lower() for kw in ["test", "spec"])])
            if total_root_items > 0:
                analysis.test_file_ratio = round(test_root_items / total_root_items, 3)
            elif has_test_dir:
                analysis.test_file_ratio = 0.1
            else:
                analysis.test_file_ratio = 0.0

            # Enhancement 3: Security scan from the same tree data (no extra API call)
            if run_enhancements:
                _scan_security_from_tree(tree, analysis)

        if run_enhancements:
            # Enhancement 2: Historical trend analysis (2 API calls: closed issues + merged PRs)
            await _analyze_trends(client, repo, analysis)

        # Identify Devin opportunities (now with richer data)
        analysis.devin_opportunities = _identify_opportunities(analysis)

    return analysis


def _scan_security_from_tree(tree: list[dict], analysis: RepoAnalysis) -> None:
    """Scan for security issues from an already-fetched tree (no extra API calls)."""
    findings: list[dict] = []
    dep_health: dict = {"total_deps": 0, "outdated": 0, "has_lockfile": False}

    dep_file_names = {"package.json", "requirements.txt", "pyproject.toml", "go.mod", "cargo.toml",
                     "gemfile", "build.gradle", "pom.xml", "composer.json", "setup.py", "setup.cfg"}
    lock_file_names = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
                      "cargo.lock", "go.sum", "gemfile.lock", "composer.lock"}
    sensitive_patterns = {".env", ".env.local", ".env.production", "credentials",
                         "secret", ".pem", ".key", "id_rsa", ".p12"}

    dep_files = set()
    lock_files = set()
    sensitive_files = set()
    has_ci = False
    has_security_md = False

    for item in tree:
        path_lower = item["path"].lower()
        basename = path_lower.split("/")[-1]

        if item["type"] == "tree":
            if path_lower in (".github", ".circleci"):
                has_ci = True  # Likely has CI if .github or .circleci dir exists
            continue

        if basename in dep_file_names:
            dep_files.add(item["path"])
        if basename in lock_file_names:
            lock_files.add(item["path"])
            dep_health["has_lockfile"] = True
        if basename in ("security.md",):
            has_security_md = True
        if basename in ("jenkinsfile", ".travis.yml", ".gitlab-ci.yml"):
            has_ci = True
        for pattern in sensitive_patterns:
            if pattern in basename and not basename.endswith(".example") and not basename.endswith(".sample"):
                if not any(x in path_lower for x in ["template", "example", "sample", "test", "fixture"]):
                    sensitive_files.add(item["path"])

    dep_health["total_deps"] = len(dep_files)

    if sensitive_files:
        findings.append({
            "type": "sensitive_file",
            "severity": "high",
            "detail": f"Potentially sensitive files committed: {', '.join(list(sensitive_files)[:5])}",
            "files": list(sensitive_files)[:5],
        })
    if dep_files and not lock_files:
        findings.append({
            "type": "no_lockfile",
            "severity": "medium",
            "detail": f"Dependency files found ({', '.join(list(dep_files)[:3])}) but no lockfile — supply chain risk",
        })
    if not has_security_md:
        findings.append({
            "type": "no_security_policy",
            "severity": "low",
            "detail": "No SECURITY.md found — no documented vulnerability reporting process",
        })
    if not has_ci:
        findings.append({
            "type": "no_ci",
            "severity": "medium",
            "detail": "No CI/CD configuration detected — changes may not be automatically tested",
        })

    analysis.security_findings = findings
    analysis.dependency_health = dep_health


def _classify_issue(combined: str, labels: list[str]) -> str:
    """Classify an issue based on content and labels."""
    security_keywords = {"security", "vulnerability", "cve", "xss", "injection", "csrf", "auth", "exploit", "unsafe"}
    bug_keywords = {"bug", "error", "crash", "exception", "broken", "fix", "defect", "regression", "fail", "null", "undefined", "typeerror", "segfault"}
    perf_keywords = {"performance", "slow", "memory", "leak", "optimize", "latency", "timeout", "bottleneck"}
    tech_debt_keywords = {"refactor", "deprecat", "cleanup", "tech debt", "technical debt", "legacy", "migration", "upgrade"}
    docs_keywords = {"documentation", "docs", "readme", "example", "typo", "comment"}
    feature_keywords = {"feature", "enhancement", "request", "add support", "implement", "proposal"}

    if any(kw in combined for kw in security_keywords) or any("security" in l for l in labels):
        return "security"
    if any(kw in combined for kw in bug_keywords) or any("bug" in l for l in labels):
        return "bug"
    if any(kw in combined for kw in perf_keywords) or any("performance" in l for l in labels):
        return "performance"
    if any(kw in combined for kw in tech_debt_keywords):
        return "tech_debt"
    if any(kw in combined for kw in docs_keywords) or any("doc" in l for l in labels):
        return "documentation"
    if any(kw in combined for kw in feature_keywords) or any("enhancement" in l or "feature" in l for l in labels):
        return "feature_request"
    return "other"


def _estimate_severity(issue: dict, combined: str) -> str:
    """Estimate issue severity based on signals."""
    comments = issue.get("comments", 0)
    reactions = issue.get("reactions", {}).get("total_count", 0) if isinstance(issue.get("reactions"), dict) else 0

    critical_keywords = {"crash", "data loss", "security", "vulnerability", "production", "critical", "urgent", "blocker"}
    if any(kw in combined for kw in critical_keywords):
        return "critical"
    if comments >= 10 or reactions >= 5:
        return "high"
    if comments >= 3 or reactions >= 2:
        return "medium"
    return "low"


async def _analyze_trends(client: httpx.AsyncClient, repo: RepoInfo, analysis: RepoAnalysis) -> None:
    """Analyze issue/PR velocity trends over the last 12 months. Uses only 2 API calls."""
    try:
        since = (datetime.utcnow() - timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%SZ")
        months_opened: dict[str, int] = defaultdict(int)
        months_closed: dict[str, int] = defaultdict(int)

        # Get closed issues (single call — gives us both opened and closed dates)
        resp = await _rate_limited_get(
            client,
            f"{GITHUB_API}/repos/{repo.full_name}/issues",
            params={"state": "closed", "since": since, "per_page": 50, "sort": "updated", "direction": "desc"},
            headers=HEADERS,
        )
        if resp.status_code == 200:
            for issue in resp.json():
                if issue.get("pull_request"):
                    continue
                created = issue.get("created_at", "")
                if created:
                    months_opened[created[:7]] += 1
                closed_at = issue.get("closed_at")
                if closed_at:
                    months_closed[closed_at[:7]] += 1

        # Get merged PR times (single call)
        pr_merge_times: list[dict] = []
        resp = await _rate_limited_get(
            client,
            f"{GITHUB_API}/repos/{repo.full_name}/pulls",
            params={"state": "closed", "per_page": 20, "sort": "updated", "direction": "desc"},
            headers=HEADERS,
        )
        if resp.status_code == 200:
            for pr in resp.json():
                if not pr.get("merged_at"):
                    continue
                created = pr.get("created_at", "")
                merged = pr.get("merged_at", "")
                if created and merged:
                    try:
                        c = datetime.fromisoformat(created.replace("Z", "+00:00"))
                        m = datetime.fromisoformat(merged.replace("Z", "+00:00"))
                        hours = (m - c).total_seconds() / 3600
                        pr_merge_times.append({
                            "number": pr["number"],
                            "hours_to_merge": round(hours, 1),
                            "month": created[:7],
                        })
                    except (ValueError, TypeError):
                        pass

        # Determine backlog trend
        sorted_months = sorted(months_opened.keys())[-6:]  # last 6 months
        if len(sorted_months) >= 3:
            recent_opened = sum(months_opened.get(m, 0) for m in sorted_months[-3:])
            recent_closed = sum(months_closed.get(m, 0) for m in sorted_months[-3:])
            if recent_opened > recent_closed * 1.3:
                backlog_trend = "growing"
            elif recent_closed > recent_opened * 1.3:
                backlog_trend = "shrinking"
            else:
                backlog_trend = "stable"
        else:
            backlog_trend = "unknown"

        # Average PR merge time
        avg_merge_hours = 0.0
        if pr_merge_times:
            avg_merge_hours = round(sum(p["hours_to_merge"] for p in pr_merge_times) / len(pr_merge_times), 1)

        analysis.trend_data = {
            "issues_opened_by_month": [{"month": m, "count": months_opened[m]} for m in sorted(months_opened.keys())],
            "issues_closed_by_month": [{"month": m, "count": months_closed[m]} for m in sorted(months_closed.keys())],
            "pr_merge_times": pr_merge_times[:15],
            "avg_pr_merge_hours": avg_merge_hours,
            "backlog_trend": backlog_trend,
        }
    except Exception as e:
        logger.warning(f"Trend analysis failed for {repo.full_name}: {e}")


    # Old _scan_security removed — replaced by _scan_security_from_tree (zero extra API calls)


def _identify_opportunities(analysis: RepoAnalysis) -> list[dict]:
    """Identify specific Devin opportunities from repo analysis."""
    opportunities = []

    # Bug fixes
    bug_labels = {"bug", "defect", "error", "fix", "crash", "regression"}
    bug_count = sum(
        count for label, count in analysis.issues_by_label.items()
        if label.lower() in bug_labels
    )
    if bug_count > 0:
        opportunities.append({
            "type": "Bug Fixes",
            "count": bug_count,
            "impact": "high",
            "description": f"{bug_count} open bugs that Devin can fix autonomously with tests",
            "devin_advantage": "Devin can analyze stack traces, write fixes, and add regression tests in parallel",
        })

    # Test coverage
    if analysis.test_file_ratio < 0.15:
        opportunities.append({
            "type": "Test Coverage",
            "count": 1,
            "impact": "high",
            "description": f"Test file ratio is {analysis.test_file_ratio:.1%} — significant room for improvement",
            "devin_advantage": "Devin can generate comprehensive test suites across the entire codebase autonomously",
        })

    # Stale PRs / maintenance
    if analysis.repo.open_issues > 20:
        opportunities.append({
            "type": "Issue Backlog",
            "count": analysis.repo.open_issues,
            "impact": "medium",
            "description": f"{analysis.repo.open_issues} open issues — maintenance backlog building up",
            "devin_advantage": "Devin can triage, fix, and close routine issues without engineering time",
        })

    # Documentation
    doc_labels = {"documentation", "docs", "readme"}
    doc_count = sum(
        count for label, count in analysis.issues_by_label.items()
        if label.lower() in doc_labels
    )
    if doc_count > 0:
        opportunities.append({
            "type": "Documentation",
            "count": doc_count,
            "impact": "medium",
            "description": f"{doc_count} documentation issues Devin can address",
            "devin_advantage": "Devin reads entire codebases and generates accurate, contextual documentation",
        })

    # Enhancement opportunities
    enhancement_labels = {"enhancement", "feature", "improvement", "feature request"}
    enhancement_count = sum(
        count for label, count in analysis.issues_by_label.items()
        if label.lower() in enhancement_labels
    )
    if enhancement_count > 0:
        opportunities.append({
            "type": "Enhancements",
            "count": enhancement_count,
            "impact": "medium",
            "description": f"{enhancement_count} feature requests that can be prototyped by Devin",
            "devin_advantage": "Devin can prototype implementations for human review, accelerating feature velocity",
        })

    # Multi-language SDK opportunity
    if len(analysis.languages) > 3:
        opportunities.append({
            "type": "Cross-Language Maintenance",
            "count": len(analysis.languages),
            "impact": "high",
            "description": f"Repo uses {len(analysis.languages)} languages — maintenance multiplied across each",
            "devin_advantage": "Devin handles any language, applying fixes consistently across the entire stack",
        })

    # Security issues (from enhanced scan)
    security_count = sum(1 for f in analysis.security_findings if f.get("severity") in ("high", "critical"))
    if security_count > 0:
        opportunities.append({
            "type": "Security Fixes",
            "count": security_count,
            "impact": "critical",
            "description": f"{security_count} high/critical security findings that need attention",
            "devin_advantage": "Devin can fix security vulnerabilities, add SECURITY.md, and enable alerts",
        })

    # Tech debt (from issue classification)
    tech_debt_count = analysis.issue_classifications.get("tech_debt", 0)
    if tech_debt_count > 0:
        opportunities.append({
            "type": "Tech Debt",
            "count": tech_debt_count,
            "impact": "medium",
            "description": f"{tech_debt_count} tech debt issues (refactoring, deprecations, migrations)",
            "devin_advantage": "Devin can systematically tackle refactors and migrations across the codebase",
        })

    # Growing backlog (from trend data)
    if analysis.trend_data.get("backlog_trend") == "growing":
        opportunities.append({
            "type": "Growing Backlog",
            "count": analysis.repo.open_issues,
            "impact": "high",
            "description": f"Issue backlog is actively growing — more issues opened than closed recently",
            "devin_advantage": "Devin can process backlog in parallel, preventing it from spiraling",
        })

    # If no specific opportunities found, add a general one
    if not opportunities:
        opportunities.append({
            "type": "General Maintenance",
            "count": analysis.repo.open_issues,
            "impact": "medium",
            "description": "Ongoing maintenance and code quality improvements",
            "devin_advantage": "Devin handles routine engineering tasks so your team focuses on product work",
        })

    return opportunities
