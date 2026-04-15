import { useState, useEffect, useCallback } from 'react'
import './App.css'
import {
  Search, Loader2, Building2, GitBranch, BarChart3, FileText,
  ChevronRight, ExternalLink, AlertCircle, Bug, TestTube,
  BookOpen, Zap, Shield, Users, Clock, DollarSign, TrendingUp,
  Copy, Check, ArrowLeft, Presentation, Microscope
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface PastAnalysis {
  job_id: string
  status: string
  input_url: string
  company_name: string
  github_org: string
  repo_count: number
  created_at: string
}

interface RepoInfo {
  name: string
  full_name: string
  description: string | null
  url: string
  stars: number
  forks: number
  open_issues: number
  language: string | null
  last_pushed: string | null
  topics: string[]
}

interface RepoAnalysis {
  repo: RepoInfo
  issues_by_label: Record<string, number>
  top_issues: Array<{number: number; title: string; labels: string[]; url: string; comments: number}>
  languages: Record<string, number>
  test_file_ratio: number
  contributor_count: number
  devin_opportunities: Array<{type: string; count: number; impact: string; description: string; devin_advantage: string}>
}

interface CompanyResearch {
  company_name: string
  summary: string
  key_initiatives: string[]
  engineering_culture: string
  tech_stack: string[]
  recent_news: string[]
  key_people: Array<{name: string; title: string}>
  strategic_priorities: string[]
  is_public_company: boolean
  ticker_symbol: string
  // Public company fields
  annual_revenue: string
  engineering_headcount: string
  rd_spend: string
  financial_highlights: string[]
  // Private company fields
  engineering_blog_insights: string[]
  open_source_strategy: string
  funding_stage: string
}

interface BusinessCase {
  executive_summary: string
  roi_estimate: Record<string, unknown>
  build_vs_buy: Record<string, Record<string, string>>
  three_tier_impact: Record<string, {label: string; metrics: string[]}>
  opportunity_mapping: Array<Record<string, unknown>>
}

interface GTMAssets {
  pre_meeting_email: string
  discovery_questions: string[]
  executive_summary_doc: string
  cost_model: Record<string, unknown>
  pitch_outline: Array<{slide: number; title: string; content: string}>
}

interface AnalysisResult {
  job_id: string
  status: string
  input_url: string
  company_name: string
  github_org: string
  repos: RepoInfo[]
  repo_analyses: RepoAnalysis[]
  company_research: CompanyResearch | null
  business_case: BusinessCase | null
  gtm_assets: GTMAssets | null
  research_depth: string  // "light" or "deep"
  error: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Starting...',
  discovering: 'Discovering GitHub org...',
  analyzing_repos: 'Analyzing repositories...',
  researching_company: 'Researching company...',
  generating_business_case: 'Building business case...',
  generating_assets: 'Generating GTM assets...',
  completed: 'Complete',
  deep_researching: 'Running deep research...',
  failed: 'Failed',
}

function App() {
  const [view, setView] = useState<'home' | 'results'>('home')
  const [inputUrl, setInputUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('pending')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [pastAnalyses, setPastAnalyses] = useState<PastAnalysis[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Fetch past analyses on mount
  useEffect(() => {
    fetch(`${API_URL}/api/analyses`)
      .then(r => r.json())
      .then(setPastAnalyses)
      .catch(() => {})
  }, [view])

  // Poll for status updates
  useEffect(() => {
    if (!currentJobId || status === 'completed' || status === 'failed') return

    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${API_URL}/api/status/${currentJobId}`)
        const data = await r.json()
        setStatus(data.status)

        if (data.status === 'completed' || data.status === 'failed') {
          const fullResult = await fetch(`${API_URL}/api/results/${currentJobId}`)
          const fullData = await fullResult.json()
          setResult(fullData)
          setIsSubmitting(false)
          clearInterval(interval)
        }
      } catch {
        // ignore polling errors
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [currentJobId, status])

  const handleSubmit = async () => {
    if (!inputUrl.trim()) return
    setIsSubmitting(true)
    setStatus('pending')
    setResult(null)
    setActiveTab('overview')
    setView('results')

    try {
      const r = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_url: inputUrl.trim() }),
      })
      const data = await r.json()
      setCurrentJobId(data.job_id)
    } catch {
      setStatus('failed')
      setIsSubmitting(false)
    }
  }

  const loadResult = async (jobId: string) => {
    setCurrentJobId(jobId)
    setView('results')
    setIsSubmitting(true)
    try {
      const r = await fetch(`${API_URL}/api/results/${jobId}`)
      const data = await r.json()
      setResult(data)
      setStatus(data.status)
      setIsSubmitting(false)
    } catch {
      setStatus('failed')
      setIsSubmitting(false)
    }
  }

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  if (view === 'results') {
    return (
      <ResultsView
        result={result}
        status={status}
        isSubmitting={isSubmitting}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        copiedField={copiedField}
        copyToClipboard={copyToClipboard}
        onBack={() => { setView('home'); setCurrentJobId(null); setResult(null); }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-devin-green to-devin-blue rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-semibold text-lg">Devin GTM Engine</span>
          <span className="text-xs text-zinc-500 ml-1">by Cognition</span>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-bold tracking-tight">
            Turn any company into a
            <span className="bg-gradient-to-r from-devin-green to-devin-blue bg-clip-text text-transparent"> Devin business case</span>
          </h1>
          <p className="text-zinc-400 text-xl max-w-2xl mx-auto">
            Enter a company URL or GitHub org. We'll analyze their repos, research their strategy, and generate a complete sales playbook.
          </p>

          {/* Input */}
          <div className="max-w-2xl mx-auto mt-10">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="stripe.com, github.com/vercel, or just 'shopify'"
                  className="w-full pl-11 pr-4 py-4 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-devin-green focus:ring-1 focus:ring-devin-green text-lg"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!inputUrl.trim()}
                className="px-8 py-4 bg-devin-green hover:bg-devin-green-light disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl font-semibold text-lg transition-colors text-black"
              >
                Analyze
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Past Analyses */}
      {pastAnalyses.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 pb-24">
          <h2 className="text-zinc-400 text-sm font-medium uppercase tracking-wider mb-4">Recent Analyses</h2>
          <div className="grid gap-3">
            {pastAnalyses.map((a) => (
              <button
                key={a.job_id}
                onClick={() => loadResult(a.job_id)}
                className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors text-left w-full"
              >
                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
                  <Building2 size={18} className="text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.company_name || a.input_url}</div>
                  <div className="text-sm text-zinc-500">{a.repo_count} repos · {a.github_org}</div>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <span className={`inline-block w-2 h-2 rounded-full ${a.status === 'completed' ? 'bg-devin-green' : a.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  {new Date(a.created_at).toLocaleDateString()}
                </div>
                <ChevronRight size={16} className="text-zinc-600" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultsView({
  result, status, isSubmitting, activeTab, setActiveTab, copiedField, copyToClipboard, onBack
}: {
  result: AnalysisResult | null
  status: string
  isSubmitting: boolean
  activeTab: string
  setActiveTab: (t: string) => void
  copiedField: string | null
  copyToClipboard: (text: string, field: string) => void
  onBack: () => void
}) {
  const [deepResearchPolling, setDeepResearchPolling] = useState(false)
  const [localResult, setLocalResult] = useState<AnalysisResult | null>(result)

  // Keep localResult in sync with result prop
  useEffect(() => {
    if (result) setLocalResult(result)
  }, [result])

  // Poll during deep research
  useEffect(() => {
    if (!deepResearchPolling || !localResult) return
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${API_URL}/api/results/${localResult.job_id}`)
        const data = await r.json()
        setLocalResult(data)
        if (data.status === 'completed' && data.research_depth === 'deep') {
          setDeepResearchPolling(false)
          clearInterval(interval)
        }
      } catch {
        // ignore
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [deepResearchPolling, localResult?.job_id])

  const isLoading = isSubmitting && !localResult
  const displayResult = localResult

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center space-y-6">
          <Loader2 size={48} className="animate-spin text-devin-green mx-auto" />
          <div>
            <h2 className="text-2xl font-semibold mb-2">{STATUS_LABELS[status] || 'Processing...'}</h2>
            <p className="text-zinc-500">This typically takes 30-60 seconds</p>
          </div>
          <div className="flex justify-center gap-2">
            {['discovering', 'analyzing_repos', 'researching_company', 'generating_business_case', 'generating_assets', 'completed'].map((s, i) => {
              const steps = ['discovering', 'analyzing_repos', 'researching_company', 'generating_business_case', 'generating_assets', 'completed']
              const currentIdx = steps.indexOf(status)
              return (
                <div
                  key={s}
                  className={`h-2 w-12 rounded-full ${i <= currentIdx ? 'bg-devin-green' : 'bg-zinc-800'} transition-colors`}
                />
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (!displayResult) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle size={48} className="text-red-400 mx-auto" />
          <h2 className="text-xl font-semibold">Analysis failed</h2>
          <button onClick={onBack} className="text-devin-green hover:underline">Go back</button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'repos', label: 'Repositories', icon: GitBranch },
    { id: 'intel', label: 'Company Intel', icon: Building2 },
    { id: 'business_case', label: 'Business Case', icon: DollarSign },
    { id: 'assets', label: 'GTM Assets', icon: FileText },
  ]

  const isDeepResearching = displayResult.status === 'deep_researching'
  const isDeep = displayResult.research_depth === 'deep'

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-devin-green to-devin-blue rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">{displayResult.company_name}</h1>
            <span className="text-sm text-zinc-500">github.com/{displayResult.github_org} · {displayResult.repos.length} repos</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {displayResult.status === 'completed' && !isDeep && (
              <DeepResearchButton jobId={displayResult.job_id} onStarted={() => setDeepResearchPolling(true)} />
            )}
            {isDeepResearching && (
              <span className="flex items-center gap-2 px-3 py-1.5 bg-devin-blue/20 text-devin-blue text-sm rounded-full border border-devin-blue/30">
                <Loader2 size={14} className="animate-spin" /> Deep researching...
              </span>
            )}
            {displayResult.status === 'completed' && isDeep && (
              <GenerateDeckButton jobId={displayResult.job_id} />
            )}
            {displayResult.status === 'completed' && (
              <span className={`px-3 py-1 text-sm rounded-full border ${
                isDeep
                  ? 'bg-devin-purple/20 text-devin-purple-light border-devin-purple/40'
                  : 'bg-devin-green/15 text-devin-green border-devin-green/30'
              }`}>
                {isDeep ? 'Deep Research' : 'Light Preview'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-devin-green text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && <OverviewTab result={displayResult} />}
        {activeTab === 'repos' && <ReposTab result={displayResult} />}
        {activeTab === 'intel' && <IntelTab result={displayResult} isDeep={isDeep} isDeepResearching={isDeepResearching} onStartDeep={() => setDeepResearchPolling(true)} />}
        {activeTab === 'business_case' && <BusinessCaseTab result={displayResult} />}
        {activeTab === 'assets' && <AssetsTab result={displayResult} copiedField={copiedField} copyToClipboard={copyToClipboard} />}
      </div>
    </div>
  )
}

function GenerateDeckButton({ jobId }: { jobId: string }) {
  const [deckState, setDeckState] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')

  const handleGenerate = async () => {
    setDeckState('generating')
    try {
      const r = await fetch(`${API_URL}/api/generate-deck/${jobId}`)
      if (!r.ok) throw new Error('Deck generation failed')
      const htmlContent = await r.text()
      // Open in new tab
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setDeckState('done')
      // Reset after a few seconds so button can be used again
      setTimeout(() => setDeckState('idle'), 5000)
    } catch {
      setDeckState('error')
      setTimeout(() => setDeckState('idle'), 3000)
    }
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={deckState === 'generating'}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
        deckState === 'generating'
          ? 'bg-devin-purple/30 text-devin-purple-light cursor-wait'
          : deckState === 'done'
          ? 'bg-devin-green/20 text-devin-green border border-devin-green/40'
          : deckState === 'error'
          ? 'bg-red-900/30 text-red-400 border border-red-800'
          : 'bg-gradient-to-r from-devin-purple to-devin-blue hover:from-devin-purple-light hover:to-devin-blue-light text-white shadow-lg shadow-devin-purple/20'
      }`}
    >
      {deckState === 'generating' ? (
        <><Loader2 size={16} className="animate-spin" /> Generating Deck...</>
      ) : deckState === 'done' ? (
        <><Check size={16} /> Deck Opened</>
      ) : deckState === 'error' ? (
        <><AlertCircle size={16} /> Failed — Retry</>
      ) : (
        <><Presentation size={16} /> Generate Pitch Deck</>
      )}
    </button>
  )
}

function DeepResearchButton({ jobId, onStarted }: { jobId: string; onStarted: () => void }) {
  const [state, setState] = useState<'idle' | 'starting' | 'error'>('idle')

  const handleClick = async () => {
    setState('starting')
    try {
      const r = await fetch(`${API_URL}/api/deep-research/${jobId}`, { method: 'POST' })
      if (!r.ok) throw new Error('Failed to start deep research')
      onStarted()
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'starting'}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
        state === 'starting'
          ? 'bg-devin-blue/30 text-devin-blue-light cursor-wait'
          : state === 'error'
          ? 'bg-red-900/30 text-red-400 border border-red-800'
          : 'bg-gradient-to-r from-devin-blue to-devin-purple hover:from-devin-blue-light hover:to-devin-purple-light text-white shadow-lg shadow-devin-blue/20'
      }`}
    >
      {state === 'starting' ? (
        <><Loader2 size={16} className="animate-spin" /> Starting...</>
      ) : state === 'error' ? (
        <><AlertCircle size={16} /> Failed — Retry</>
      ) : (
        <><Microscope size={16} /> Run Deep Research</>
      )}
    </button>
  )
}

function OverviewTab({ result }: { result: AnalysisResult }) {
  const totalIssues = result.repos.reduce((s, r) => s + r.open_issues, 0)
  const totalStars = result.repos.reduce((s, r) => s + r.stars, 0)
  const languages = new Set(result.repos.map(r => r.language).filter(Boolean))
  const totalOpportunities = result.repo_analyses.reduce((s, ra) => s + ra.devin_opportunities.length, 0)
  const savings = result.business_case?.roi_estimate?.annual_savings as number | undefined

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={GitBranch} label="Repos Analyzed" value={result.repo_analyses.length.toString()} />
        <StatCard icon={AlertCircle} label="Open Issues" value={totalIssues.toLocaleString()} />
        <StatCard icon={Zap} label="Devin Opportunities" value={totalOpportunities.toString()} />
        <StatCard icon={DollarSign} label="Est. Annual Savings" value={savings ? `$${savings.toLocaleString()}` : 'N/A'} />
      </div>

      {/* Quick Facts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="font-semibold mb-4">GitHub Footprint</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">Public Repos</span><span>{result.repos.length}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Total Stars</span><span>{totalStars.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Languages</span><span>{Array.from(languages).slice(0, 5).join(', ')}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Open Issues</span><span>{totalIssues.toLocaleString()}</span></div>
          </div>
        </div>

        {result.company_research && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="font-semibold mb-4">Company Snapshot</h3>
            <p className="text-sm text-zinc-300 leading-relaxed">{result.company_research.summary || 'No summary available'}</p>
            {result.company_research.key_initiatives.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Key Initiatives</div>
                <div className="flex flex-wrap gap-2">
                  {result.company_research.key_initiatives.slice(0, 4).map((init, i) => (
                    <span key={i} className="px-2 py-1 bg-devin-green/15 text-devin-green text-xs rounded-md border border-devin-green/30">{init}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top Opportunities */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold mb-4">Top Devin Opportunities</h3>
        <div className="grid gap-3">
          {result.repo_analyses.flatMap(ra =>
            ra.devin_opportunities.map(opp => ({ ...opp, repo: ra.repo.name, repoUrl: ra.repo.url }))
          ).slice(0, 8).map((opp, i) => (
            <div key={i} className="flex items-start gap-4 p-4 bg-zinc-800/50 rounded-lg">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                opp.impact === 'high' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'
              }`}>
                {opp.type === 'Bug Fixes' ? <Bug size={18} /> :
                 opp.type === 'Test Coverage' ? <TestTube size={18} /> :
                 opp.type === 'Documentation' ? <BookOpen size={18} /> :
                 <Zap size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{opp.type}</span>
                  <span className="text-xs text-zinc-500">in {opp.repo}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    opp.impact === 'high' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'
                  }`}>{opp.impact}</span>
                </div>
                <p className="text-sm text-zinc-400">{opp.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof GitBranch; label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <Icon size={18} className="text-zinc-500" />
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}

function ReposTab({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-4">
      {result.repo_analyses.map((ra) => (
        <div key={ra.repo.full_name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <a href={ra.repo.url} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold hover:text-devin-green flex items-center gap-2">
                {ra.repo.name} <ExternalLink size={14} />
              </a>
              <p className="text-sm text-zinc-400 mt-1">{ra.repo.description}</p>
            </div>
            <div className="flex gap-4 text-sm text-zinc-400">
              <span>&#9733; {ra.repo.stars.toLocaleString()}</span>
              <span>{ra.repo.open_issues} issues</span>
              <span>{ra.repo.language}</span>
            </div>
          </div>

          {/* Languages bar */}
          {Object.keys(ra.languages).length > 0 && (
            <div className="mb-4">
              <div className="flex h-2 rounded-full overflow-hidden">
                {Object.entries(ra.languages).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([lang, bytes], i) => {
                  const total = Object.values(ra.languages).reduce((s, v) => s + v, 0)
                  const pct = (bytes / total) * 100
                  const colors = ['bg-devin-green', 'bg-devin-purple', 'bg-devin-blue', 'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500']
                  return <div key={lang} className={`${colors[i]} ${i === 0 ? 'rounded-l-full' : ''}`} style={{ width: `${pct}%` }} title={`${lang}: ${pct.toFixed(1)}%`} />
                })}
              </div>
              <div className="flex gap-3 mt-2 text-xs text-zinc-500">
                {Object.entries(ra.languages).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([lang, bytes]) => {
                  const total = Object.values(ra.languages).reduce((s, v) => s + v, 0)
                  return <span key={lang}>{lang} {((bytes / total) * 100).toFixed(0)}%</span>
                })}
              </div>
            </div>
          )}

          {/* Opportunities */}
          {ra.devin_opportunities.length > 0 && (
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Devin Opportunities</div>
              <div className="flex flex-wrap gap-2">
                {ra.devin_opportunities.map((opp, i) => (
                  <span key={i} className={`px-3 py-1.5 text-sm rounded-lg border ${
                    opp.impact === 'high' ? 'bg-red-900/20 text-red-300 border-red-800' : 'bg-yellow-900/20 text-yellow-300 border-yellow-800'
                  }`}>
                    {opp.type} ({opp.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top Issues */}
          {ra.top_issues.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Recent Issues</div>
              <div className="space-y-1">
                {ra.top_issues.slice(0, 5).map((issue) => (
                  <a key={issue.number} href={issue.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-zinc-300 hover:text-devin-green py-1">
                    <span className="text-zinc-600">#{issue.number}</span>
                    <span className="truncate">{issue.title}</span>
                    {issue.labels.slice(0, 2).map(l => (
                      <span key={l} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-500 text-xs rounded">{l}</span>
                    ))}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function IntelTab({ result, isDeep, isDeepResearching, onStartDeep }: { result: AnalysisResult; isDeep: boolean; isDeepResearching: boolean; onStartDeep: () => void }) {
  const research = result.company_research

  if (!research) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
        <Shield size={48} className="text-zinc-700 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Company research not available</h3>
        <p className="text-zinc-500">Configure a Perplexity API key to enable AI-powered company research.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Deep Research CTA — show when light mode */}
      {!isDeep && !isDeepResearching && result.status === 'completed' && (
        <div className="bg-gradient-to-r from-devin-blue/10 to-devin-purple/10 border border-devin-blue/30 rounded-xl p-6 flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-1"><Microscope size={16} className="text-devin-blue" /> Light Preview</h3>
            <p className="text-sm text-zinc-400">
              This is a quick snapshot. Run deep research to unlock {research.is_public_company ? 'annual reports, financials, R&D spend' : 'engineering blogs, OSS strategy, funding details'} and generate a pitch deck.
            </p>
          </div>
          <DeepResearchButton jobId={result.job_id} onStarted={onStartDeep} />
        </div>
      )}
      {isDeepResearching && (
        <div className="bg-devin-blue/10 border border-devin-blue/30 rounded-xl p-6 flex items-center gap-4">
          <Loader2 size={24} className="animate-spin text-devin-blue" />
          <div>
            <h3 className="font-semibold text-devin-blue">Deep research in progress...</h3>
            <p className="text-sm text-zinc-400">Analyzing {research.is_public_company ? 'annual reports and financial data' : 'engineering blogs and strategic initiatives'}. This typically takes 15-30 seconds.</p>
          </div>
        </div>
      )}

      {/* Summary + Company Type Badge */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold">Company Summary</h3>
          <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
            research.is_public_company
              ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
              : 'bg-blue-900/30 text-blue-400 border-blue-800'
          }`}>
            {research.is_public_company ? `Public${research.ticker_symbol ? ` · ${research.ticker_symbol}` : ''}` : 'Private'}
          </span>
        </div>
        <p className="text-zinc-300 leading-relaxed">{research.summary}</p>
      </div>

      {/* Public Company Financials */}
      {research.is_public_company && (research.annual_revenue || research.rd_spend || research.engineering_headcount) && (
        <div className="bg-gradient-to-br from-emerald-900/20 to-teal-900/20 border border-emerald-800/50 rounded-xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign size={16} className="text-emerald-400" /> Financial Deep Dive</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {research.annual_revenue && (
              <div className="bg-zinc-900/60 rounded-lg p-4">
                <div className="text-xs text-zinc-400 mb-1">Annual Revenue</div>
                <div className="text-lg font-bold text-emerald-400">{research.annual_revenue}</div>
              </div>
            )}
            {research.rd_spend && (
              <div className="bg-zinc-900/60 rounded-lg p-4">
                <div className="text-xs text-zinc-400 mb-1">R&D Spend</div>
                <div className="text-lg font-bold text-teal-400">{research.rd_spend}</div>
              </div>
            )}
            {research.engineering_headcount && (
              <div className="bg-zinc-900/60 rounded-lg p-4">
                <div className="text-xs text-zinc-400 mb-1">Engineering Headcount</div>
                <div className="text-lg font-bold text-cyan-400">{research.engineering_headcount}</div>
              </div>
            )}
          </div>
          {research.financial_highlights && research.financial_highlights.length > 0 && (
            <div>
              <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Key Financial Highlights</div>
              <ul className="space-y-2">
                {research.financial_highlights.map((h: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-300">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Private Company Deep Dive */}
      {!research.is_public_company && (
        (research.engineering_blog_insights?.length > 0 || research.open_source_strategy || research.funding_stage) && (
          <div className="bg-gradient-to-br from-devin-blue/10 to-devin-purple/10 border border-devin-blue/30 rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><BookOpen size={16} className="text-blue-400" /> Engineering Deep Dive</h3>
            {research.funding_stage && (
              <div className="bg-zinc-900/60 rounded-lg p-4 mb-4">
                <div className="text-xs text-zinc-400 mb-1">Funding</div>
                <div className="text-sm font-medium text-blue-400">{research.funding_stage}</div>
              </div>
            )}
            {research.engineering_blog_insights && research.engineering_blog_insights.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Engineering Blog Insights</div>
                <ul className="space-y-2">
                  {research.engineering_blog_insights.map((insight: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-zinc-300">
                      <span className="text-blue-400 mt-0.5">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {research.open_source_strategy && (
              <div>
                <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Open Source Strategy</div>
                <p className="text-sm text-zinc-300 leading-relaxed">{research.open_source_strategy}</p>
              </div>
            )}
          </div>
        )
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Initiatives */}
        {research.key_initiatives.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-devin-green" /> Key Initiatives</h3>
            <ul className="space-y-2">
              {research.key_initiatives.map((init: string, i: number) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-300">
                  <span className="text-devin-green mt-0.5">•</span>
                  {init}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Strategic Priorities */}
        {research.strategic_priorities.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Zap size={16} className="text-devin-blue" /> Strategic Priorities</h3>
            <ul className="space-y-2">
              {research.strategic_priorities.map((p: string, i: number) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-300">
                  <span className="text-devin-blue mt-0.5">•</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Engineering Culture */}
        {research.engineering_culture && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Users size={16} className="text-cyan-400" /> Engineering Culture</h3>
            <p className="text-sm text-zinc-300 leading-relaxed">{research.engineering_culture}</p>
          </div>
        )}

        {/* Tech Stack */}
        {research.tech_stack.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="font-semibold mb-3">Tech Stack</h3>
            <div className="flex flex-wrap gap-2">
              {research.tech_stack.map((tech: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-zinc-800 text-zinc-300 text-sm rounded-lg">{tech}</span>
              ))}
            </div>
          </div>
        )}

        {/* Key People */}
        {research.key_people.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Users size={16} className="text-emerald-400" /> Key People</h3>
            <div className="space-y-3">
              {research.key_people.map((person: { name: string; title: string }, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-sm font-medium text-zinc-400">
                    {person.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{person.name}</div>
                    {person.title && <div className="text-xs text-zinc-500">{person.title}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent News */}
        {research.recent_news.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Clock size={16} className="text-amber-400" /> Recent News</h3>
            <ul className="space-y-2">
              {research.recent_news.map((news: string, i: number) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-300">
                  <span className="text-amber-400 mt-0.5">•</span>
                  {news}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function BusinessCaseTab({ result }: { result: AnalysisResult }) {
  const bc = result.business_case

  if (!bc) {
    return <div className="text-zinc-500 text-center py-12">Business case not yet generated</div>
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold mb-3">Executive Summary</h3>
        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line"
          dangerouslySetInnerHTML={{ __html: bc.executive_summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
      </div>

      {/* ROI */}
      <div className="bg-gradient-to-br from-devin-green/10 to-devin-blue/10 border border-devin-green/30 rounded-xl p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-devin-green" /> ROI Estimate</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-zinc-400 mb-1">Manual Cost</div>
            <div className="text-xl font-bold">${(bc.roi_estimate.manual_cost as number)?.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">With Devin</div>
            <div className="text-xl font-bold">${(bc.roi_estimate.devin_cost as number)?.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Annual Savings</div>
            <div className="text-xl font-bold text-devin-green">${(bc.roi_estimate.annual_savings as number)?.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Hours Recaptured</div>
            <div className="text-xl font-bold">{(bc.roi_estimate.hours_recaptured as number)?.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Build vs Buy */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold mb-4">Build vs. Buy Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left py-3 px-4 text-zinc-400 font-medium"></th>
                {Object.values(bc.build_vs_buy).map((opt) => (
                  <th key={opt.label} className="text-left py-3 px-4 text-zinc-300 font-medium">{opt.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['cost_per_pass', 'ramp_time', 'scaling', 'risk', 'coverage'].map(field => (
                <tr key={field} className="border-b border-zinc-800">
                  <td className="py-3 px-4 text-zinc-400 capitalize">{field.replace(/_/g, ' ')}</td>
                  {Object.values(bc.build_vs_buy).map((opt) => (
                    <td key={opt.label + field} className={`py-3 px-4 ${opt.label?.includes('Devin') ? 'text-devin-green font-medium' : 'text-zinc-300'}`}>
                      {opt[field]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Three-Tier Impact */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold mb-4">Three-Tier Impact Analysis</h3>
        <div className="grid gap-4">
          {Object.entries(bc.three_tier_impact).map(([key, tier]) => {
            const colors: Record<string, string> = {
              executive: 'border-l-devin-green bg-devin-green/5',
              engineering_manager: 'border-l-devin-purple bg-devin-purple/5',
              developer: 'border-l-devin-blue bg-devin-blue/5',
            }
            return (
              <div key={key} className={`border-l-4 rounded-r-lg p-4 ${colors[key] || 'border-l-zinc-500'}`}>
                <h4 className="font-medium mb-2">{tier.label}</h4>
                <ul className="space-y-1">
                  {tier.metrics.map((m, i) => (
                    <li key={i} className="text-sm text-zinc-300 flex gap-2">
                      <span className="text-zinc-500">•</span> {m}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AssetsTab({ result, copiedField, copyToClipboard }: { result: AnalysisResult; copiedField: string | null; copyToClipboard: (text: string, field: string) => void }) {
  const assets = result.gtm_assets

  if (!assets) {
    return <div className="text-zinc-500 text-center py-12">GTM assets not yet generated</div>
  }

  return (
    <div className="space-y-6">
      {/* Pre-meeting Email */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><FileText size={16} /> Pre-Meeting Email</h3>
          <button
            onClick={() => copyToClipboard(assets.pre_meeting_email, 'email')}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
          >
            {copiedField === 'email' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copiedField === 'email' ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed bg-zinc-800/50 p-4 rounded-lg">{assets.pre_meeting_email}</pre>
      </div>

      {/* Discovery Questions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold mb-4">Discovery Questions</h3>
        <div className="space-y-3">
          {assets.discovery_questions.map((q, i) => (
            <div key={i} className="flex gap-3 p-3 bg-zinc-800/50 rounded-lg">
              <span className="w-6 h-6 bg-devin-purple/30 text-devin-purple-light rounded-full flex items-center justify-center text-sm flex-shrink-0">{i + 1}</span>
              <span className="text-sm text-zinc-300">{q}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Executive Summary Doc */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><FileText size={16} /> Executive Summary Document</h3>
          <button
            onClick={() => copyToClipboard(assets.executive_summary_doc, 'exec')}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
          >
            {copiedField === 'exec' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copiedField === 'exec' ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed bg-zinc-800/50 p-4 rounded-lg max-h-96 overflow-y-auto">{assets.executive_summary_doc}</pre>
      </div>

      {/* Pitch Outline */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold mb-4">Pitch Deck Outline</h3>
        <div className="space-y-2">
          {assets.pitch_outline.map((slide) => (
            <div key={slide.slide} className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg">
              <span className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center text-sm font-medium text-zinc-400">{slide.slide}</span>
              <div>
                <div className="text-sm font-medium">{slide.title}</div>
                <div className="text-xs text-zinc-500">{slide.content}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
