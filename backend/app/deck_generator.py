"""Generate HTML pitch deck from analysis results using the Stripe scaffold format."""
from typing import Optional
from app.models import AnalysisResult, CompanyResearch, BusinessCase, RepoAnalysis
import html


def _e(text: str) -> str:
    """Escape HTML entities."""
    return html.escape(str(text))


def generate_deck_html(result: AnalysisResult) -> str:
    """Generate a complete HTML pitch deck from analysis results."""
    company = _e(result.company_name)
    org = _e(result.github_org)
    bc = result.business_case
    cr = result.company_research
    analyses = result.repo_analyses
    gtm = result.gtm_assets

    # Compute stats
    total_repos = len(result.repos)
    analyzed_repos = len(analyses)
    total_issues = sum(ra.repo.open_issues for ra in analyses)
    total_stars = sum(ra.repo.stars for ra in analyses)
    languages = set()
    for ra in analyses:
        for lang in ra.languages:
            languages.add(lang)
    top_langs = sorted(languages)[:8]

    # Top opportunities
    all_opps = []
    for ra in analyses:
        for opp in ra.devin_opportunities:
            all_opps.append({**opp, "repo": ra.repo.name})

    # Business case numbers
    savings = 0
    hours_recaptured = 0
    addressable = 0
    roi_multiple = "0x"
    manual_cost = 0
    devin_cost = 0
    if bc:
        savings = bc.roi_estimate.get("annual_savings", 0)
        hours_recaptured = bc.roi_estimate.get("hours_recaptured", 0)
        addressable = bc.roi_estimate.get("addressable_issues", 0)
        roi_multiple = bc.roi_estimate.get("roi_multiple", "0x")
        manual_cost = bc.roi_estimate.get("manual_cost", 0)
        devin_cost = bc.roi_estimate.get("devin_cost", 0)

    slides_html = []

    # --- SLIDE 1: TITLE ---
    slides_html.append(_slide_title(company, org, 1))

    # --- SLIDE 2: STATE OF SOFTWARE ENGINEERING ---
    slides_html.append(_slide_macro_zoom_out(company, 2))

    # --- SLIDE 3: AGENDA ---
    slides_html.append(_slide_agenda(company, 3))

    # --- SLIDE 4: STATE OF THE UNION ---
    slides_html.append(_slide_state_of_union(
        company, org, total_repos, analyzed_repos, total_issues,
        total_stars, top_langs, cr, 4
    ))

    # --- SLIDE 5: THREE-TIER IMPACT ---
    slides_html.append(_slide_three_tier_impact(company, bc, 5))

    # --- SLIDE 6: DISCOVERY QUESTIONS ---
    slides_html.append(_slide_discovery(company, gtm, cr, 6))

    # --- SLIDE 7: TOP OPPORTUNITIES ---
    slides_html.append(_slide_opportunities(company, analyses, 7))

    # --- SLIDE 8: HOW DEVIN WORKS ---
    slides_html.append(_slide_how_devin_works(company, 8))

    # --- SLIDE 9: BUILD VS BUY ---
    slides_html.append(_slide_build_vs_buy(company, bc, 9))

    # --- SLIDE 10: COST ANALYSIS ---
    slides_html.append(_slide_cost_analysis(company, bc, 10))

    # --- SLIDE 11: ANNUAL ROI ---
    slides_html.append(_slide_annual_roi(
        company, savings, hours_recaptured, addressable, roi_multiple, 11
    ))

    # --- SLIDE 12: SECURITY ---
    slides_html.append(_slide_security(company, 12))

    # --- SLIDE 13: COLLABORATIVE CLOSE ---
    slides_html.append(_slide_close(company, 13))

    all_slides = "\n\n".join(slides_html)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1280, initial-scale=1.0">
<title>Devin x {company} &mdash; Engineering Efficiency Partnership</title>
{_css()}
</head>
<body>
{all_slides}
</body>
</html>
"""


def _footer(company: str, slide_num: int) -> str:
    return f'<div class="slide-bottom-bar"><span>Devin &times; {company}</span><span class="slide-num">{slide_num:02d}</span></div>'


def _slide_title(company: str, org: str, n: int) -> str:
    return f"""<!-- SLIDE {n}: TITLE -->
<div class="slide slide-title">
  <div class="slide-content">
  <div class="logos">
    <span class="logo-text logo-devin">devin</span>
    <span class="logo-x">&times;</span>
    <span class="logo-text logo-company">{company.lower()}</span>
  </div>
  <h1>Accelerating Engineering Quality<br>with Autonomous Engineering</h1>
  <p class="subtitle">A data-driven assessment of {company}'s engineering landscape and Devin's potential impact</p>
  <p class="meta">Prepared for {company} Engineering Leadership &bull; Confidential</p>
  </div>
  {_footer(company, n)}
</div>"""


def _slide_macro_zoom_out(company: str, n: int) -> str:
    return f"""<!-- SLIDE {n}: STATE OF SOFTWARE ENGINEERING -->
<div class="slide slide-dark">
  <div class="slide-content">
  <div class="slide-label" style="color: var(--accent-cyan);">Zooming Out</div>
  <h2>The state of software engineering<br>has a maintenance problem.</h2>
  <p style="max-width: 900px; margin-bottom: 20px; font-size: 15px;">Across the industry, engineering teams spend a disproportionate amount of time reviewing, stabilizing, and maintaining older infrastructure. Somebody has to do the work &mdash; and it's usually your most senior people.</p>
  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 8px;">
    <div class="card-dark" style="text-align: center; padding: 20px;">
      <div style="font-size: 36px; font-weight: 900; color: var(--accent-cyan); margin-bottom: 4px;">60%</div>
      <p style="font-size: 13px; color: rgba(255,255,255,0.7);">of engineering time spent on maintenance, not innovation</p>
      <p style="font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 6px;">Source: Stripe Developer Coefficient Report</p>
    </div>
    <div class="card-dark" style="text-align: center; padding: 20px;">
      <div style="font-size: 36px; font-weight: 900; color: var(--accent-cyan); margin-bottom: 4px;">$85B</div>
      <p style="font-size: 13px; color: rgba(255,255,255,0.7);">lost annually to developer time on maintenance &amp; technical debt</p>
      <p style="font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 6px;">Source: Stripe Developer Coefficient Report</p>
    </div>
    <div class="card-dark" style="text-align: center; padding: 20px;">
      <div style="font-size: 36px; font-weight: 900; color: var(--accent-cyan); margin-bottom: 4px;">3.8 hrs</div>
      <p style="font-size: 13px; color: rgba(255,255,255,0.7);">per developer per week spent on code review &amp; stabilization</p>
      <p style="font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 6px;">Source: GitHub State of the Octoverse</p>
    </div>
  </div>
  <div style="margin-top: 20px; padding: 16px 24px; background: rgba(0,212,255,0.06); border: 1px solid rgba(0,212,255,0.15); border-radius: 10px;">
    <p style="font-size: 15px; color: rgba(255,255,255,0.85); margin: 0;"><strong style="color: white;">The question isn't whether this work matters</strong> &mdash; it absolutely does. The question is: <em>does it have to be your best engineers doing it?</em></p>
  </div>
  </div>
  {_footer(company, n)}
</div>"""


def _slide_agenda(company: str, n: int) -> str:
    return f"""<!-- SLIDE {n}: AGENDA -->
<div class="slide slide-light">
  <div class="slide-content">
  <div class="accent-line"></div>
  <div class="slide-label">Today's Agenda</div>
  <h2>A conversation, not just a presentation</h2>
  <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">We'll zoom out on the industry, zoom in on {company}'s world, and keep shifting perspective throughout.</p>
  <div class="agenda-items">
    <div class="agenda-item highlight">
      <div class="agenda-time">10-15 min</div>
      <div class="agenda-content">
        <h4>Discovery &amp; State of the Union</h4>
        <p>What we've learned about {company}'s engineering landscape &mdash; assessed across business, engineering leadership, and developer impact</p>
      </div>
    </div>
    <div class="agenda-item">
      <div class="agenda-time">5 min</div>
      <div class="agenda-content">
        <h4>The Opportunity</h4>
        <p>Real issues we've identified across {company}'s repositories and the infrastructure quality gap</p>
      </div>
    </div>
    <div class="agenda-item">
      <div class="agenda-time">5 min</div>
      <div class="agenda-content">
        <h4>How Devin Works</h4>
        <p>Autonomous engineering vs. copilot-style tools &mdash; the technical details</p>
      </div>
    </div>
    <div class="agenda-item">
      <div class="agenda-time">10 min</div>
      <div class="agenda-content">
        <h4>Impact &amp; ROI</h4>
        <p>Cost model, annual value, and build vs. buy comparison</p>
      </div>
    </div>
    <div class="agenda-item">
      <div class="agenda-time">5-10 min</div>
      <div class="agenda-content">
        <h4>Discussion &amp; Next Steps</h4>
        <p>Open Q&amp;A, timeline, and pilot proposal</p>
      </div>
    </div>
  </div>
  </div>
  {_footer(company, n)}
</div>"""


def _slide_state_of_union(
    company: str, org: str, total_repos: int, analyzed_repos: int,
    total_issues: int, total_stars: int, top_langs: list,
    cr: Optional[CompanyResearch], n: int
) -> str:
    langs_str = ", ".join(top_langs) if top_langs else "Multiple"

    # Build initiative cards if we have company research
    initiative_html = ""
    if cr and cr.key_initiatives:
        initiatives = cr.key_initiatives[:3]
        initiative_html = f"""
    <div class="sotu-card">
      <div class="sotu-number">{len(cr.key_initiatives)}</div>
      <h4>Strategic Initiatives</h4>
      <p>{_e('; '.join(initiatives[:2]))}</p>
    </div>"""

    culture_html = ""
    if cr and cr.engineering_culture:
        culture_snippet = cr.engineering_culture[:120]
        culture_html = f"""
    <div class="sotu-card">
      <div class="sotu-number">&#128736;</div>
      <h4>Engineering Culture</h4>
      <p>{_e(culture_snippet)}...</p>
    </div>"""

    return f"""<!-- SLIDE {n}: STATE OF THE UNION -->
<div class="slide slide-light">
  <div class="slide-content">
  <div class="accent-line"></div>
  <div class="slide-label">State of the Union</div>
  <h2>Here's what we know about<br>{company}'s engineering landscape</h2>
  <p style="max-width: 900px; margin-bottom: 8px; font-size: 15px; color: var(--text-secondary);">We've audited {company}'s public repository portfolio. Here's our understanding &mdash; we'd love you to correct or expand on anything.</p>
  <div class="sotu-grid">
    <div class="sotu-card">
      <div class="sotu-number">{total_repos}</div>
      <h4>Public Repositories</h4>
      <p>{analyzed_repos} analyzed in depth across {langs_str}</p>
    </div>
    <div class="sotu-card">
      <div class="sotu-number">{total_issues:,}</div>
      <h4>Open Issues</h4>
      <p>Across analyzed repos &mdash; maintenance backlog impacting velocity</p>
    </div>
    <div class="sotu-card">
      <div class="sotu-number">{total_stars:,}</div>
      <h4>GitHub Stars</h4>
      <p>Significant open-source footprint with community expectations</p>
    </div>
    <div class="sotu-card">
      <div class="sotu-number">{len(top_langs)}</div>
      <h4>Languages</h4>
      <p>{langs_str}</p>
    </div>{initiative_html}{culture_html}
  </div>
  <div style="margin-top: 12px; padding: 14px 20px; background: rgba(99,91,255,0.04); border: 1px solid rgba(99,91,255,0.12); border-radius: 10px;">
    <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 8px 0;"><strong style="color: var(--accent-purple);">We've assessed impact at three levels of your organization:</strong></p>
    <div style="display: flex; gap: 12px;">
      <span style="font-size: 11px; font-weight: 700; color: var(--accent-purple); background: rgba(99,91,255,0.1); padding: 5px 14px; border-radius: 20px;">Business Strategy</span>
      <span style="font-size: 11px; font-weight: 700; color: var(--accent-purple); background: rgba(99,91,255,0.1); padding: 5px 14px; border-radius: 20px;">Engineering Leadership</span>
      <span style="font-size: 11px; font-weight: 700; color: var(--accent-purple); background: rgba(99,91,255,0.1); padding: 5px 14px; border-radius: 20px;">Developer Experience</span>
    </div>
  </div>
  </div>
  {_footer(company, n)}
</div>"""


def _slide_three_tier_impact(company: str, bc: Optional[BusinessCase], n: int) -> str:
    exec_metrics = ["Cost savings from automated maintenance", "Hours recaptured for strategic work", "Faster time-to-market on initiatives"]
    em_metrics = ["Clear issue backlog without adding headcount", "Improve test coverage across under-tested repos", "Free senior engineers for architecture work"]
    dev_metrics = ["Review-only workflow — Devin writes the code, you approve", "No more context-switching for routine fixes", "AI handles boilerplate: tests, docs, dependency updates"]

    if bc and bc.three_tier_impact:
        ti = bc.three_tier_impact
        if "executive" in ti:
            exec_metrics = ti["executive"].get("metrics", exec_metrics)[:3]
        if "engineering_manager" in ti:
            em_metrics = ti["engineering_manager"].get("metrics", em_metrics)[:3]
        if "developer" in ti:
            dev_metrics = ti["developer"].get("metrics", dev_metrics)[:3]

    def _metric_list(metrics: list) -> str:
        items = "".join(f'<li style="font-size: 13px; margin-bottom: 4px;">{_e(m)}</li>' for m in metrics)
        return f'<ul style="list-style: none; padding: 0; margin: 8px 0 0 0;">{items}</ul>'

    return f"""<!-- SLIDE {n}: THREE-TIER IMPACT -->
<div class="slide slide-dark">
  <div class="slide-content">
  <div class="slide-label">Impact Assessment</div>
  <h2>Three levels of impact for {company}</h2>
  <p style="max-width: 900px; margin-bottom: 16px;">We've mapped Devin's potential value across every level of your engineering organization.</p>
  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
    <div class="card-dark" style="padding: 20px;">
      <h3 style="color: var(--accent-cyan); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">&#127970; Business Impact</h3>
      {_metric_list(exec_metrics)}
    </div>
    <div class="card-dark" style="padding: 20px;">
      <h3 style="color: var(--accent-cyan); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">&#128200; Engineering Manager Impact</h3>
      {_metric_list(em_metrics)}
    </div>
    <div class="card-dark" style="padding: 20px;">
      <h3 style="color: var(--accent-cyan); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">&#9000; Hands-on-Keyboard Impact</h3>
      {_metric_list(dev_metrics)}
    </div>
  </div>
  </div>
  {_footer(company, n)}
</div>"""


def _slide_discovery(company: str, gtm, cr: Optional[CompanyResearch], n: int) -> str:
    questions = [
        f"How does infrastructure quality across {company}'s repos factor into your 2026 planning?",
        "How does your team prioritize maintenance and tech debt vs. new feature work?",
        "What's your current stance on AI-assisted code changes in production workflows?",
    ]
    if gtm and gtm.discovery_questions:
        questions = gtm.discovery_questions[:3]

    labels = ["Business Strategy", "Engineering Leadership", "Developers & Security"]
    whys = [
        "Helps us connect our work to your strategic priorities",
        "Tells us where Devin fits in your workflow",
        "Shapes how we'd deploy and what review requirements we'd follow",
    ]

    cards = ""
    for i, (q, label, why) in enumerate(zip(questions, labels, whys)):
        cards += f"""
    <div class="card-dark" style="padding: 28px 24px; display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="q-icon">{i + 1}</div>
        <div class="question-group-label" style="margin: 0;">{_e(label)}</div>
      </div>
      <p style="font-size: 15px; line-height: 1.6;">{_e(q)}</p>
      <p style="font-size: 12px; color: rgba(255,255,255,0.35); margin-top: auto;">{_e(why)}</p>
    </div>"""

    return f"""<!-- SLIDE {n}: DISCOVERY QUESTIONS -->
<div class="slide slide-dark">
  <div class="slide-content">
  <div class="slide-label">Discovery</div>
  <h2>Three questions to guide our conversation</h2>
  <p style="max-width: 800px; margin-bottom: 32px; font-size: 15px;">One for each level of your organization &mdash; so we focus on what matters most.</p>
  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px;">{cards}
  </div>
  </div>
  {_footer(company, n)}
</div>"""


def _slide_opportunities(company: str, analyses: list[RepoAnalysis], n: int) -> str:
    # Get top 4 repos with most opportunities
    top_repos = sorted(analyses, key=lambda ra: len(ra.devin_opportunities), reverse=True)[:4]

    cards = ""
    for ra in top_repos:
        opps = ra.devin_opportunities[:2]
        opp_tags = "".join(
            f'<span class="issue-tag">{_e(o["type"])} ({o["count"]})</span> '
            for o in opps
        )
        desc = opps[0]["description"] if opps else "Maintenance and code quality improvements"
        cards += f"""
    <div class="card" style="padding: 18px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        {opp_tags}
        <span style="font-size: 12px; color: var(--text-secondary);">&#9733; {ra.repo.stars:,}</span>
      </div>
      <h3 style="font-size: 16px;">{_e(ra.repo.name)}</h3>
      <p style="font-size: 14px;">{_e(ra.repo.description or desc)}</p>
    </div>"""

    return f"""<!-- SLIDE {n}: TOP OPPORTUNITIES -->
<div class="slide slide-light">
  <div class="slide-content">
  <div class="accent-line"></div>
  <div class="slide-label">The Opportunity</div>
  <h2>Where Devin can drive the most<br>impact across {company}'s repos</h2>
  <div class="card-grid" style="margin-top: 24px;">{cards}
  </div>
  </div>
  {_footer(company, n)}
</div>"""


def _slide_how_devin_works(company: str, n: int) -> str:
    return f"""<!-- SLIDE {n}: HOW DEVIN WORKS -->
<div class="slide slide-light">
  <div class="slide-content">
  <div class="accent-line"></div>
  <div class="slide-label">The Solution</div>
  <h2>Devin is an autonomous software engineer</h2>
  <p style="max-width: 850px; margin-bottom: 24px;">Not a copilot. Not an autocomplete. A full engineer that reads your codebase, plans, implements, tests, and opens PRs &mdash; while your team focuses on product work.</p>
  <div class="flow-steps">
    <div class="flow-step">
      <div class="step-num">1</div>
      <h4>Assign</h4>
      <p>Point Devin at a GitHub issue, Slack message, or Jira ticket</p>
    </div>
    <div class="flow-step">
      <div class="step-num">2</div>
      <h4>Explore</h4>
      <p>Devin reads the codebase, understands the problem, and creates a plan</p>
    </div>
    <div class="flow-step">
      <div class="step-num">3</div>
      <h4>Implement</h4>
      <p>Writes code, adds tests, iterates on build failures autonomously</p>
    </div>
    <div class="flow-step">
      <div class="step-num">4</div>
      <h4>Review</h4>
      <p>Opens a PR with clean commits &mdash; your engineer reviews, not codes</p>
    </div>
  </div>
  <div style="margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px;">
    <div class="card" style="text-align: center; padding: 16px;">
      <div style="font-size: 28px; font-weight: 900; color: var(--accent-purple);">24/7</div>
      <p style="font-size: 12px;">Works any hour, any timezone</p>
    </div>
    <div class="card" style="text-align: center; padding: 16px;">
      <div style="font-size: 28px; font-weight: 900; color: var(--accent-purple);">Any Language</div>
      <p style="font-size: 12px;">Python, Java, Go, TS, Rust, etc.</p>
    </div>
    <div class="card" style="text-align: center; padding: 16px;">
      <div style="font-size: 28px; font-weight: 900; color: var(--accent-purple);">Parallel</div>
      <p style="font-size: 12px;">Run 10+ sessions simultaneously</p>
    </div>
    <div class="card" style="text-align: center; padding: 16px;">
      <div style="font-size: 28px; font-weight: 900; color: var(--accent-purple);">Sandboxed</div>
      <p style="font-size: 12px;">Isolated VM per session, SOC 2</p>
    </div>
  </div>
  </div>
  {_footer(company, n)}
</div>"""


def _slide_build_vs_buy(company: str, bc: Optional[BusinessCase], n: int) -> str:
    hire_cost = "$1,200"
    copilot_cost = "$720"
    devin_cost = "$225"
    if bc and bc.build_vs_buy:
        bvb = bc.build_vs_buy
        hire_cost = bvb.get("hire", {}).get("cost_per_pass", hire_cost)
        copilot_cost = bvb.get("copilot", {}).get("cost_per_pass", copilot_cost)
        devin_cost = bvb.get("devin", {}).get("cost_per_pass", devin_cost)

    return f"""<!-- SLIDE {n}: BUILD VS BUY -->
<div class="slide slide-light">
  <div class="slide-content">
  <div class="accent-line"></div>
  <div class="slide-label">Build vs. Buy</div>
  <h2>Three approaches to {company}'s<br>engineering maintenance</h2>
  <table class="cost-table" style="margin-top: 24px;">
    <thead>
      <tr>
        <th>Approach</th>
        <th>Cost / Pass</th>
        <th>Ramp Time</th>
        <th>Scaling</th>
        <th>Risk</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="font-weight:600;">Hire / Build In-House</td>
        <td>{hire_cost}</td>
        <td>3-6 months</td>
        <td>Linear headcount</td>
        <td>Retention, domain knowledge loss</td>
      </tr>
      <tr>
        <td style="font-weight:600;">Cursor / Claude Code</td>
        <td>{copilot_cost}</td>
        <td>Immediate but in-seat</td>
        <td>Still 1:1 with engineers</td>
        <td>Productivity gains plateau</td>
      </tr>
      <tr class="highlight-row">
        <td>Devin (Autonomous)</td>
        <td>{devin_cost}</td>
        <td>Days, not months</td>
        <td>Parallel &mdash; many tasks at once</td>
        <td>Requires review workflow</td>
      </tr>
    </tbody>
  </table>
  <div style="margin-top: 24px; padding: 16px 24px; background: rgba(99,91,255,0.04); border: 1px solid rgba(99,91,255,0.12); border-radius: 10px;">
    <p style="font-size: 15px; color: var(--text-secondary); margin: 0;"><strong style="color: var(--accent-purple);">Key insight:</strong> With Cursor/Claude Code, you trade coding time for prompting time &mdash; you're still in the seat. With Devin, you trade it for <strong>review time</strong>, which is 5-10x less.</p>
  </div>
  </div>
  {_footer(company, n)}
</div>"""


def _slide_cost_analysis(company: str, bc: Optional[BusinessCase], n: int) -> str:
    manual = "$7,500"
    copilot = "$3,770"
    devin = "$1,250"
    savings_pct = "83%"
    net_savings = "$6,250"

    if bc and bc.roi_estimate:
        roi = bc.roi_estimate
        eng_rate = roi.get("engineer_hourly_rate", 150)
        addressable = roi.get("addressable_issues", 50)
        m_cost = addressable * 8 * eng_rate
        c_cost = int(addressable * 8 * eng_rate * 0.6) + 20
        d_cost = int(addressable * 1.5 * eng_rate) + 500
        manual = f"${m_cost:,}"
        copilot = f"${c_cost:,}"
        devin = f"${d_cost:,}"
        if m_cost > 0:
            pct = int((1 - d_cost / m_cost) * 100)
            savings_pct = f"{pct}%"
            net_savings = f"${m_cost - d_cost:,}"

    return f"""<!-- SLIDE {n}: COST ANALYSIS -->
<div class="slide slide-light">
  <div class="slide-content">
  <div class="accent-line"></div>
  <div class="slide-label">Cost Analysis</div>
  <h2>{savings_pct} cost reduction vs. manual engineering</h2>
  <div class="two-col" style="margin-top: 16px;">
    <div>
      <table class="cost-table">
        <thead>
          <tr>
            <th>Approach</th>
            <th>Total Cost</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight:600;">Manual</td>
            <td style="font-weight:700;">{manual}</td>
          </tr>
          <tr>
            <td style="font-weight:600;">Cursor / Claude Code</td>
            <td style="font-weight:700;">{copilot}</td>
          </tr>
          <tr class="highlight-row">
            <td>Devin Enterprise</td>
            <td>{devin}</td>
          </tr>
        </tbody>
      </table>
      <p style="font-size: 13px; color: var(--text-secondary); margin-top: 12px;">Based on $150/hr fully loaded senior engineer cost.</p>
    </div>
    <div>
      <div style="margin-bottom: 24px;">
        <div class="compare-bar">
          <div class="bar-label"><span>Manual</span><span>{manual}</span></div>
          <div class="bar-track">
            <div class="bar-fill" style="width: 100%; background: var(--text-secondary);">Full engineer time</div>
          </div>
        </div>
      </div>
      <div style="margin-bottom: 24px;">
        <div class="compare-bar">
          <div class="bar-label"><span>Cursor / Claude Code</span><span>{copilot}</span></div>
          <div class="bar-track">
            <div class="bar-fill" style="width: 50%; background: #8898AA;">In-seat prompting</div>
          </div>
        </div>
      </div>
      <div style="margin-bottom: 24px;">
        <div class="compare-bar">
          <div class="bar-label"><span>Devin Enterprise</span><span style="color: var(--accent-purple);">{devin}</span></div>
          <div class="bar-track">
            <div class="bar-fill" style="width: 17%; background: linear-gradient(90deg, var(--accent-purple), var(--accent-cyan)); border-radius: 8px;">Review only</div>
          </div>
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px;">
        <span class="savings-badge" style="font-size: 18px; padding: 10px 24px;">Net savings: {net_savings} per engagement ({savings_pct})</span>
      </div>
    </div>
  </div>
  </div>
  {_footer(company, n)}
</div>"""


def _slide_annual_roi(
    company: str, savings: float, hours_recaptured: float,
    addressable: int, roi_multiple: str, n: int
) -> str:
    savings_str = f"${savings:,.0f}" if savings > 0 else "$0"

    return f"""<!-- SLIDE {n}: ANNUAL ROI -->
<div class="slide slide-light">
  <div class="slide-content">
  <div class="accent-line"></div>
  <div class="slide-label">Annual ROI</div>
  <h2>{savings_str} in estimated annual savings<br>for {company}'s engineering team</h2>
  <p style="max-width: 900px; margin-bottom: 24px;">These savings compound as {company} ships new products and features &mdash; each requiring updates, test coverage, and regression testing across repositories.</p>
  <div class="stats-row">
    <div class="stat-item">
      <div class="stat-number purple">{savings_str}</div>
      <div class="stat-label">Annual engineering savings<br><span style="font-size: 13px; color: #8898AA;">vs. manual approach</span></div>
    </div>
    <div class="stat-item">
      <div class="stat-number purple">{hours_recaptured:,.0f}</div>
      <div class="stat-label">Senior engineer hours<br><span style="font-size: 13px; color: #8898AA;">Recaptured annually</span></div>
    </div>
    <div class="stat-item">
      <div class="stat-number purple">{roi_multiple}</div>
      <div class="stat-label">Return on Devin spend<br><span style="font-size: 13px; color: #8898AA;">Enterprise plan cost</span></div>
    </div>
  </div>
  <div class="card" style="background: rgba(99,91,255,0.04); border-color: rgba(99,91,255,0.2); margin-top: 8px;">
    <h3 style="color: var(--accent-purple);">Real-world precedent: Nubank</h3>
    <p>Nubank used Devin to migrate their core ETL monolith &mdash; 6M+ lines of code. Engineers achieved a <strong>12x efficiency improvement</strong> in engineering hours and <strong>20x cost savings</strong>. Migrations that were projected to take months completed in weeks.</p>
  </div>
  </div>
  {_footer(company, n)}
</div>"""


def _slide_security(company: str, n: int) -> str:
    return f"""<!-- SLIDE {n}: SECURITY -->
<div class="slide slide-dark">
  <div class="slide-content">
  <div class="slide-label">Security &amp; Compliance</div>
  <h2>Built for enterprise security standards</h2>
  <p style="max-width: 800px; margin-bottom: 32px;">Devin is designed for organizations with the highest security requirements. Every session runs in an isolated environment with full audit trails.</p>
  <div class="security-grid">
    <div class="security-item">
      <div class="security-icon">&#128274;</div>
      <div>
        <h4>Isolated Execution</h4>
        <p>Each Devin session runs in its own sandboxed VM. No shared state between sessions.</p>
      </div>
    </div>
    <div class="security-item">
      <div class="security-icon">&#128065;</div>
      <div>
        <h4>Full Audit Trail</h4>
        <p>Every action is logged and reviewable. Complete transparency for security teams.</p>
      </div>
    </div>
    <div class="security-item">
      <div class="security-icon">&#128272;</div>
      <div>
        <h4>Secret Management</h4>
        <p>Credentials stored encrypted and injected at runtime. Never written to disk or exposed in logs.</p>
      </div>
    </div>
    <div class="security-item">
      <div class="security-icon">&#9989;</div>
      <div>
        <h4>SOC 2 Type II</h4>
        <p>Cognition maintains SOC 2 Type II compliance. Enterprise SSO, RBAC, and data retention policies available.</p>
      </div>
    </div>
    <div class="security-item">
      <div class="security-icon">&#128736;</div>
      <div>
        <h4>No Training on Your Code</h4>
        <p>Devin does not train on customer code. Your proprietary logic stays yours.</p>
      </div>
    </div>
    <div class="security-item">
      <div class="security-icon">&#127760;</div>
      <div>
        <h4>SCM Integration</h4>
        <p>Native GitHub integration with branch protection, required reviews, and CI gates.</p>
      </div>
    </div>
  </div>
  </div>
  {_footer(company, n)}
</div>"""


def _slide_close(company: str, n: int) -> str:
    return f"""<!-- SLIDE {n}: COLLABORATIVE CLOSE -->
<div class="slide slide-gradient" style="text-align: center; justify-content: center; align-items: center;">
  <div class="slide-content" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
  <div style="max-width: 850px;">
    <div style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: rgba(255,255,255,0.5); margin-bottom: 20px;">Zooming Out One Last Time</div>
    <h2 style="font-size: 44px; font-weight: 900; letter-spacing: -1.5px; margin-bottom: 24px; color: white; line-height: 1.15;">The opportunities to provide<br>value are clear.</h2>
    <p style="font-size: 20px; line-height: 1.7; color: rgba(255,255,255,0.85); margin-bottom: 40px;">We started with the industry &mdash; 60% of engineering time on maintenance. We zoomed into {company} &mdash; real issues, real cost, real impact across business, engineering, and developers. Now the question is simple:</p>
    <p style="font-size: 22px; line-height: 1.6; color: white; font-weight: 600; margin-bottom: 40px;">What's the right combination of high-value impact<br>and where you're comfortable deploying?</p>
    <div style="display: flex; justify-content: center; gap: 24px; margin-bottom: 40px;">
      <div style="background: white; color: var(--accent-purple); padding: 16px 40px; border-radius: 10px; font-size: 18px; font-weight: 700;">Let's Figure It Out Together</div>
      <div style="background: rgba(255,255,255,0.15); color: white; padding: 16px 40px; border-radius: 10px; font-size: 18px; font-weight: 600; border: 1px solid rgba(255,255,255,0.3);">Schedule a Deep Dive</div>
    </div>
    <div style="font-size: 16px; color: rgba(255,255,255,0.7);">
      <strong style="color: white;">devin.ai</strong> &nbsp;|&nbsp; hello@cognition.ai
    </div>
  </div>
  </div>
  {_footer(company, n)}
</div>"""


def _css() -> str:
    """Return the full CSS stylesheet for the pitch deck."""
    return """<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  :root {
    --accent-purple: #635BFF;
    --dark-bg: #0A2540;
    --accent-cyan: #00D4FF;
    --text-secondary: #425466;
    --surface: #F6F9FC;
    --border: #E3E8EE;
    --accent-green: #33CB82;
    --accent-red: #DF1B41;
    --devin-blue: #0092FF;
    --devin-purple: #4900FF;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #0A2540;
    color: #0A2540;
    -webkit-font-smoothing: antialiased;
  }

  .slide {
    width: 1280px;
    height: 720px;
    max-height: 720px;
    margin: 0 auto;
    padding: 48px 96px 16px;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    page-break-inside: avoid;
    break-after: page;
    break-inside: avoid;
  }

  .slide-title {
    background: linear-gradient(135deg, #0A2540 0%, #1a3a5c 40%, #635BFF 100%);
    color: white;
    text-align: center;
    justify-content: center;
    align-items: center;
  }
  .slide-title .logos {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 32px;
    margin-bottom: 48px;
  }
  .slide-title .logo-text {
    font-size: 42px;
    font-weight: 800;
    letter-spacing: -1px;
  }
  .slide-title .logo-devin { color: #00D4FF; }
  .slide-title .logo-company { color: #fff; }
  .slide-title .logo-x { color: rgba(255,255,255,0.4); font-weight: 300; font-size: 32px; }
  .slide-title h1 {
    font-size: 52px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -1.5px;
    margin-bottom: 20px;
  }
  .slide-title .subtitle {
    font-size: 22px;
    font-weight: 400;
    color: rgba(255,255,255,0.7);
    max-width: 700px;
    margin: 0 auto 40px;
    line-height: 1.5;
  }
  .slide-title .meta {
    font-size: 14px;
    color: rgba(255,255,255,0.4);
    margin-top: 32px;
  }

  .slide-light { background: #FFFFFF; }
  .slide-light .slide-label {
    font-size: 13px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 2px; color: var(--accent-purple); margin-bottom: 12px;
  }
  .slide-light h2 {
    font-size: 40px; font-weight: 800; color: var(--dark-bg);
    letter-spacing: -1px; margin-bottom: 16px; line-height: 1.15;
  }
  .slide-light p, .slide-light li {
    font-size: 18px; line-height: 1.7; color: var(--text-secondary);
  }

  .slide-dark { background: var(--dark-bg); color: white; }
  .slide-dark .slide-label {
    font-size: 13px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 2px; color: var(--accent-cyan); margin-bottom: 12px;
  }
  .slide-dark h2 {
    font-size: 40px; font-weight: 800; color: #fff;
    letter-spacing: -1px; margin-bottom: 32px; line-height: 1.15;
  }
  .slide-dark p, .slide-dark li {
    font-size: 18px; line-height: 1.7; color: rgba(255,255,255,0.75);
  }

  .slide-gradient {
    background: linear-gradient(135deg, #635BFF 0%, #00D4FF 100%);
    color: white;
    text-align: center;
    align-items: center;
  }

  .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 8px; }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 28px;
  }
  .card h3 { font-size: 18px; font-weight: 700; color: var(--dark-bg); margin-bottom: 10px; }
  .card p { font-size: 15px; line-height: 1.6; color: var(--text-secondary); }
  .card .issue-tag {
    display: inline-block; font-size: 12px; font-weight: 600;
    background: rgba(99,91,255,0.1); color: var(--accent-purple);
    padding: 3px 10px; border-radius: 20px; margin-bottom: 10px;
  }
  .card-dark {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; padding: 28px;
  }
  .card-dark h3 { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 10px; }
  .card-dark p { font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.7); }

  .cost-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 16px; }
  .cost-table th {
    text-align: left; padding: 14px 20px; font-weight: 700; font-size: 14px;
    text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary);
    border-bottom: 2px solid var(--border);
  }
  .cost-table td { padding: 16px 20px; border-bottom: 1px solid var(--border); color: var(--dark-bg); }
  .cost-table tr:last-child td { border-bottom: none; }
  .cost-table .highlight-row { background: rgba(99,91,255,0.06); font-weight: 600; }
  .cost-table .highlight-row td { color: var(--accent-purple); }
  .savings-badge {
    display: inline-block; background: var(--accent-green); color: white;
    font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 20px;
  }

  .stats-row { display: flex; gap: 40px; margin: 32px 0; }
  .stat-item { flex: 1; text-align: center; }
  .stat-number { font-size: 56px; font-weight: 900; letter-spacing: -2px; line-height: 1; }
  .stat-number.purple { color: var(--accent-purple); }
  .stat-label { font-size: 15px; font-weight: 500; color: var(--text-secondary); margin-top: 8px; }

  .flow-steps { display: flex; gap: 16px; margin-top: 24px; }
  .flow-step {
    flex: 1; background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 24px 20px; text-align: center;
  }
  .flow-step .step-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--accent-purple); color: #fff; font-size: 14px;
    font-weight: 700; margin-bottom: 12px;
  }
  .flow-step h4 { font-size: 15px; font-weight: 700; color: var(--dark-bg); margin-bottom: 6px; }
  .flow-step p { font-size: 13px; line-height: 1.5; color: var(--text-secondary); }

  .compare-bar { margin: 12px 0; }
  .compare-bar .bar-label {
    display: flex; justify-content: space-between; font-size: 15px;
    font-weight: 600; color: var(--dark-bg); margin-bottom: 6px;
  }
  .compare-bar .bar-track {
    height: 36px; background: var(--surface); border-radius: 8px;
    overflow: hidden; border: 1px solid var(--border);
  }
  .compare-bar .bar-fill {
    height: 100%; border-radius: 8px 0 0 8px; display: flex;
    align-items: center; padding-left: 14px; font-size: 13px;
    font-weight: 700; color: white;
  }

  .security-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px; }
  .security-item {
    display: flex; gap: 16px; align-items: flex-start; padding: 20px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
  }
  .security-icon {
    width: 44px; height: 44px; border-radius: 10px;
    background: rgba(0,212,255,0.15); display: flex;
    align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;
  }
  .security-item h4 { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 4px; }
  .security-item p { font-size: 14px; line-height: 1.5; color: rgba(255,255,255,0.6); }

  .slide-content { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  .slide-bottom-bar {
    display: flex; justify-content: space-between; align-items: center;
    padding-top: 8px; font-size: 11px; font-weight: 500;
    color: rgba(0,0,0,0.25); flex-shrink: 0; width: 100%; text-align: left;
  }
  .slide-bottom-bar .slide-num { font-weight: 600; }
  .slide-dark .slide-bottom-bar,
  .slide-gradient .slide-bottom-bar,
  .slide-title .slide-bottom-bar { color: rgba(255,255,255,0.3); }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
  .divider {
    height: 3px; width: 60px;
    background: linear-gradient(90deg, var(--accent-purple), var(--accent-cyan));
    border-radius: 2px; margin: 16px 0 24px;
  }
  .accent-line {
    position: absolute; top: 0; left: 0; right: 0; height: 4px;
    background: linear-gradient(90deg, var(--accent-purple), var(--accent-cyan));
  }

  .agenda-items { display: flex; flex-direction: column; gap: 0; margin-top: 16px; }
  .agenda-item { display: flex; align-items: center; border-bottom: 1px solid var(--border); padding: 16px 0; }
  .agenda-item:last-child { border-bottom: none; }
  .agenda-time {
    width: 120px; flex-shrink: 0; font-size: 15px; font-weight: 700;
    color: var(--accent-purple); font-variant-numeric: tabular-nums; padding-left: 16px;
  }
  .agenda-content { flex: 1; padding-left: 24px; }
  .agenda-content h4 { font-size: 17px; font-weight: 700; color: var(--dark-bg); margin-bottom: 2px; }
  .agenda-content p { font-size: 14px; color: var(--text-secondary); line-height: 1.5; }
  .agenda-item.highlight {
    background: rgba(99,91,255,0.04); border-radius: 10px; padding: 16px 0;
    border: 2px solid rgba(99,91,255,0.15); margin-bottom: 4px;
  }

  .sotu-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 8px; }
  .sotu-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 16px;
  }
  .sotu-card .sotu-number {
    font-size: 28px; font-weight: 900; color: var(--accent-purple);
    letter-spacing: -1px; line-height: 1; margin-bottom: 4px;
  }
  .sotu-card h4 { font-size: 13px; font-weight: 700; color: var(--dark-bg); margin-bottom: 3px; }
  .sotu-card p { font-size: 12px; line-height: 1.4; color: var(--text-secondary); }

  .question-group-label {
    font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1.5px; color: var(--accent-cyan);
  }
  .q-icon {
    width: 28px; height: 28px; border-radius: 8px;
    background: rgba(99,91,255,0.15); display: flex;
    align-items: center; justify-content: center; font-size: 14px;
    flex-shrink: 0; color: var(--accent-purple); font-weight: 800;
  }

  /* Print button bar */
  .print-bar {
    width: 1280px; margin: 0 auto; padding: 16px 96px;
    background: #f0f0f0; display: flex; justify-content: flex-end; gap: 16px;
  }
  .print-bar button {
    padding: 12px 32px; border: none; border-radius: 8px;
    font-size: 16px; font-weight: 700; cursor: pointer;
  }
  .btn-print {
    background: var(--accent-purple); color: white;
  }
  .btn-print:hover { background: #4a42e6; }

  @media print {
    body { background: white; margin: 0; padding: 0; }
    .slide {
      box-shadow: none; margin: 0;
      page-break-after: always; page-break-inside: avoid;
      break-after: page; break-inside: avoid;
      height: 720px; max-height: 720px; overflow: hidden;
    }
    .print-bar { display: none; }
  }
</style>"""
