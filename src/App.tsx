import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import {
  Search, Loader2, Building2, GitBranch, BarChart3, FileText,
  ChevronRight, ExternalLink, AlertCircle, Bug, TestTube,
  BookOpen, Zap, Shield, Users, Clock, DollarSign, TrendingUp,
  Copy, Check, ArrowLeft, Presentation, Microscope, ShieldAlert,
  Activity, Target, Briefcase, MessageSquare, Megaphone,
  AlertTriangle, Info, Tag, Download, ChevronDown,
  GitCompare, Link
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
  // Enhancement 1: Issue classification
  issue_classifications: Record<string, number>
  issue_deep_examples: Array<{number: number; title: string; body_snippet: string; classification: string; severity: string; comments: number; url: string; labels: string[]}>
  // Enhancement 2: Historical trends
  trend_data: {
    issues_opened_by_month: Array<{month: string; count: number}>
    issues_closed_by_month: Array<{month: string; count: number}>
    pr_merge_times: Array<{number: number; hours_to_merge: number; month: string}>
    avg_pr_merge_hours: number
    backlog_trend: string
  }
  // Enhancement 3: Security
  security_findings: Array<{type: string; severity: string; detail: string; files?: string[]}>
  dependency_health: {total_deps: number; outdated: number; has_lockfile: boolean}
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
  // Enhancement 4: Multi-source research
  job_postings_insights: string[]
  hackernews_sentiment: string
  conference_talks: string[]
  // Enhancement 5: Competitor analysis
  market_segment: string
  competitors: Array<{name: string; ai_adoption: string; relevance: string}>
  competitor_ai_adoption_summary: string
  // Enhancement 6: Firmographic enrichment
  estimated_headcount: string
  estimated_engineering_pct: string
  estimated_revenue_range: string
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
  const [view, setView] = useState<'home' | 'results' | 'compare'>('home')
  const [inputUrl, setInputUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('pending')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [pastAnalyses, setPastAnalyses] = useState<PastAnalysis[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  // Comparison mode state
  const [compareSelection, setCompareSelection] = useState<string[]>([])
  const [compareData, setCompareData] = useState<Record<string, unknown> | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)

  // URL hash routing for shareable links
  useEffect(() => {
    const hash = window.location.hash
    const match = hash.match(/^#\/results\/(.+)$/)
    if (match) {
      const jobId = match[1]
      loadResult(jobId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    window.location.hash = `#/results/${jobId}`
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

  const toggleCompareSelection = (jobId: string) => {
    setCompareSelection(prev => {
      if (prev.includes(jobId)) return prev.filter(id => id !== jobId)
      if (prev.length >= 2) return [prev[1], jobId]
      return [...prev, jobId]
    })
  }

  const startComparison = async () => {
    if (compareSelection.length !== 2) return
    setCompareLoading(true)
    try {
      const r = await fetch(`${API_URL}/api/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id_1: compareSelection[0], job_id_2: compareSelection[1] }),
      })
      const data = await r.json()
      setCompareData(data)
      setView('compare')
    } catch {
      // ignore
    } finally {
      setCompareLoading(false)
    }
  }

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  if (view === 'compare' && compareData) {
    return (
      <CompareView
        data={compareData}
        onBack={() => { setView('home'); setCompareData(null); setCompareSelection([]); }}
        onViewAnalysis={(jobId: string) => loadResult(jobId)}
      />
    )
  }

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
        onBack={() => { setView('home'); setCurrentJobId(null); setResult(null); window.location.hash = ''; }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-devin-green to-devin-blue rounded-lg flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-semibold text-lg">Devin GTM Engine</span>
          <span className="text-xs text-zinc-500 ml-1">by Cognition</span>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-24 pb-10 sm:pb-16">
        <div className="text-center space-y-4 sm:space-y-6">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Turn any company into a
            <span className="bg-gradient-to-r from-devin-green to-devin-blue bg-clip-text text-transparent"> Devin business case</span>
          </h1>
          <p className="text-zinc-400 text-base sm:text-xl max-w-2xl mx-auto">
            Enter a company URL or GitHub org. We'll analyze their repos, research their strategy, and generate a complete sales playbook.
          </p>

          {/* Input */}
          <div className="max-w-2xl mx-auto mt-6 sm:mt-10">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="stripe.com, github.com/vercel, or just 'shopify'"
                  className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-devin-green focus:ring-1 focus:ring-devin-green text-base sm:text-lg"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!inputUrl.trim()}
                className="px-8 py-3.5 sm:py-4 bg-devin-green hover:bg-devin-green-light disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl font-semibold text-base sm:text-lg transition-colors text-black"
              >
                Analyze
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Past Analyses */}
      {pastAnalyses.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Recent Analyses</h2>
            {pastAnalyses.filter(a => a.status === 'completed').length >= 2 && (
              <div className="flex items-center gap-3">
                {compareSelection.length === 2 && (
                  <button
                    onClick={startComparison}
                    disabled={compareLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-devin-purple to-devin-blue hover:from-devin-purple-light hover:to-devin-blue-light text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-devin-purple/20"
                  >
                    {compareLoading ? <Loader2 size={14} className="animate-spin" /> : <GitCompare size={14} />}
                    Compare Selected
                  </button>
                )}
                {compareSelection.length > 0 && (
                  <button
                    onClick={() => setCompareSelection([])}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Clear
                  </button>
                )}
                <span className="text-xs text-zinc-600">
                  {compareSelection.length === 0 ? 'Select 2 to compare' : `${compareSelection.length}/2 selected`}
                </span>
              </div>
            )}
          </div>
          <div className="grid gap-3">
            {pastAnalyses.map((a) => (
              <div key={a.job_id} className="flex items-center gap-2">
                {a.status === 'completed' && pastAnalyses.filter(x => x.status === 'completed').length >= 2 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleCompareSelection(a.job_id) }}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      compareSelection.includes(a.job_id)
                        ? 'bg-devin-purple border-devin-purple text-white'
                        : 'border-zinc-600 hover:border-zinc-400'
                    }`}
                  >
                    {compareSelection.includes(a.job_id) && <Check size={12} />}
                  </button>
                )}
                <button
                  onClick={() => loadResult(a.job_id)}
                  className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors text-left flex-1 min-w-0"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm sm:text-base">{a.company_name || a.input_url}</div>
                    <div className="text-xs sm:text-sm text-zinc-500">{a.repo_count} repos · {a.github_org}</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-sm text-zinc-500">
                    <span className={`inline-block w-2 h-2 rounded-full ${a.status === 'completed' ? 'bg-devin-green' : a.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    {new Date(a.created_at).toLocaleDateString()}
                  </div>
                  <ChevronRight size={16} className="text-zinc-600 flex-shrink-0" />
                </button>
              </div>
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
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0">
              <ArrowLeft size={18} />
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-devin-green to-devin-blue rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap size={16} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-base sm:text-lg truncate">{displayResult.company_name}</h1>
              <span className="text-xs sm:text-sm text-zinc-500 truncate block">github.com/{displayResult.github_org} · {displayResult.repos.length} repos</span>
            </div>
            {/* Desktop action buttons */}
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              {displayResult.status === 'completed' && (
                <>
                  <ShareButton jobId={displayResult.job_id} />
                  <PDFExportButton result={displayResult} />
                </>
              )}
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
          {/* Mobile action buttons — stacked below header */}
          <div className="flex sm:hidden items-center gap-2 mt-3 flex-wrap">
            {displayResult.status === 'completed' && (
              <>
                <ShareButton jobId={displayResult.job_id} />
                <PDFExportButton result={displayResult} />
              </>
            )}
            {displayResult.status === 'completed' && !isDeep && (
              <DeepResearchButton jobId={displayResult.job_id} onStarted={() => setDeepResearchPolling(true)} />
            )}
            {isDeepResearching && (
              <span className="flex items-center gap-2 px-3 py-1.5 bg-devin-blue/20 text-devin-blue text-xs rounded-full border border-devin-blue/30">
                <Loader2 size={14} className="animate-spin" /> Researching...
              </span>
            )}
            {displayResult.status === 'completed' && isDeep && (
              <GenerateDeckButton jobId={displayResult.job_id} />
            )}
            {displayResult.status === 'completed' && (
              <span className={`px-2.5 py-1 text-xs rounded-full border ${
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'border-devin-green text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <tab.icon size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.id === 'business_case' ? 'Biz Case' : tab.id === 'intel' ? 'Intel' : tab.id === 'assets' ? 'GTM' : tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
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
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const audiences = [
    { key: 'general', label: 'General Deck', desc: 'Balanced for all audiences' },
    { key: 'cto', label: 'CTO / Executive', desc: 'ROI, cost savings, strategic alignment' },
    { key: 'engineering_manager', label: 'Engineering Manager', desc: 'Velocity, coverage, team capacity' },
    { key: 'ic', label: 'Developer / IC', desc: 'DX, tooling, workflow automation' },
  ]

  const handleGenerate = async (audience: string) => {
    setShowDropdown(false)
    setDeckState('generating')
    try {
      const r = await fetch(`${API_URL}/api/generate-deck/${jobId}?audience=${audience}`)
      if (!r.ok) throw new Error('Deck generation failed')
      const htmlContent = await r.text()
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setDeckState('done')
      setTimeout(() => setDeckState('idle'), 5000)
    } catch {
      setDeckState('error')
      setTimeout(() => setDeckState('idle'), 3000)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
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
          <><Loader2 size={16} className="animate-spin" /> Generating...</>
        ) : deckState === 'done' ? (
          <><Check size={16} /> Deck Opened</>
        ) : deckState === 'error' ? (
          <><AlertCircle size={16} /> Failed — Retry</>
        ) : (
          <><Presentation size={16} /> Generate Deck <ChevronDown size={14} /></>
        )}
      </button>
      {showDropdown && deckState === 'idle' && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          {audiences.map((a) => (
            <button
              key={a.key}
              onClick={() => handleGenerate(a.key)}
              className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0"
            >
              <div className="text-sm font-medium text-white">{a.label}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{a.desc}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ShareButton({ jobId }: { jobId: string }) {
  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}#/results/${jobId}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
      title="Copy shareable link"
    >
      {copied ? <Check size={14} className="text-devin-green" /> : <Link size={14} />}
      <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
    </button>
  )
}

function PDFExportButton({ result }: { result: AnalysisResult }) {
  const [exporting, setExporting] = useState(false)

  const handleExport = () => {
    if (!result.business_case) return
    setExporting(true)

    const bc = result.business_case
    const cr = result.company_research
    const roi = bc.roi_estimate as Record<string, unknown>

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Devin Business Case — ${result.company_name}</title>
<style>
  @page { margin: 1in; size: A4; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; }
  h1 { font-size: 28px; border-bottom: 3px solid #3969CA; padding-bottom: 12px; margin-bottom: 8px; }
  h2 { font-size: 20px; color: #3969CA; margin-top: 32px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; }
  h3 { font-size: 16px; color: #555; margin-top: 20px; }
  .subtitle { color: #666; font-size: 14px; margin-bottom: 32px; }
  .brand { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }
  .brand-pill { background: #3969CA; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .metrics { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; margin: 20px 0; }
  .metric { background: #f8f9fa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; text-align: center; }
  .metric-value { font-size: 24px; font-weight: 700; color: #21C19A; }
  .metric-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .section { margin-bottom: 24px; }
  .tier { border-left: 4px solid #3969CA; padding: 16px; margin: 12px 0; background: #f8f9fa; border-radius: 0 8px 8px 0; }
  .tier.exec { border-color: #21C19A; }
  .tier.em { border-color: #3969CA; }
  .tier.dev { border-color: #0294DE; }
  .tier h4 { margin: 0 0 8px 0; font-size: 14px; }
  .tier ul { margin: 0; padding-left: 20px; }
  .tier li { font-size: 13px; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
  th { background: #f8f9fa; font-weight: 600; color: #555; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 2px solid #e5e5e5; font-size: 11px; color: #999; text-align: center; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="brand">
  <span class="brand-pill">Devin × ${result.company_name}</span>
  <span style="color: #999; font-size: 12px;">Business Case Report</span>
</div>
<h1>Engineering Efficiency Analysis</h1>
<p class="subtitle">${result.company_name} (github.com/${result.github_org}) · ${result.repos.length} repositories analyzed · Generated ${new Date().toLocaleDateString()}</p>

<h2>Executive Summary</h2>
<div class="section">${(bc.executive_summary || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div>

<h2>ROI Estimate</h2>
<div class="metrics">
  <div class="metric"><div class="metric-value">$${Number(roi.manual_cost || 0).toLocaleString()}</div><div class="metric-label">Manual Cost</div></div>
  <div class="metric"><div class="metric-value">$${Number(roi.devin_cost || 0).toLocaleString()}</div><div class="metric-label">With Devin</div></div>
  <div class="metric"><div class="metric-value" style="color: #21C19A;">$${Number(roi.annual_savings || 0).toLocaleString()}</div><div class="metric-label">Annual Savings</div></div>
  <div class="metric"><div class="metric-value">${Number(roi.hours_recaptured || 0).toLocaleString()}</div><div class="metric-label">Hours Recaptured</div></div>
</div>

<h2>Three-Tier Impact Analysis</h2>
${Object.entries(bc.three_tier_impact || {}).map(([key, tier]) => `
<div class="tier ${key === 'executive' ? 'exec' : key === 'engineering_manager' ? 'em' : 'dev'}">
  <h4>${(tier as {label: string}).label}</h4>
  <ul>${((tier as {metrics: string[]}).metrics || []).map(m => `<li>${m}</li>`).join('')}</ul>
</div>`).join('')}

<h2>Build vs. Buy Comparison</h2>
<table>
<thead><tr><th></th>${Object.values(bc.build_vs_buy || {}).map(opt => `<th>${(opt as {label: string}).label}</th>`).join('')}</tr></thead>
<tbody>${['cost_per_pass', 'ramp_time', 'scaling', 'risk', 'coverage'].map(field =>
  `<tr><td style="font-weight:600; color:#555;">${field.replace(/_/g, ' ')}</td>${Object.values(bc.build_vs_buy || {}).map(opt => `<td>${(opt as Record<string, string>)[field] || ''}</td>`).join('')}</tr>`
).join('')}</tbody>
</table>

${cr ? `<h2>Company Intelligence</h2>
<p>${cr.summary || ''}</p>
${cr.key_initiatives?.length ? `<h3>Key Initiatives</h3><ul>${cr.key_initiatives.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}
${cr.strategic_priorities?.length ? `<h3>Strategic Priorities</h3><ul>${cr.strategic_priorities.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}` : ''}

<div class="footer">
  Devin × ${result.company_name} · Business Case Report · Confidential · Generated by Devin GTM Engine
</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setExporting(false)
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting || !result.business_case}
      className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors disabled:opacity-50"
      title="Export business case as PDF"
    >
      {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      <span className="hidden sm:inline">PDF</span>
    </button>
  )
}

function CompareView({ data, onBack, onViewAnalysis }: {
  data: Record<string, unknown>
  onBack: () => void
  onViewAnalysis: (jobId: string) => void
}) {
  const c1 = data.company_1 as { job_id: string; company_name: string; github_org: string; research_depth: string; metrics: Record<string, unknown> }
  const c2 = data.company_2 as { job_id: string; company_name: string; github_org: string; research_depth: string; metrics: Record<string, unknown> }

  const metricRows = [
    { key: 'repos', label: 'Repositories', format: (v: unknown) => String(v) },
    { key: 'issues', label: 'Open Issues', format: (v: unknown) => Number(v).toLocaleString() },
    { key: 'stars', label: 'Stars', format: (v: unknown) => Number(v).toLocaleString() },
    { key: 'opportunities', label: 'Devin Opportunities', format: (v: unknown) => String(v) },
    { key: 'test_coverage_pct', label: 'Test Coverage', format: (v: unknown) => `${v}%` },
    { key: 'avg_pr_merge_hours', label: 'Avg PR Merge Time', format: (v: unknown) => `${v} hrs` },
    { key: 'security_findings', label: 'Security Findings', format: (v: unknown) => String(v) },
    { key: 'annual_savings', label: 'Annual Savings', format: (v: unknown) => `$${Number(v).toLocaleString()}` },
    { key: 'hours_recaptured', label: 'Hours Recaptured', format: (v: unknown) => Number(v).toLocaleString() },
  ]

  const getBetter = (key: string, v1: unknown, v2: unknown): 'c1' | 'c2' | 'tie' => {
    const n1 = Number(v1), n2 = Number(v2)
    if (n1 === n2) return 'tie'
    // Higher is better for these
    if (['repos', 'stars', 'opportunities', 'test_coverage_pct', 'annual_savings', 'hours_recaptured'].includes(key)) {
      return n1 > n2 ? 'c1' : 'c2'
    }
    // Lower is better for these
    if (['issues', 'avg_pr_merge_hours', 'security_findings'].includes(key)) {
      return n1 < n2 ? 'c1' : 'c2'
    }
    return 'tie'
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden">
      {/* Header */}
      <div className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0">
              <ArrowLeft size={18} />
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-devin-purple to-devin-blue rounded-lg flex items-center justify-center flex-shrink-0">
              <GitCompare size={16} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-semibold text-base sm:text-lg">Comparison Mode</h1>
              <span className="text-xs sm:text-sm text-zinc-500">{c1.company_name} vs {c2.company_name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-3 border-b border-zinc-800">
            <div className="p-4 text-sm font-medium text-zinc-500">Metric</div>
            <div className="p-4 text-center border-l border-zinc-800">
              <button onClick={() => onViewAnalysis(c1.job_id)} className="hover:text-devin-green transition-colors">
                <div className="font-semibold text-sm sm:text-base">{c1.company_name}</div>
                <div className="text-xs text-zinc-500">{c1.github_org} · {c1.research_depth}</div>
              </button>
            </div>
            <div className="p-4 text-center border-l border-zinc-800">
              <button onClick={() => onViewAnalysis(c2.job_id)} className="hover:text-devin-green transition-colors">
                <div className="font-semibold text-sm sm:text-base">{c2.company_name}</div>
                <div className="text-xs text-zinc-500">{c2.github_org} · {c2.research_depth}</div>
              </button>
            </div>
          </div>

          {/* Metric rows */}
          {metricRows.map(({ key, label, format }) => {
            const v1 = c1.metrics[key]
            const v2 = c2.metrics[key]
            const better = getBetter(key, v1, v2)
            return (
              <div key={key} className="grid grid-cols-3 border-b border-zinc-800 last:border-0">
                <div className="p-4 text-sm text-zinc-400">{label}</div>
                <div className={`p-4 text-center border-l border-zinc-800 text-sm font-medium ${better === 'c1' ? 'text-devin-green bg-devin-green/5' : 'text-zinc-300'}`}>
                  {format(v1)}
                  {better === 'c1' && <span className="ml-1 text-xs text-devin-green">★</span>}
                </div>
                <div className={`p-4 text-center border-l border-zinc-800 text-sm font-medium ${better === 'c2' ? 'text-devin-green bg-devin-green/5' : 'text-zinc-300'}`}>
                  {format(v2)}
                  {better === 'c2' && <span className="ml-1 text-xs text-devin-green">★</span>}
                </div>
              </div>
            )
          })}

          {/* Languages row */}
          <div className="grid grid-cols-3 border-b border-zinc-800">
            <div className="p-4 text-sm text-zinc-400">Languages</div>
            <div className="p-4 border-l border-zinc-800">
              <div className="flex flex-wrap gap-1 justify-center">
                {(c1.metrics.languages as string[] || []).map(l => (
                  <span key={l} className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">{l}</span>
                ))}
              </div>
            </div>
            <div className="p-4 border-l border-zinc-800">
              <div className="flex flex-wrap gap-1 justify-center">
                {(c2.metrics.languages as string[] || []).map(l => (
                  <span key={l} className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">{l}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => onViewAnalysis(c1.job_id)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
          >
            View {c1.company_name} Analysis →
          </button>
          <button
            onClick={() => onViewAnalysis(c2.job_id)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
          >
            View {c2.company_name} Analysis →
          </button>
        </div>
      </div>
    </div>
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

  // Aggregate enhancement data
  const allClassifications: Record<string, number> = {}
  const allSecurityFindings: Array<{type: string; severity: string; detail: string; repo: string}> = []
  const growingBacklogs: string[] = []

  result.repo_analyses.forEach(ra => {
    // Issue classifications
    if (ra.issue_classifications) {
      Object.entries(ra.issue_classifications).forEach(([k, v]) => {
        allClassifications[k] = (allClassifications[k] || 0) + v
      })
    }
    // Security findings
    if (ra.security_findings) {
      ra.security_findings.forEach(f => {
        allSecurityFindings.push({ ...f, repo: ra.repo.name })
      })
    }
    // Backlog trends
    if (ra.trend_data?.backlog_trend === 'growing') {
      growingBacklogs.push(ra.repo.name)
    }
  })

  const highSeverityFindings = allSecurityFindings.filter(f => f.severity === 'high' || f.severity === 'critical')

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={GitBranch} label="Repos Analyzed" value={result.repo_analyses.length.toString()} />
        <StatCard icon={AlertCircle} label="Open Issues" value={totalIssues.toLocaleString()} />
        <StatCard icon={Zap} label="Devin Opportunities" value={totalOpportunities.toString()} />
        <StatCard icon={DollarSign} label="Est. Annual Savings" value={savings ? `$${savings.toLocaleString()}` : 'N/A'} />
      </div>

      {/* Quick Facts + Issue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
          <h3 className="font-semibold mb-4">GitHub Footprint</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-400">Public Repos</span><span>{result.repos.length}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Total Stars</span><span>{totalStars.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Languages</span><span>{Array.from(languages).slice(0, 5).join(', ')}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Open Issues</span><span>{totalIssues.toLocaleString()}</span></div>
          </div>
        </div>

        {/* Issue Classification Breakdown */}
        {Object.keys(allClassifications).length > 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Tag size={16} className="text-devin-purple" /> Issue Breakdown</h3>
            <div className="space-y-2">
              {Object.entries(allClassifications).sort((a, b) => b[1] - a[1]).map(([classification, count]) => {
                const total = Object.values(allClassifications).reduce((s, v) => s + v, 0)
                const pct = total > 0 ? (count / total) * 100 : 0
                const colorMap: Record<string, string> = {
                  bug: 'bg-red-500', security: 'bg-orange-500', performance: 'bg-yellow-500',
                  tech_debt: 'bg-purple-500', feature_request: 'bg-blue-500',
                  documentation: 'bg-cyan-500', other: 'bg-zinc-500',
                }
                return (
                  <div key={classification} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 w-28 capitalize">{classification.replace(/_/g, ' ')}</span>
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colorMap[classification] || 'bg-zinc-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-zinc-400 w-10 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : result.company_research ? (
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
        ) : null}
      </div>

      {/* Security Overview + Backlog Health */}
      {(allSecurityFindings.length > 0 || growingBacklogs.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Security Overview */}
          {allSecurityFindings.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><ShieldAlert size={16} className="text-orange-400" /> Security Overview</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-400">{highSeverityFindings.length}</div>
                  <div className="text-xs text-zinc-500">High/Critical</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{allSecurityFindings.filter(f => f.severity === 'medium').length}</div>
                  <div className="text-xs text-zinc-500">Medium</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">{allSecurityFindings.filter(f => f.severity === 'low' || f.severity === 'info').length}</div>
                  <div className="text-xs text-zinc-500">Low/Info</div>
                </div>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allSecurityFindings.filter(f => f.severity !== 'info').slice(0, 6).map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <SeverityBadge severity={f.severity} />
                    <span className="text-zinc-300 flex-1">{f.detail}</span>
                    <span className="text-xs text-zinc-600">{f.repo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Backlog Health */}
          {growingBacklogs.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity size={16} className="text-amber-400" /> Backlog Health</h3>
              <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span className="text-sm font-medium text-amber-300">{growingBacklogs.length} repos with growing backlogs</span>
                </div>
                <p className="text-xs text-zinc-400">More issues opened than closed in the last 3 months</p>
              </div>
              <div className="space-y-2">
                {growingBacklogs.map((repo, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                    <span className="text-amber-400">•</span> {repo}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historical Trends — Mini Chart */}
      <TrendOverview analyses={result.repo_analyses} />

      {/* Top Opportunities */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
        <h3 className="font-semibold mb-4">Top Devin Opportunities</h3>
        <div className="grid gap-3">
          {result.repo_analyses.flatMap(ra =>
            ra.devin_opportunities.map(opp => ({ ...opp, repo: ra.repo.name, repoUrl: ra.repo.url }))
          ).slice(0, 8).map((opp, i) => (
            <div key={i} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-zinc-800/50 rounded-lg">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                opp.impact === 'high' || opp.impact === 'critical' ? 'bg-red-900/30 text-red-400' : 'bg-yellow-900/30 text-yellow-400'
              }`}>
                {opp.type === 'Bug Fixes' ? <Bug size={18} /> :
                 opp.type === 'Test Coverage' ? <TestTube size={18} /> :
                 opp.type === 'Documentation' ? <BookOpen size={18} /> :
                 opp.type === 'Security Fixes' ? <ShieldAlert size={18} /> :
                 opp.type === 'Tech Debt' ? <Activity size={18} /> :
                 opp.type === 'Growing Backlog' ? <TrendingUp size={18} /> :
                 <Zap size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                  <span className="font-medium text-sm sm:text-base">{opp.type}</span>
                  <span className="text-xs text-zinc-500">in {opp.repo}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    opp.impact === 'high' || opp.impact === 'critical' ? 'bg-red-900/30 text-red-400' : opp.impact === 'medium' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-blue-900/30 text-blue-400'
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

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string; icon: typeof AlertCircle }> = {
    critical: { bg: 'bg-red-900/40', text: 'text-red-400', icon: AlertCircle },
    high: { bg: 'bg-red-900/30', text: 'text-red-400', icon: AlertTriangle },
    medium: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', icon: AlertTriangle },
    low: { bg: 'bg-blue-900/30', text: 'text-blue-400', icon: Info },
    info: { bg: 'bg-zinc-800', text: 'text-zinc-400', icon: Info },
  }
  const c = config[severity] || config.info
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${c.bg} ${c.text}`}>
      <Icon size={10} /> {severity}
    </span>
  )
}

function TrendOverview({ analyses }: { analyses: RepoAnalysis[] }) {
  // Aggregate monthly data across all repos
  const monthlyOpened: Record<string, number> = {}
  const monthlyClosed: Record<string, number> = {}

  analyses.forEach(ra => {
    if (!ra.trend_data) return
    ra.trend_data.issues_opened_by_month?.forEach(d => {
      monthlyOpened[d.month] = (monthlyOpened[d.month] || 0) + d.count
    })
    ra.trend_data.issues_closed_by_month?.forEach(d => {
      monthlyClosed[d.month] = (monthlyClosed[d.month] || 0) + d.count
    })
  })

  const months = Array.from(new Set([...Object.keys(monthlyOpened), ...Object.keys(monthlyClosed)])).sort()
  if (months.length < 2) return null

  // Calculate avg PR merge time
  const allMergeTimes = analyses.flatMap(ra => ra.trend_data?.pr_merge_times || [])
  const avgMergeHours = allMergeTimes.length > 0
    ? Math.round(allMergeTimes.reduce((s, p) => s + p.hours_to_merge, 0) / allMergeTimes.length)
    : 0

  // Build SVG chart data
  const maxVal = Math.max(...months.map(m => Math.max(monthlyOpened[m] || 0, monthlyClosed[m] || 0)), 1)
  const chartW = 600
  const chartH = 120
  const padding = 30

  const openedPoints = months.map((m, i) => {
    const x = padding + (i / (months.length - 1)) * (chartW - padding * 2)
    const y = chartH - padding - ((monthlyOpened[m] || 0) / maxVal) * (chartH - padding * 2)
    return `${x},${y}`
  }).join(' ')

  const closedPoints = months.map((m, i) => {
    const x = padding + (i / (months.length - 1)) * (chartW - padding * 2)
    const y = chartH - padding - ((monthlyClosed[m] || 0) / maxVal) * (chartH - padding * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity size={16} className="text-devin-blue" /> Issue Velocity Trends</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-32">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(pct => {
              const y = chartH - padding - pct * (chartH - padding * 2)
              return <line key={pct} x1={padding} y1={y} x2={chartW - padding} y2={y} stroke="#27272a" strokeWidth="1" />
            })}
            {/* Opened line */}
            <polyline fill="none" stroke="#f97316" strokeWidth="2" points={openedPoints} />
            {/* Closed line */}
            <polyline fill="none" stroke="#21C19A" strokeWidth="2" points={closedPoints} />
            {/* Month labels */}
            {months.filter((_, i) => i % Math.max(1, Math.floor(months.length / 6)) === 0 || i === months.length - 1).map((m, i) => {
              const idx = months.indexOf(m)
              const x = padding + (idx / (months.length - 1)) * (chartW - padding * 2)
              return <text key={i} x={x} y={chartH - 5} textAnchor="middle" fill="#71717a" fontSize="10">{m.slice(5)}</text>
            })}
          </svg>
          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block rounded" /> Opened</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-devin-green inline-block rounded" /> Closed</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-xs text-zinc-400 mb-1">Avg PR Merge Time</div>
            <div className="text-xl font-bold">{avgMergeHours > 0 ? `${avgMergeHours}h` : 'N/A'}</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-xs text-zinc-400 mb-1">Months Tracked</div>
            <div className="text-xl font-bold">{months.length}</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-xs text-zinc-400 mb-1">Total PRs Analyzed</div>
            <div className="text-xl font-bold">{allMergeTimes.length}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof GitBranch; label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5">
      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
        <Icon size={16} className="text-zinc-500 sm:w-[18px] sm:h-[18px]" />
        <span className="text-xs sm:text-sm text-zinc-400">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-bold truncate">{value}</div>
    </div>
  )
}

function ReposTab({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-4">
      {result.repo_analyses.map((ra) => (
        <div key={ra.repo.full_name} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
          <div className="mb-4">
            <div className="flex items-start justify-between gap-2">
              <a href={ra.repo.url} target="_blank" rel="noopener noreferrer" className="text-base sm:text-lg font-semibold hover:text-devin-green flex items-center gap-2 min-w-0">
                <span className="truncate">{ra.repo.name}</span> <ExternalLink size={14} className="flex-shrink-0" />
              </a>
              {ra.trend_data?.backlog_trend && ra.trend_data.backlog_trend !== 'unknown' && (
                <span className={`px-2 py-0.5 text-xs rounded-full border flex-shrink-0 ${
                  ra.trend_data.backlog_trend === 'growing' ? 'bg-red-900/20 text-red-400 border-red-800' :
                  ra.trend_data.backlog_trend === 'shrinking' ? 'bg-green-900/20 text-green-400 border-green-800' :
                  'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  {ra.trend_data.backlog_trend === 'growing' ? '↑ Growing' : ra.trend_data.backlog_trend === 'shrinking' ? '↓ Shrinking' : '→ Stable'}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{ra.repo.description}</p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-xs sm:text-sm text-zinc-400">
              <span>&#9733; {ra.repo.stars.toLocaleString()}</span>
              <span>{ra.repo.open_issues} issues</span>
              {ra.repo.language && <span>{ra.repo.language}</span>}
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

          {/* Issue Classification + Opportunities row */}
          <div className="flex flex-wrap gap-4 mb-4">
            {/* Issue Classifications */}
            {ra.issue_classifications && Object.keys(ra.issue_classifications).length > 0 && (
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Issue Types</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(ra.issue_classifications).sort((a, b) => b[1] - a[1]).map(([cls, count]) => {
                    const colorMap: Record<string, string> = {
                      bug: 'bg-red-900/30 text-red-300 border-red-800',
                      security: 'bg-orange-900/30 text-orange-300 border-orange-800',
                      performance: 'bg-yellow-900/30 text-yellow-300 border-yellow-800',
                      tech_debt: 'bg-purple-900/30 text-purple-300 border-purple-800',
                      feature_request: 'bg-blue-900/30 text-blue-300 border-blue-800',
                      documentation: 'bg-cyan-900/30 text-cyan-300 border-cyan-800',
                      other: 'bg-zinc-800 text-zinc-400 border-zinc-700',
                    }
                    return (
                      <span key={cls} className={`px-2 py-1 text-xs rounded-md border ${colorMap[cls] || colorMap.other}`}>
                        {cls.replace(/_/g, ' ')} ({count})
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Opportunities */}
            {ra.devin_opportunities.length > 0 && (
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Devin Opportunities</div>
                <div className="flex flex-wrap gap-1.5">
                  {ra.devin_opportunities.map((opp, i) => (
                    <span key={i} className={`px-2 py-1 text-xs rounded-md border ${
                      opp.impact === 'high' || opp.impact === 'critical' ? 'bg-red-900/20 text-red-300 border-red-800' : 'bg-yellow-900/20 text-yellow-300 border-yellow-800'
                    }`}>
                      {opp.type} ({opp.count})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Security Findings */}
          {ra.security_findings && ra.security_findings.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ShieldAlert size={12} /> Security Findings
              </div>
              <div className="space-y-1.5">
                {ra.security_findings.filter(f => f.severity !== 'info').slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <SeverityBadge severity={f.severity} />
                    <span className="text-zinc-400">{f.detail}</span>
                  </div>
                ))}
                {ra.security_findings.filter(f => f.severity === 'info').length > 0 && (
                  <div className="text-xs text-zinc-600 mt-1">
                    + {ra.security_findings.filter(f => f.severity === 'info').length} informational findings
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deep Issue Examples */}
          {ra.issue_deep_examples && ra.issue_deep_examples.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Top Issues (Classified)</div>
              <div className="space-y-1">
                {ra.issue_deep_examples.slice(0, 5).map((issue) => (
                  <a key={issue.number} href={issue.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-zinc-300 hover:text-devin-green py-1">
                    <span className="text-zinc-600">#{issue.number}</span>
                    <span className="truncate flex-1">{issue.title}</span>
                    <span className={`px-1.5 py-0.5 text-xs rounded border ${
                      issue.classification === 'bug' ? 'bg-red-900/20 text-red-400 border-red-800' :
                      issue.classification === 'security' ? 'bg-orange-900/20 text-orange-400 border-orange-800' :
                      'bg-zinc-800 text-zinc-500 border-zinc-700'
                    }`}>{issue.classification.replace(/_/g, ' ')}</span>
                    {issue.severity && (
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        issue.severity === 'high' ? 'bg-red-900/20 text-red-400' : 'bg-zinc-800 text-zinc-500'
                      }`}>{issue.severity}</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Fallback: Top Issues (original) if no deep examples */}
          {(!ra.issue_deep_examples || ra.issue_deep_examples.length === 0) && ra.top_issues.length > 0 && (
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
        <div className="bg-gradient-to-r from-devin-blue/10 to-devin-purple/10 border border-devin-blue/30 rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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

      {/* Firmographic Enrichment — shown for all companies after deep research */}
      {isDeep && (research.estimated_headcount || research.estimated_engineering_pct || research.estimated_revenue_range) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Briefcase size={16} className="text-devin-purple" /> Firmographics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {research.estimated_headcount && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-xs text-zinc-400 mb-1">Total Headcount</div>
                <div className="text-lg font-bold text-devin-purple-light">{research.estimated_headcount}</div>
              </div>
            )}
            {research.estimated_engineering_pct && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-xs text-zinc-400 mb-1">Engineering %</div>
                <div className="text-lg font-bold text-devin-blue">{research.estimated_engineering_pct}</div>
              </div>
            )}
            {research.estimated_revenue_range && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-xs text-zinc-400 mb-1">Est. Revenue</div>
                <div className="text-lg font-bold text-devin-green">{research.estimated_revenue_range}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Competitor Analysis */}
      {isDeep && research.competitors && research.competitors.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><Target size={16} className="text-red-400" /> Competitive Landscape</h3>
          {research.market_segment && (
            <div className="mb-4">
              <span className="px-3 py-1 bg-zinc-800 text-zinc-300 text-sm rounded-full">{research.market_segment}</span>
            </div>
          )}
          <div className="grid gap-3 mb-4">
            {research.competitors.map((comp, i) => (
              <div key={i} className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{comp.name}</span>
                  {comp.ai_adoption && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-devin-purple/20 text-devin-purple-light border border-devin-purple/30">
                      {comp.ai_adoption.length > 50 ? comp.ai_adoption.slice(0, 50) + '...' : comp.ai_adoption}
                    </span>
                  )}
                </div>
                {comp.relevance && <p className="text-sm text-zinc-400">{comp.relevance}</p>}
              </div>
            ))}
          </div>
          {research.competitor_ai_adoption_summary && (
            <div className="bg-devin-purple/10 border border-devin-purple/20 rounded-lg p-4">
              <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">AI Adoption Summary</div>
              <p className="text-sm text-zinc-300 leading-relaxed">{research.competitor_ai_adoption_summary}</p>
            </div>
          )}
        </div>
      )}

      {/* Multi-Source Research */}
      {isDeep && (research.job_postings_insights?.length > 0 || research.hackernews_sentiment || research.conference_talks?.length > 0) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Megaphone size={16} className="text-amber-400" /> Multi-Source Intelligence</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Job Postings */}
            {research.job_postings_insights && research.job_postings_insights.length > 0 && (
              <div>
                <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Briefcase size={12} /> Job Posting Signals
                </div>
                <ul className="space-y-2">
                  {research.job_postings_insights.map((insight, i) => (
                    <li key={i} className="flex gap-2 text-sm text-zinc-300">
                      <span className="text-amber-400 mt-0.5">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* HackerNews Sentiment */}
            {research.hackernews_sentiment && (
              <div>
                <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <MessageSquare size={12} /> HackerNews Sentiment
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{research.hackernews_sentiment}</p>
              </div>
            )}

            {/* Conference Talks */}
            {research.conference_talks && research.conference_talks.length > 0 && (
              <div>
                <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Presentation size={12} /> Conference & Blog Activity
                </div>
                <ul className="space-y-2">
                  {research.conference_talks.map((talk, i) => (
                    <li key={i} className="flex gap-2 text-sm text-zinc-300">
                      <span className="text-cyan-400 mt-0.5">•</span>
                      {talk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
        <h3 className="font-semibold mb-3">Executive Summary</h3>
        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line"
          dangerouslySetInnerHTML={{ __html: bc.executive_summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
      </div>

      {/* ROI */}
      <div className="bg-gradient-to-br from-devin-green/10 to-devin-blue/10 border border-devin-green/30 rounded-xl p-4 sm:p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-devin-green" /> ROI Estimate</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2 text-sm sm:text-base"><FileText size={16} /> Pre-Meeting Email</h3>
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2 text-sm sm:text-base"><FileText size={16} /> Executive Summary Document</h3>
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6">
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
