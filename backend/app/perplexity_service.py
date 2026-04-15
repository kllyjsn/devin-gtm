"""Perplexity API integration for company research."""
import os
import re
import logging
import httpx
from app.models import CompanyResearch

logger = logging.getLogger(__name__)


PERPLEXITY_API = "https://api.perplexity.ai/chat/completions"


def _get_api_key() -> str | None:
    return os.environ.get("PERPLEXITY_API_KEY")


async def _perplexity_query(api_key: str, system_prompt: str, user_prompt: str, max_tokens: int = 2000) -> str | None:
    """Send a query to Perplexity and return the text response."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "sonar-pro",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.2,
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(PERPLEXITY_API, json=payload, headers=headers)
            if resp.status_code != 200:
                logger.error(f"Perplexity API returned {resp.status_code}: {resp.text[:200]}")
                return None
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Perplexity API error: {e}")
        return None


async def research_company_light(company_name: str, github_org: str) -> CompanyResearch | None:
    """Light research: single Perplexity call for company snapshot + public/private detection.

    Returns summary, key initiatives, tech stack, etc. but NO deep-dive financials or engineering blogs.
    """
    api_key = _get_api_key()
    if not api_key:
        logger.warning("No PERPLEXITY_API_KEY found in environment")
        return None

    stage1_prompt = f"""Research the company "{company_name}" (GitHub: github.com/{github_org}) and provide a structured analysis for a B2B sales engagement. Return the following sections clearly labeled:

1. COMPANY SUMMARY: 2-3 sentence overview of what they do
2. PUBLIC OR PRIVATE: Start your answer with exactly one word: "PUBLIC" or "PRIVATE". If public, include the stock ticker symbol on the same line (e.g. "PUBLIC (MDB)" or "PUBLIC (NASDAQ: MDB)"). If private, just write "PRIVATE" followed by any details. This is critical — the first word MUST be PUBLIC or PRIVATE.
3. KEY INITIATIVES: List their top 3-5 current strategic priorities or initiatives for 2025-2026
4. ENGINEERING CULTURE: Brief description of their engineering practices, open source involvement, and technical values
5. TECH STACK: List their known technologies, languages, and frameworks
6. RECENT NEWS: List 3-5 recent announcements, product launches, or strategic moves
7. KEY PEOPLE: List 2-3 key engineering leaders (name, title) if publicly known
8. STRATEGIC PRIORITIES: List 3-5 business priorities that could benefit from AI-assisted software engineering

Focus on publicly available information. Be specific and factual."""

    content = await _perplexity_query(
        api_key,
        "You are a B2B sales research analyst. Provide accurate, structured company intelligence.",
        stage1_prompt,
        max_tokens=2000,
    )
    if not content:
        return None

    return _parse_research(content, company_name)


async def research_company_deep(research: CompanyResearch, github_org: str) -> None:
    """Deep research: stage 2 deep-dive based on public vs private.

    Mutates the existing CompanyResearch object to add:
    - Public companies: annual reports, financials, R&D spend, engineering headcount
    - Private companies: engineering blog insights, open source strategy, funding stage
    - All companies: multi-source intel, competitor analysis, firmographic enrichment
    """
    api_key = _get_api_key()
    if not api_key:
        logger.warning("No PERPLEXITY_API_KEY found in environment")
        return

    if research.is_public_company:
        await _research_public_company(api_key, research, research.company_name, github_org)
    else:
        await _research_private_company(api_key, research, research.company_name, github_org)

    # Enhancement 4: Multi-source research (blogs, job postings, HN, conference talks)
    await _research_multi_source(api_key, research, research.company_name, github_org)

    # Enhancement 5: Competitor analysis
    await _research_competitors(api_key, research, research.company_name)

    # Enhancement 6: Firmographic enrichment
    await _research_firmographics(api_key, research, research.company_name)


async def research_company(company_name: str, github_org: str) -> CompanyResearch | None:
    """Full two-stage research (light + deep). Used for backwards compatibility."""
    research = await research_company_light(company_name, github_org)
    if research:
        await research_company_deep(research, github_org)
    return research


async def _research_public_company(api_key: str, research: CompanyResearch, company_name: str, github_org: str) -> None:
    """Deep-dive research for public companies — annual reports, financials, R&D spend."""
    ticker = research.ticker_symbol or company_name
    prompt = f"""Research the public company "{company_name}" (ticker: {ticker}, GitHub: github.com/{github_org}) using their latest annual report (10-K), investor presentations, and earnings calls. Provide:

1. ANNUAL REVENUE: Latest annual revenue figure (e.g. "$1.7B in FY2025")
2. ENGINEERING HEADCOUNT: Estimated number of engineers or R&D employees. If exact number isn't available, provide a range or percentage of total headcount.
3. R&D SPEND: Annual R&D expenditure from their latest 10-K or annual report (e.g. "$450M" or "28% of revenue")
4. FINANCIAL HIGHLIGHTS: List 3-5 key financial or strategic highlights from their latest annual report or earnings calls that relate to engineering, technology, or product development. Focus on:
   - Engineering hiring plans or headcount changes
   - Technology investment areas
   - Product development velocity or technical debt mentions
   - Cloud/infrastructure spend
   - Any mention of AI, automation, or developer productivity initiatives

Be specific with numbers and cite the source period (e.g. FY2025, Q4 2025 earnings call)."""

    content = await _perplexity_query(
        api_key,
        "You are a financial analyst specializing in technology companies. Provide accurate data from public filings and earnings reports.",
        prompt,
        max_tokens=1500,
    )
    if not content:
        return

    _parse_public_deep_dive(content, research)


async def _research_private_company(api_key: str, research: CompanyResearch, company_name: str, github_org: str) -> None:
    """Deep-dive research for private companies — engineering blogs, tech talks, open source strategy."""
    prompt = f"""Research the private company "{company_name}" (GitHub: github.com/{github_org}) focusing on their engineering organization and technical strategy. Look at their engineering blog, tech talks, conference presentations, and open source activity. Provide:

1. ENGINEERING BLOG INSIGHTS: List 3-5 key themes or insights from their engineering blog or tech blog. What problems are they solving? What technologies are they investing in? What does their blog reveal about their engineering challenges? If they don't have a blog, note that and look for conference talks, podcasts, or interviews with their engineers.
2. OPEN SOURCE STRATEGY: Describe their open source strategy — are they heavy contributors? Do they release internal tools as OSS? How do they engage with the open source community? What does their GitHub activity tell us about their engineering priorities?
3. FUNDING STAGE: Latest funding round, valuation if known, and key investors (e.g. "Series D, $150M at $1.5B valuation, led by Sequoia")

Focus on insights that reveal engineering pain points, scaling challenges, or areas where autonomous engineering (Devin) could provide value."""

    content = await _perplexity_query(
        api_key,
        "You are a technology analyst specializing in engineering organizations at private tech companies. Provide insights from engineering blogs, tech talks, and open source activity.",
        prompt,
        max_tokens=1500,
    )
    if not content:
        return

    _parse_private_deep_dive(content, research)


async def _research_multi_source(api_key: str, research: CompanyResearch, company_name: str, github_org: str) -> None:
    """Enhancement 4: Research blogs, job postings, HackerNews, conference talks."""
    try:
        prompt = f"""Research "{company_name}" (GitHub: github.com/{github_org}) across multiple sources. Provide:

1. JOB POSTINGS INSIGHTS: Analyze their current engineering job postings. What roles are they hiring for? What technologies do they mention? What pain points do the job descriptions reveal? (e.g. "Hiring 5 reliability engineers suggests infrastructure scaling challenges" or "Multiple DevOps roles indicate CI/CD pipeline bottlenecks"). List 3-5 insights.

2. HACKERNEWS SENTIMENT: What is the HackerNews community's perception of {company_name}? Look at recent HN discussions, Show HN posts, and comments. Summarize the overall developer sentiment and any recurring themes (positive or negative). 2-3 sentences.

3. CONFERENCE TALKS: List 2-4 recent conference talks, tech blog posts, or podcast appearances by {company_name} engineers. Include the topic and what it reveals about their engineering challenges or priorities.

Be specific and factual. If information is limited, say so rather than speculating."""

        content = await _perplexity_query(
            api_key,
            "You are a competitive intelligence analyst. Research companies across job boards, developer forums, and tech conferences.",
            prompt,
            max_tokens=1500,
        )
        if not content:
            return

        _parse_multi_source(content, research)
    except Exception as e:
        logger.warning(f"Multi-source research failed for {company_name}: {e}")


async def _research_competitors(api_key: str, research: CompanyResearch, company_name: str) -> None:
    """Enhancement 5: Identify competitors and their AI dev tool adoption."""
    try:
        prompt = f"""Analyze the competitive landscape for "{company_name}":

1. MARKET SEGMENT: What market segment or industry does {company_name} primarily operate in? (e.g. "Payment Infrastructure", "Cloud Database", "Developer Tools", "E-commerce Platform"). One line.

2. COMPETITORS: List the top 4-5 direct competitors. For each competitor, provide:
   - Company name
   - Brief description (1 sentence)
   - Whether they are known to use AI coding tools or autonomous engineering (e.g. "Uses GitHub Copilot enterprise-wide", "Invested in internal AI dev tools", "No known AI dev tool adoption")
   - A relevance note on why they matter competitively

3. AI ADOPTION SUMMARY: 2-3 sentences summarizing the competitive pressure around AI-assisted development in this market. Are competitors ahead, behind, or at parity? What's the FOMO angle?

Be factual. If AI adoption info isn't public, note that."""

        content = await _perplexity_query(
            api_key,
            "You are a competitive intelligence analyst specializing in technology companies and AI adoption trends.",
            prompt,
            max_tokens=1500,
        )
        if not content:
            return

        _parse_competitors(content, research)
    except Exception as e:
        logger.warning(f"Competitor analysis failed for {company_name}: {e}")


async def _research_firmographics(api_key: str, research: CompanyResearch, company_name: str) -> None:
    """Enhancement 6: Firmographic enrichment (headcount, revenue, engineering %)."""
    # Skip if we already have good data from public company research
    if research.is_public_company and research.annual_revenue and research.engineering_headcount:
        return

    try:
        prompt = f"""Provide firmographic data for "{company_name}":

1. ESTIMATED HEADCOUNT: Total estimated number of employees. Cite source if possible (LinkedIn, Crunchbase, etc.).
2. ENGINEERING PERCENTAGE: What percentage of their workforce is estimated to be in engineering/R&D? Provide a number or range.
3. ESTIMATED REVENUE: If not a public company, what is their estimated annual revenue range? (e.g. "$50M-$100M ARR" or "$500M+"). If public, confirm the latest known figure.

Be concise. One line per answer. If data is unavailable, say "Unknown" rather than speculating."""

        content = await _perplexity_query(
            api_key,
            "You are a business intelligence analyst. Provide accurate firmographic data from reliable sources.",
            prompt,
            max_tokens=500,
        )
        if not content:
            return

        _parse_firmographics(content, research)
    except Exception as e:
        logger.warning(f"Firmographic research failed for {company_name}: {e}")


def _parse_multi_source(content: str, research: CompanyResearch) -> None:
    """Parse multi-source research response."""
    lines = content.split("\n")
    current_section = ""
    buffer: list[str] = []

    section_map = {
        "JOB POSTINGS INSIGHTS": "job_postings",
        "HACKERNEWS SENTIMENT": "hackernews",
        "CONFERENCE TALKS": "conference",
    }

    def flush_buffer() -> None:
        nonlocal buffer, current_section
        if not current_section or not buffer:
            buffer = []
            return

        text = "\n".join(buffer).strip()
        field = section_map.get(current_section, "")

        if field == "job_postings":
            items = [line.lstrip("- \u2022*0123456789.").strip() for line in buffer if line.strip()]
            cleaned = [item.strip("*").strip() for item in items if item.strip("*").strip() and len(item.strip("*").strip()) > 10]
            research.job_postings_insights = cleaned
        elif field == "hackernews":
            research.hackernews_sentiment = text
        elif field == "conference":
            items = [line.lstrip("- \u2022*0123456789.").strip() for line in buffer if line.strip()]
            cleaned = [item.strip("*").strip() for item in items if item.strip("*").strip() and len(item.strip("*").strip()) > 10]
            research.conference_talks = cleaned

        buffer = []

    for line in lines:
        stripped = line.strip()
        matched = False
        for section_key in section_map:
            if section_key in stripped.upper():
                flush_buffer()
                current_section = section_key
                after = stripped.split(":", 1)
                if len(after) > 1 and after[1].strip():
                    buffer.append(after[1].strip())
                matched = True
                break
        if not matched:
            buffer.append(line)

    flush_buffer()


def _parse_competitors(content: str, research: CompanyResearch) -> None:
    """Parse competitor analysis response."""
    lines = content.split("\n")
    current_section = ""
    buffer: list[str] = []

    section_map = {
        "MARKET SEGMENT": "market_segment",
        "COMPETITORS": "competitors",
        "AI ADOPTION SUMMARY": "ai_summary",
    }

    def flush_buffer() -> None:
        nonlocal buffer, current_section
        if not current_section or not buffer:
            buffer = []
            return

        text = "\n".join(buffer).strip()
        field = section_map.get(current_section, "")

        if field == "market_segment":
            research.market_segment = text.strip("*").strip()
        elif field == "competitors":
            competitors = []
            current_competitor: dict = {}
            for line in buffer:
                cleaned = line.lstrip("- \u2022*0123456789.").strip().strip("*").strip()
                if not cleaned:
                    continue
                # Detect competitor name lines (usually bold or start of a new item)
                if cleaned.startswith("**") or (len(cleaned) < 80 and ":" not in cleaned.lower() and "ai" not in cleaned.lower()[:20]):
                    if current_competitor and current_competitor.get("name"):
                        competitors.append(current_competitor)
                    name = cleaned.strip("*").strip()
                    current_competitor = {"name": name, "ai_adoption": "", "relevance": ""}
                elif current_competitor:
                    lower = cleaned.lower()
                    if "ai" in lower or "copilot" in lower or "autonomous" in lower or "adoption" in lower:
                        current_competitor["ai_adoption"] = cleaned
                    elif not current_competitor.get("relevance"):
                        current_competitor["relevance"] = cleaned
                    else:
                        current_competitor["relevance"] += " " + cleaned
            if current_competitor and current_competitor.get("name"):
                competitors.append(current_competitor)
            research.competitors = competitors[:5]
        elif field == "ai_summary":
            research.competitor_ai_adoption_summary = text

        buffer = []

    for line in lines:
        stripped = line.strip()
        matched = False
        for section_key in section_map:
            if section_key in stripped.upper():
                flush_buffer()
                current_section = section_key
                after = stripped.split(":", 1)
                if len(after) > 1 and after[1].strip():
                    buffer.append(after[1].strip())
                matched = True
                break
        if not matched:
            buffer.append(line)

    flush_buffer()


def _parse_firmographics(content: str, research: CompanyResearch) -> None:
    """Parse firmographic data response."""
    lines = content.split("\n")
    current_section = ""
    buffer: list[str] = []

    section_map = {
        "ESTIMATED HEADCOUNT": "headcount",
        "ENGINEERING PERCENTAGE": "eng_pct",
        "ESTIMATED REVENUE": "revenue",
    }

    def flush_buffer() -> None:
        nonlocal buffer, current_section
        if not current_section or not buffer:
            buffer = []
            return

        text = "\n".join(buffer).strip()
        field = section_map.get(current_section, "")

        if field == "headcount":
            research.estimated_headcount = text.strip("*").strip()
        elif field == "eng_pct":
            research.estimated_engineering_pct = text.strip("*").strip()
        elif field == "revenue":
            if not research.annual_revenue:  # Don't overwrite public company data
                research.estimated_revenue_range = text.strip("*").strip()

        buffer = []

    for line in lines:
        stripped = line.strip()
        matched = False
        for section_key in section_map:
            if section_key in stripped.upper():
                flush_buffer()
                current_section = section_key
                after = stripped.split(":", 1)
                if len(after) > 1 and after[1].strip():
                    buffer.append(after[1].strip())
                matched = True
                break
        if not matched:
            buffer.append(line)

    flush_buffer()


def _parse_research(content: str, company_name: str) -> CompanyResearch:
    """Parse Perplexity response into structured CompanyResearch."""
    research = CompanyResearch(company_name=company_name)

    lines = content.split("\n")
    current_section = ""
    buffer: list[str] = []

    section_map = {
        "COMPANY SUMMARY": "summary",
        "PUBLIC OR PRIVATE": "public_or_private",
        "KEY INITIATIVES": "key_initiatives",
        "ENGINEERING CULTURE": "engineering_culture",
        "TECH STACK": "tech_stack",
        "RECENT NEWS": "recent_news",
        "KEY PEOPLE": "key_people",
        "STRATEGIC PRIORITIES": "strategic_priorities",
    }

    def flush_buffer() -> None:
        nonlocal buffer, current_section
        if not current_section or not buffer:
            buffer = []
            return

        text = "\n".join(buffer).strip()
        field = section_map.get(current_section, "")

        if field == "summary":
            research.summary = text
        elif field == "public_or_private":
            upper = text.upper().strip()
            # Remove leading markdown bold markers
            clean = re.sub(r'^\*{1,2}', '', upper).strip()
            # Check the first word — our prompt asks for it to start with PUBLIC or PRIVATE
            first_word = clean.split()[0] if clean.split() else ""
            if first_word == "PUBLIC":
                research.is_public_company = True
            elif first_word == "PRIVATE":
                research.is_public_company = False
            else:
                # Fallback: look for definitive keywords
                has_publicly_traded = bool(re.search(r'PUBLICLY\s+TRADED', upper))
                has_private = bool(re.search(r'\bPRIVATE(?:LY)?\b', upper))
                if has_publicly_traded:
                    research.is_public_company = True
                elif has_private:
                    research.is_public_company = False
                else:
                    research.is_public_company = False

            if research.is_public_company:
                # Try to extract ticker symbol — look for (MDB) or NASDAQ: MDB patterns
                paren_match = re.search(r'\((?:NASDAQ|NYSE):\s*([A-Z]{1,5})\)', text)
                if not paren_match:
                    paren_match = re.search(r'\(([A-Z]{1,5})\)', text)
                if paren_match:
                    research.ticker_symbol = paren_match.group(1)
                else:
                    # Look for "ticker: XYZ" or "ticker symbol XYZ" patterns
                    ticker_match = re.search(r'ticker(?:\s+symbol)?[:\s]+([A-Z]{1,5})\b', text, re.IGNORECASE)
                    if ticker_match:
                        research.ticker_symbol = ticker_match.group(1).upper()
        elif field == "engineering_culture":
            research.engineering_culture = text
        elif field in ("key_initiatives", "strategic_priorities", "tech_stack", "recent_news"):
            items = [line.lstrip("- •*0123456789.").strip() for line in buffer if line.strip()]
            cleaned = []
            for item in items:
                item = item.strip("*").strip()
                if item and not item.endswith(":") and len(item) > 5:
                    cleaned.append(item)
            items = cleaned
            if field == "key_initiatives":
                research.key_initiatives = items
            elif field == "strategic_priorities":
                research.strategic_priorities = items
            elif field == "tech_stack":
                research.tech_stack = items
            elif field == "recent_news":
                research.recent_news = items
        elif field == "key_people":
            people = []
            for line in buffer:
                cleaned = line.lstrip("- •*0123456789.").strip()
                if cleaned:
                    parts = cleaned.split(" - ", 1)
                    if len(parts) == 2:
                        people.append({"name": parts[0].strip(), "title": parts[1].strip()})
                    else:
                        people.append({"name": cleaned, "title": ""})
            research.key_people = people

        buffer = []

    for line in lines:
        stripped = line.strip()
        matched = False
        for section_key in section_map:
            if section_key in stripped.upper():
                flush_buffer()
                current_section = section_key
                after = stripped.split(":", 1)
                if len(after) > 1 and after[1].strip():
                    buffer.append(after[1].strip())
                matched = True
                break
        if not matched:
            buffer.append(line)

    flush_buffer()

    if not research.summary and not research.key_initiatives:
        research.summary = content[:2000]

    return research


def _parse_public_deep_dive(content: str, research: CompanyResearch) -> None:
    """Parse public company deep-dive response."""
    lines = content.split("\n")
    current_section = ""
    buffer: list[str] = []

    section_map = {
        "ANNUAL REVENUE": "annual_revenue",
        "ENGINEERING HEADCOUNT": "engineering_headcount",
        "R&D SPEND": "rd_spend",
        "FINANCIAL HIGHLIGHTS": "financial_highlights",
    }

    def flush_buffer() -> None:
        nonlocal buffer, current_section
        if not current_section or not buffer:
            buffer = []
            return

        text = "\n".join(buffer).strip()
        field = section_map.get(current_section, "")

        if field == "annual_revenue":
            research.annual_revenue = text
        elif field == "engineering_headcount":
            research.engineering_headcount = text
        elif field == "rd_spend":
            research.rd_spend = text
        elif field == "financial_highlights":
            items = [line.lstrip("- •*0123456789.").strip() for line in buffer if line.strip()]
            cleaned = [item.strip("*").strip() for item in items if item.strip("*").strip() and len(item.strip("*").strip()) > 5]
            research.financial_highlights = cleaned

        buffer = []

    for line in lines:
        stripped = line.strip()
        matched = False
        for section_key in section_map:
            if section_key in stripped.upper():
                flush_buffer()
                current_section = section_key
                after = stripped.split(":", 1)
                if len(after) > 1 and after[1].strip():
                    buffer.append(after[1].strip())
                matched = True
                break
        if not matched:
            buffer.append(line)

    flush_buffer()


def _parse_private_deep_dive(content: str, research: CompanyResearch) -> None:
    """Parse private company deep-dive response."""
    lines = content.split("\n")
    current_section = ""
    buffer: list[str] = []

    section_map = {
        "ENGINEERING BLOG INSIGHTS": "engineering_blog_insights",
        "OPEN SOURCE STRATEGY": "open_source_strategy",
        "FUNDING STAGE": "funding_stage",
    }

    def flush_buffer() -> None:
        nonlocal buffer, current_section
        if not current_section or not buffer:
            buffer = []
            return

        text = "\n".join(buffer).strip()
        field = section_map.get(current_section, "")

        if field == "engineering_blog_insights":
            items = [line.lstrip("- •*0123456789.").strip() for line in buffer if line.strip()]
            cleaned = [item.strip("*").strip() for item in items if item.strip("*").strip() and len(item.strip("*").strip()) > 5]
            research.engineering_blog_insights = cleaned
        elif field == "open_source_strategy":
            research.open_source_strategy = text
        elif field == "funding_stage":
            research.funding_stage = text

        buffer = []

    for line in lines:
        stripped = line.strip()
        matched = False
        for section_key in section_map:
            if section_key in stripped.upper():
                flush_buffer()
                current_section = section_key
                after = stripped.split(":", 1)
                if len(after) > 1 and after[1].strip():
                    buffer.append(after[1].strip())
                matched = True
                break
        if not matched:
            buffer.append(line)

    flush_buffer()
