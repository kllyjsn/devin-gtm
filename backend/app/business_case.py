"""Business case and GTM asset generation."""
from app.models import (
    RepoAnalysis, CompanyResearch, BusinessCase, GTMAssets, RepoInfo,
)
from typing import Optional


def generate_business_case(
    company_name: str,
    repo_analyses: list[RepoAnalysis],
    company_research: Optional[CompanyResearch],
) -> BusinessCase:
    """Generate a Devin business case from analysis data."""

    # Calculate total opportunities
    total_bugs = 0
    total_issues = 0
    total_repos = len(repo_analyses)
    test_coverage_gaps = 0
    languages = set()
    total_security_findings = 0
    total_tech_debt = 0
    growing_backlogs = 0

    for ra in repo_analyses:
        total_issues += ra.repo.open_issues
        for lang in ra.languages:
            languages.add(lang)
        if ra.test_file_ratio < 0.15:
            test_coverage_gaps += 1
        for opp in ra.devin_opportunities:
            if opp["type"] == "Bug Fixes":
                total_bugs += opp["count"]
        # Enhanced data from new enrichments
        total_security_findings += sum(1 for f in ra.security_findings if f.get("severity") in ("high", "critical", "medium"))
        total_tech_debt += ra.issue_classifications.get("tech_debt", 0)
        if ra.trend_data.get("backlog_trend") == "growing":
            growing_backlogs += 1

    # ROI estimate — dynamic based on actual repo data
    avg_issue_hours_manual = 8  # hours per issue, manual
    avg_issue_hours_devin = 1.5  # hours of review per issue with Devin
    engineer_hourly_rate = 150  # fully loaded senior engineer
    devin_enterprise_annual = 75000  # mid-range enterprise estimate

    # Use actual issue count — no artificial floor or cap
    # Estimate what % of issues Devin can realistically address
    devin_addressable_pct = 0.25  # ~25% of open issues are Devin-suitable (bugs, tests, maintenance)
    addressable_issues = max(int(total_issues * devin_addressable_pct), total_bugs)
    # Also factor in test coverage improvement, maintenance, and security opportunities
    test_coverage_hours = test_coverage_gaps * 40  # ~40 hours to add meaningful test coverage per repo
    maintenance_hours = total_repos * 16  # ~16 hours of dependency/doc maintenance per repo
    security_hours = total_security_findings * 12  # ~12 hours per security finding (audit + fix + test)
    tech_debt_hours = total_tech_debt * 6  # ~6 hours per tech debt issue
    total_manual_hours = (addressable_issues * avg_issue_hours_manual) + test_coverage_hours + maintenance_hours + security_hours + tech_debt_hours
    total_devin_hours = (addressable_issues * avg_issue_hours_devin) + (test_coverage_hours * 0.2) + (maintenance_hours * 0.15) + (security_hours * 0.25) + (tech_debt_hours * 0.2)
    manual_cost = int(total_manual_hours * engineer_hourly_rate)
    devin_cost = int(total_devin_hours * engineer_hourly_rate) + devin_enterprise_annual
    savings = max(manual_cost - devin_cost, 0)
    hours_recaptured = total_manual_hours - total_devin_hours
    roi_multiple = round(savings / devin_enterprise_annual, 1) if devin_enterprise_annual > 0 else 0

    roi_estimate = {
        "addressable_issues": addressable_issues,
        "manual_cost": manual_cost,
        "devin_cost": devin_cost,
        "annual_savings": savings,
        "roi_multiple": f"{roi_multiple}x",
        "engineer_hourly_rate": engineer_hourly_rate,
        "devin_enterprise_annual": devin_enterprise_annual,
        "hours_recaptured": hours_recaptured,
        "security_findings": total_security_findings,
        "tech_debt_issues": total_tech_debt,
        "growing_backlogs": growing_backlogs,
    }

    # Build vs Buy
    build_vs_buy = {
        "hire": {
            "label": "Hire / Build In-House",
            "cost_per_pass": f"${engineer_hourly_rate * avg_issue_hours_manual:,}",
            "ramp_time": "3-6 months",
            "scaling": "Linear headcount",
            "risk": "Retention, domain knowledge loss",
            "coverage": "Limited to team capacity",
        },
        "copilot": {
            "label": "Cursor / Claude Code",
            "cost_per_pass": f"${int(engineer_hourly_rate * avg_issue_hours_manual * 0.6):,}",
            "ramp_time": "Immediate but in-seat",
            "scaling": "Still 1:1 with engineers",
            "risk": "Productivity gains plateau",
            "coverage": "Depends on engineer availability",
        },
        "devin": {
            "label": "Devin (Autonomous)",
            "cost_per_pass": f"${int(engineer_hourly_rate * avg_issue_hours_devin):,}",
            "ramp_time": "Days, not months",
            "scaling": "Parallel — runs many tasks simultaneously",
            "risk": "Requires review workflow",
            "coverage": "24/7, any language, any repo",
        },
    }

    # Three-tier impact
    strategic_context = ""
    if company_research and company_research.key_initiatives:
        strategic_context = f" aligned with {company_name}'s initiatives: {', '.join(company_research.key_initiatives[:3])}"

    # Build security/trend context strings for three-tier impact
    security_metric = f"Address {total_security_findings} security findings across repos" if total_security_findings > 0 else f"Reduced incident risk from {total_bugs} unresolved bugs"
    backlog_metric = f"{growing_backlogs} repos have growing backlogs — Devin prevents spiraling" if growing_backlogs > 0 else f"Clear {total_issues}+ issue backlog without adding headcount"

    three_tier_impact = {
        "executive": {
            "label": "Business Impact",
            "metrics": [
                f"${max(savings, 0):,}/yr in engineering cost savings",
                f"{hours_recaptured:,.0f} senior engineer hours recaptured annually",
                f"Faster time-to-market on strategic initiatives{strategic_context}",
                security_metric,
            ],
        },
        "engineering_manager": {
            "label": "Engineering Leadership Impact",
            "metrics": [
                backlog_metric,
                f"Improve test coverage across {test_coverage_gaps} under-tested repos",
                f"Free senior engineers for architecture and product work",
                f"Standardize code quality across {len(languages)} languages",
            ],
        },
        "developer": {
            "label": "Hands-on-Keyboard Impact",
            "metrics": [
                "Review-only workflow — Devin writes the code, you approve",
                f"No more context-switching across {total_repos} repos for routine fixes",
                "AI handles boilerplate: tests, docs, dependency updates, security fixes",
                "Focus on the interesting problems, not maintenance debt",
            ],
        },
    }

    # Opportunity mapping
    opportunity_mapping = []
    for ra in repo_analyses:
        for opp in ra.devin_opportunities:
            entry = {
                "repo": ra.repo.name,
                "repo_url": ra.repo.url,
                "opportunity": opp["type"],
                "count": opp["count"],
                "impact": opp["impact"],
                "description": opp["description"],
                "devin_advantage": opp["devin_advantage"],
            }
            # Map to company initiative if research available
            if company_research and company_research.key_initiatives:
                entry["strategic_alignment"] = _map_to_initiative(
                    opp["type"], company_research.key_initiatives
                )
            opportunity_mapping.append(entry)

    # Executive summary
    exec_parts = [
        f"**{company_name}** has {total_repos} public repositories with {total_issues}+ open issues across {len(languages)} languages.",
    ]
    # Add financial context for public companies
    if company_research and company_research.is_public_company:
        fin_parts = []
        if company_research.annual_revenue:
            fin_parts.append(f"annual revenue of {company_research.annual_revenue}")
        if company_research.rd_spend:
            fin_parts.append(f"R&D spend of {company_research.rd_spend}")
        if company_research.engineering_headcount:
            fin_parts.append(f"~{company_research.engineering_headcount} engineers")
        if fin_parts:
            ticker_str = f" ({company_research.ticker_symbol})" if company_research.ticker_symbol else ""
            exec_parts.append(
                f"As a public company{ticker_str} with {', '.join(fin_parts)}, "
                f"engineering efficiency directly impacts shareholder value."
            )
    # Add context for private companies
    elif company_research and not company_research.is_public_company:
        if company_research.funding_stage:
            exec_parts.append(f"As a private company ({company_research.funding_stage}), engineering velocity is critical for competitive positioning.")
    if total_bugs > 0:
        exec_parts.append(f"There are {total_bugs} open bugs impacting code quality and reliability.")
    if total_security_findings > 0:
        exec_parts.append(f"{total_security_findings} security findings across repositories require attention.")
    if test_coverage_gaps > 0:
        exec_parts.append(f"{test_coverage_gaps} repositories have below-average test coverage.")
    if growing_backlogs > 0:
        exec_parts.append(f"{growing_backlogs} repositories have actively growing issue backlogs.")
    exec_parts.append(
        f"Devin can address these systematically, saving an estimated **${max(savings, 0):,}/year** "
        f"and recapturing **{roi_estimate['hours_recaptured']:,.0f} senior engineer hours** annually."
    )
    if company_research and company_research.key_initiatives:
        exec_parts.append(
            f"This directly supports {company_name}'s strategic priorities: "
            f"{', '.join(company_research.key_initiatives[:3])}."
        )

    return BusinessCase(
        executive_summary="\n\n".join(exec_parts),
        roi_estimate=roi_estimate,
        build_vs_buy=build_vs_buy,
        three_tier_impact=three_tier_impact,
        opportunity_mapping=opportunity_mapping,
    )


def _map_to_initiative(opportunity_type: str, initiatives: list[str]) -> str:
    """Map an opportunity type to the most relevant company initiative."""
    type_lower = opportunity_type.lower()
    for initiative in initiatives:
        init_lower = initiative.lower()
        if "reliability" in init_lower and type_lower in ("bug fixes", "test coverage"):
            return initiative
        if "infrastructure" in init_lower and type_lower in ("general maintenance", "issue backlog"):
            return initiative
        if "ai" in init_lower and type_lower in ("enhancements", "cross-language maintenance"):
            return initiative
        if "scale" in init_lower or "velocity" in init_lower:
            return initiative
    return initiatives[0] if initiatives else ""


def generate_gtm_assets(
    company_name: str,
    github_org: str,
    repo_analyses: list[RepoAnalysis],
    company_research: Optional[CompanyResearch],
    business_case: BusinessCase,
) -> GTMAssets:
    """Generate GTM collateral from analysis results."""

    # Pre-meeting email
    top_repos = [ra.repo.name for ra in repo_analyses[:3]]
    total_issues = sum(ra.repo.open_issues for ra in repo_analyses)

    email = f"""**Subject:** Devin x {company_name} — Agenda

Hi team,

Quick agenda for our 40-minute session. This is a conversation, not a pitch — we'll spend the first half on discovery and the second half on a live demo and discussion.

**Agenda (40 min)**

- Industry context & discovery (12 min) — What we know about {company_name}'s engineering landscape, what we'd love to learn from you
- Live demo (10 min) — Real PRs showing human + AI collaboration on your actual repos
- Build vs. buy & ROI (8 min) — Hiring vs. copilots vs. Devin, cost model, security
- Finding the right fit (10 min) — Where's the highest-value starting point?

**One ask:** Think about how your team currently balances infrastructure maintenance vs. new feature work — we'll dig into that early.

Best,
[Your name]"""

    # Discovery questions
    questions = [
        f"How does infrastructure quality across repos like {', '.join(top_repos[:2])} factor into your 2026 planning?",
        "How does your team prioritize maintenance and tech debt vs. new feature work?",
        "What's your current stance on AI-assisted code changes in production workflows?",
    ]
    if company_research and company_research.key_initiatives:
        questions.append(
            f"We noticed {company_name} is focused on {company_research.key_initiatives[0]} — "
            f"how does that translate to engineering priorities?"
        )

    # Executive summary doc
    exec_doc = f"""# Devin x {company_name} — Executive Summary

## The Opportunity

{business_case.executive_summary}

## What We Found

| Metric | Value |
|--------|-------|
| Public repos analyzed | {len(repo_analyses)} |
| Open issues | {total_issues}+ |
| Languages | {', '.join(set(lang for ra in repo_analyses for lang in ra.languages))} |
| Estimated annual savings | ${business_case.roi_estimate.get('annual_savings', 0):,} |
| Senior engineer hours recaptured | {business_case.roi_estimate.get('hours_recaptured', 0):,.0f}/yr |

## Top Opportunities

"""
    for opp in business_case.opportunity_mapping[:5]:
        exec_doc += f"- **{opp['repo']}** — {opp['opportunity']}: {opp['description']}\n"

    if company_research and company_research.key_initiatives:
        exec_doc += f"\n## Strategic Alignment\n\n"
        for init in company_research.key_initiatives[:5]:
            exec_doc += f"- {init}\n"

    # Add enriched research section
    if company_research:
        if company_research.is_public_company:
            exec_doc += f"\n## Financial Context ({company_research.ticker_symbol or 'Public'})\n\n"
            if company_research.annual_revenue:
                exec_doc += f"- **Annual Revenue:** {company_research.annual_revenue}\n"
            if company_research.rd_spend:
                exec_doc += f"- **R&D Spend:** {company_research.rd_spend}\n"
            if company_research.engineering_headcount:
                exec_doc += f"- **Engineering Headcount:** {company_research.engineering_headcount}\n"
            if company_research.financial_highlights:
                exec_doc += "\n**Key Financial Highlights:**\n"
                for h in company_research.financial_highlights[:5]:
                    exec_doc += f"- {h}\n"
        else:
            if company_research.engineering_blog_insights or company_research.open_source_strategy:
                exec_doc += f"\n## Engineering Intelligence\n\n"
                if company_research.funding_stage:
                    exec_doc += f"**Funding:** {company_research.funding_stage}\n\n"
                if company_research.engineering_blog_insights:
                    exec_doc += "**Engineering Blog Insights:**\n"
                    for insight in company_research.engineering_blog_insights[:5]:
                        exec_doc += f"- {insight}\n"
                if company_research.open_source_strategy:
                    exec_doc += f"\n**Open Source Strategy:** {company_research.open_source_strategy}\n"

    exec_doc += f"""
## Recommended Next Step

A focused pilot on 1-2 high-impact repos, scoped to 2-4 weeks, targeting the highest-value opportunities identified above.
"""

    # Cost model
    cost_model = business_case.roi_estimate.copy()
    cost_model["build_vs_buy"] = business_case.build_vs_buy

    # Pitch outline
    pitch_outline = [
        {"slide": 1, "title": "Title", "content": f"Devin x {company_name}"},
        {"slide": 2, "title": "State of Software Engineering", "content": "60% of engineering time on maintenance, $85B lost annually"},
        {"slide": 3, "title": f"State of {company_name}", "content": f"{len(repo_analyses)} repos, {total_issues}+ open issues"},
        {"slide": 4, "title": "Three-Tier Impact", "content": "Business → Engineering Leadership → Developer impact"},
        {"slide": 5, "title": "Discovery", "content": "3 targeted questions for the room"},
        {"slide": 6, "title": "The Opportunity", "content": "Top repo opportunities mapped to company priorities"},
        {"slide": 7, "title": "Live Demo", "content": "Real PRs showing Devin in action"},
        {"slide": 8, "title": "Build vs. Buy", "content": "Hire vs. Copilot vs. Devin comparison"},
        {"slide": 9, "title": "ROI Model", "content": f"${business_case.roi_estimate.get('annual_savings', 0):,}/yr savings"},
        {"slide": 10, "title": "Collaborative Close", "content": "Finding the right starting point together"},
    ]

    return GTMAssets(
        pre_meeting_email=email,
        discovery_questions=questions,
        executive_summary_doc=exec_doc,
        cost_model=cost_model,
        pitch_outline=pitch_outline,
    )
