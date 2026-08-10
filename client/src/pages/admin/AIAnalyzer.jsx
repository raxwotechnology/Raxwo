import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PieChart, Pie, Cell, Legend } from 'recharts'
import { FiZap, FiTrendingUp, FiTrendingDown, FiGlobe, FiInstagram, FiSearch, FiTarget, FiBarChart2, FiCheckCircle, FiXCircle, FiArrowLeft, FiDownload, FiFileText, FiSettings, FiSave, FiUserPlus, FiX, FiRefreshCw } from 'react-icons/fi'
import { formatMoney, chartMoneyTick } from '../../lib/currencies'
import {
  PLATFORM_API_FIELDS,
  loadSocialApiKeys,
  savePlatformCredentials,
  getPlatformCredentials,
  fetchPlatformData,
} from '../../lib/socialApiKeys'

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function apiErrorMessage(err, fallback = 'Request failed') {
  const status = err?.response?.status
  const msg = err?.response?.data?.message || err?.message || fallback
  if (status === 401) return 'Session expired — please log in again'
  if (status === 403) return 'You do not have permission to view this data'
  if (!err?.response) return 'Cannot reach API — verify backend URL (VITE_API_URL) and CORS settings'
  return msg
}

// Simulated marketing analyzer data (per platform)
const PLATFORM_CONFIG = {
  facebook: { base: 12000, label: 'Facebook', icon: '📘', audience: '25–44 business owners' },
  instagram: { base: 8500, label: 'Instagram', icon: '📷', audience: '18–34 visual-first users' },
  tiktok: { base: 45000, label: 'TikTok', icon: '🎵', audience: '16–28 Gen Z creators' },
  linkedin: { base: 6200, label: 'LinkedIn', icon: '💼', audience: 'B2B professionals & decision makers' },
  youtube: { base: 15800, label: 'YouTube', icon: '▶️', audience: 'Tutorial & product research viewers' },
}

// Fake generator removed, using real data below

const genWebsiteData = (url) => ({
  seoScore: Math.floor(Math.random() * 30 + 60),
  speedScore: Math.floor(Math.random() * 25 + 55),
  mobileScore: Math.floor(Math.random() * 20 + 65),
  securityScore: Math.floor(Math.random() * 15 + 80),
  accessibilityScore: Math.floor(Math.random() * 25 + 60),
  uiuxScore: Math.floor(Math.random() * 20 + 65),
  contentScore: Math.floor(Math.random() * 20 + 70),
  issues: ['Missing meta descriptions on 3 pages', 'Images lack alt text', 'Page speed could improve with compression', 'SSL certificate valid', 'Mobile viewport configured'],
  suggestions: ['Add structured data markup', 'Compress images with WebP format', 'Implement lazy loading', 'Add more internal links', 'Improve CTA button contrast'],
})

const TABS = [
  { id: 'business', label: '📊 Business AI', icon: FiBarChart2 },
  { id: 'website', label: '🌐 Website', icon: FiGlobe },
  { id: 'social', label: '📱 Social Media', icon: FiInstagram },
  { id: 'marketing', label: '📢 Marketing', icon: FiTarget },
  { id: 'suggestions', label: '🧠 AI Suggestions', icon: FiZap },
]

const ScoreGauge = ({ label, score, color }) => (
  <div className="flex flex-col items-center">
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-black text-primary">{score}</span>
      </div>
    </div>
    <p className="text-xs font-semibold text-slate-600 mt-1 text-center">{label}</p>
  </div>
)

const PIE_COLORS = ['#3B82F6','#EC4899','#111827','#0077B5','#EF4444']

const genInsights = (platform, d) => {
  const f = parseInt(d.followers || d.subscribers || 0)
  const l = parseInt(d.likes || 0)
  const v = parseInt(d.views || 0)
  const p = parseInt(d.posts || d.videos || 0)
  const engRate = f > 0 ? ((l / Math.max(f,1)) * 100).toFixed(2) : '0'
  const isVideo = platform === 'youtube' || platform === 'tiktok'
  const isLow = f < 1000
  const isMid = f >= 1000 && f < 10000

  const healthScore = Math.min(100, Math.round(
    (f > 500 ? 20 : 10) + (parseFloat(engRate) > 2 ? 25 : parseFloat(engRate) > 1 ? 15 : 5) +
    (p > 10 ? 20 : p > 5 ? 12 : 5) + (l > 100 ? 20 : l > 30 ? 12 : 5) +
    (v > 1000 ? 15 : v > 100 ? 8 : 0)
  ))

  const radarData = [
    { metric: 'Followers', value: Math.min(100, Math.round(f / 200)) },
    { metric: 'Engagement', value: Math.min(100, Math.round(parseFloat(engRate) * 20)) },
    { metric: 'Content', value: Math.min(100, p * 5) },
    { metric: 'Reach', value: Math.min(100, Math.round(f * 2.5 / 500)) },
    { metric: 'Growth', value: Math.min(100, Math.round((f > 500 ? 60 : 30) + parseFloat(engRate) * 5)) },
  ]

  const contentData = isVideo
    ? [{ type: 'Tutorials', score: 85 },{ type: 'Shorts', score: 92 },{ type: 'Promos', score: 60 },{ type: 'Behind Scenes', score: 78 }]
    : [{ type: 'Carousel', score: 88 },{ type: 'Reels', score: 94 },{ type: 'Single Image', score: 55 },{ type: 'Stories', score: 72 }]

  const doList = []
  const dontList = []
  if (isLow) {
    doList.push('Post consistently 4-5 times per week to build momentum','Collaborate with micro-influencers in your niche','Use trending hashtags and sounds to increase discoverability','Engage with comments within 1 hour of posting','Create shareable content like tips, tutorials and behind-the-scenes')
    dontList.push('Don\'t buy fake followers — it destroys engagement rate','Don\'t post without a clear CTA in every piece of content','Don\'t ignore analytics — track what content gets saves and shares','Don\'t copy competitors directly — find your unique angle','Don\'t neglect your bio and profile optimization')
  } else if (isMid) {
    doList.push('Double down on content types that get the most saves/shares','Start running targeted ads with $5-10/day budget','Build an email list from your social traffic','Create a content calendar with themed posting days','Leverage user-generated content and testimonials')
    dontList.push('Don\'t ghost your audience — maintain reply consistency','Don\'t spread too thin across platforms; focus on top 2-3','Don\'t ignore negative comments — address them professionally','Don\'t post just promotional content; follow 80/20 rule','Don\'t forget to cross-promote between platforms')
  } else {
    doList.push('Invest in professional video production for hero content','Launch branded hashtag campaigns to boost community','Partner with industry leaders for co-created content','Use A/B testing on posting times and content formats','Create exclusive content funnels for lead generation')
    dontList.push('Don\'t become complacent with posting frequency','Don\'t ignore emerging platform features (e.g. Threads, Channels)','Don\'t let engagement rate drop below 2% — diversify content','Don\'t neglect community management at scale','Don\'t skip competitor analysis — benchmark monthly')
  }

  const strategies = isVideo
    ? ['Batch-record 4-6 videos per session for consistency','Optimize thumbnails with high-contrast text overlays','Add end-screens and cards to boost watch time','Create series-based content to encourage subscription','Use keyword-rich titles and descriptions for SEO']
    : platform === 'linkedin'
    ? ['Publish thought-leadership articles twice weekly','Share employee advocacy content to expand organic reach','Post industry insights with data-backed arguments','Engage in relevant LinkedIn groups actively','Use LinkedIn newsletters to build subscriber base']
    : ['Increase Reels/short-form video content to 60% of posts','Use carousel posts for educational content that gets saved','Run Instagram Lives or Q&A sessions weekly','Optimize hashtag strategy: mix 5 broad + 10 niche + 5 branded','Create Instagram Guides to organize evergreen content']

  return { followers: f, likes: l, views: v, posts: p, engRate, healthScore, radarData, contentData, doList, dontList, strategies, isVideo }
}

export default function AdminAIAnalyzer() {
  const [activeTab, setActiveTab] = useState('business')
  const [lookback, setLookback] = useState(6)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [websiteResult, setWebsiteResult] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [socialPlatform, setSocialPlatform] = useState('instagram')
  const [socialData, setSocialData] = useState(null)
  const [socialAnalyzing, setSocialAnalyzing] = useState(false)
  const [mktgPlatform, setMktgPlatform] = useState(null)
  const [mktgData, setMktgData] = useState(null)
  const [mktgLoading, setMktgLoading] = useState(false)
  const [mktgTimeframe, setMktgTimeframe] = useState('30d')
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const dashboardRef = useRef(null)
  const [showApiSettings, setShowApiSettings] = useState(false)
  const [apiSettingsPlatform, setApiSettingsPlatform] = useState('facebook')
  const [platformApiForm, setPlatformApiForm] = useState({})
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignEmployeeId, setAssignEmployeeId] = useState('')
  const qc = useQueryClient()

  const { data: empData } = useQuery({
    queryKey: ['employees-assignable'],
    queryFn: () => api.get('/employees?limit=200&status=active').then(r => r.data),
  });

  const assignMut = useMutation({
    mutationFn: (body) => api.post('/platform-assignments', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['social-assignments'] }); toast.success('Employee assigned successfully!'); setShowAssignModal(false); setAssignEmployeeId(''); },
    onError: (e) => toast.error(e.response?.data?.message || 'Assignment failed'),
  });

  const employees = empData?.employees || [];

  const openApiSettings = (platform) => {
    setApiSettingsPlatform(platform)
    setPlatformApiForm(getPlatformCredentials(platform))
    setShowApiSettings(true)
  }

  const saveApiSettings = () => {
    savePlatformCredentials(apiSettingsPlatform, platformApiForm)
    setShowApiSettings(false)
    toast.success(`${PLATFORM_CONFIG[apiSettingsPlatform]?.label || apiSettingsPlatform} API keys saved`)
    if (activeTab === 'social') analyzeSocial(true)
    if (activeTab === 'marketing' && mktgPlatform) runMarketingAnalysis(mktgPlatform, true)
  }

  const exportPDF = async () => {
    if (!dashboardRef.current) return;
    setIsExportingPDF(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, { scale: 1.5, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = pdfHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }
      pdf.save(`AI_Analytics_${mktgPlatform}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('[AI Analyzer] PDF export failed:', error)
      toast.error('PDF export failed — try again')
    } finally {
      setIsExportingPDF(false);
    }
  };

  const exportExcel = () => {
    if (!mktgData) return;
    const wb = XLSX.utils.book_new();
    const kpiData = [
      ['Metric', 'Value'],
      ['Platform', mktgPlatform.toUpperCase()],
      ['Timeframe', mktgTimeframe],
      ['Followers', mktgData.followers],
      ['Engagement Rate (%)', mktgData.engRate],
      ['Likes', mktgData.likes],
      ['Posts', mktgData.posts],
      ['Health Score', mktgData.healthScore],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiData), "KPIs");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mktgData.radarData), "Radar Data");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mktgData.contentData), "Content Data");
    XLSX.writeFile(wb, `AI_Analytics_${mktgPlatform}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['ai-predictions', lookback],
    queryFn: () => api.get(`/system-metrics/ai-predict?months=${lookback}`).then(r => r.data),
    retry: 1,
  })

  const historical = data?.historical || {}
  const predictions = data?.predictions || {}
  const suggestions = data?.suggestions || []
  const nextMonth = months[new Date().getMonth() === 11 ? 0 : new Date().getMonth() + 1]

  const revChartData = [
    ...(historical.revenue || []).map(d => ({ label: d.label, actual: d.value })),
    { label: `${nextMonth} (Pred.)`, predicted: predictions.revenue?.nextValue || 0 },
  ]

  const analyzeWebsite = async () => {
    if (!websiteUrl || !websiteUrl.trim()) {
      return toast.error('Please enter a website URL (e.g. zage.lk or raxwo.net)');
    }
    setAnalyzing(true);
    try {
      const res = await api.post('/analytics/website-audit', { url: websiteUrl });
      if (res.data?.success && res.data?.audit) {
        setWebsiteResult(res.data.audit);
        toast.success(`Live SEO audit completed for ${res.data.domain || websiteUrl}!`);
      } else {
        toast.error('Could not parse audit response');
      }
    } catch (err) {
      console.error('[Website Audit Error]:', err);
      toast.error(apiErrorMessage(err, 'Website audit failed — please verify URL'));
    } finally {
      setAnalyzing(false);
    }
  };

  const runMarketingAnalysis = async (platformKey, force = false) => {
    setMktgPlatform(platformKey)
    setMktgLoading(true)
    if (force) setMktgData(null)
    try {
      const all = await fetchPlatformData(api, loadSocialApiKeys())
      const pd = all[platformKey] || {}
      const insights = genInsights(platformKey, pd)
      setMktgData({ ...insights, allPlatforms: all, status: pd.status })
      if (pd.status === 'error') {
        toast.error(`${PLATFORM_CONFIG[platformKey]?.label || platformKey}: not connected — click "Add API" to enter keys`)
      } else {
        toast.success(`${PLATFORM_CONFIG[platformKey]?.label || platformKey} data loaded`)
      }
    } catch (err) {
      console.error('[AI Analyzer] marketing analysis failed:', err)
      toast.error(apiErrorMessage(err, 'Failed to load platform data'))
      setMktgData({ error: true })
    } finally {
      setMktgLoading(false)
    }
  }

  const analyzeSocial = async (force = false) => {
    setSocialAnalyzing(true)
    if (force) setSocialData(null)
    try {
      const realData = await fetchPlatformData(api, loadSocialApiKeys())
      const platformData = realData[socialPlatform] || {}
      const cfg = PLATFORM_CONFIG[socialPlatform] || PLATFORM_CONFIG.instagram
      
      const isVideo = socialPlatform === 'youtube' || socialPlatform === 'tiktok'
      const followers = platformData.followers || platformData.subscribers || 0

      if (platformData.status === 'error') {
        toast.error(`${cfg.label}: not connected — click "Add API" to enter keys`)
      } else {
        toast.success(`${cfg.label} analytics loaded`)
      }
      setSocialData({
        platform: cfg.label,
        icon: cfg.icon,
        followers: followers,
        subscribers: isVideo ? followers : null,
        followersGrowth: '1.2', // Fallback
        engagementRate: '2.5', // Fallback
        reach: followers * 2,
        impressions: followers * 3,
        postsThisMonth: platformData.posts || platformData.videos || 0,
        videosThisMonth: isVideo ? (platformData.videos || 0) : 0,
        avgLikes: platformData.likes || 0,
        avgComments: 0,
        avgViews: platformData.views || 0,
        bestTime: '9:00 AM',
        audienceInsight: cfg.audience,
        topHashtags: ['#brand', '#trending'],
        seoTips: ['Optimize titles', 'Use high-quality images'],
        recommendations: ['Post more consistently', 'Engage with comments'],
        growthData: [
          { day: 'Mon', followers: followers - 50 },
          { day: 'Tue', followers: followers - 40 },
          { day: 'Wed', followers: followers - 30 },
          { day: 'Thu', followers: followers - 15 },
          { day: 'Fri', followers: followers - 5 },
          { day: 'Sat', followers: followers },
          { day: 'Sun', followers: followers + 10 },
        ]
      })
    } catch (err) {
      console.error('[AI Analyzer] social analysis failed:', err)
      toast.error(apiErrorMessage(err, 'Social analytics failed'))
    } finally {
      setSocialAnalyzing(false)
    }
  }

  const [suggestionsData, setSuggestionsData] = useState(null)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const loadAiSuggestions = async () => {
    if (suggestionsData) return
    setSuggestionsLoading(true)
    try {
      const all = await fetchPlatformData(api, loadSocialApiKeys())
      const fb = parseInt(all.facebook?.followers || 0)
      const ig = parseInt(all.instagram?.followers || 0)
      const tt = parseInt(all.tiktok?.followers || 0)
      const yt = parseInt(all.youtube?.subscribers || 0)
      const li = parseInt(all.linkedin?.followers || 0)
      const total = fb + ig + tt + yt + li
      const strongest = [['Facebook',fb],['Instagram',ig],['TikTok',tt],['YouTube',yt],['LinkedIn',li]].sort((a,b) => b[1]-a[1])
      const weakest = [...strongest].reverse()

      setSuggestionsData([
        { cat: 'Growth Priority', icon: '🚀', color: 'from-emerald-500 to-teal-500', items: [
          `Your strongest platform is ${strongest[0][0]} (${strongest[0][1].toLocaleString()} followers) — invest in paid promotion here first`,
          `${weakest[0][0]} needs the most attention (${weakest[0][1].toLocaleString()} followers) — create a 30-day growth sprint`,
          `Total audience across all platforms: ${total.toLocaleString()} — aim for 25% growth in 90 days`,
          `Cross-promote ${strongest[0][0]} content to ${weakest[0][0]} to bootstrap the weaker channel`,
        ]},
        { cat: 'Content Strategy', icon: '✍️', color: 'from-amber-500 to-orange-500', items: [
          'Create a weekly content calendar with themed days (e.g. Tip Tuesday, Behind-the-Scenes Friday)',
          `Repurpose ${strongest[0][0]} top content into ${weakest[1]?.[0] || 'other'} formats`,
          'Create 60% educational + 20% entertaining + 20% promotional content mix',
          'Batch-produce content weekly — aim for 3-5 posts per platform per week',
        ]},
        { cat: 'Engagement', icon: '💬', color: 'from-pink-500 to-rose-500', items: [
          'Reply to all comments within 2 hours to boost algorithmic ranking',
          'Run monthly Q&A sessions or AMAs on Instagram/TikTok',
          'Create polls and interactive stories to increase engagement rate',
          'Feature user-generated content to build community loyalty',
        ]},
        { cat: 'SEO & Discovery', icon: '🔍', color: 'from-blue-500 to-cyan-500', items: [
          'Optimize all social bios with primary keywords and clear CTAs',
          'Use 15-20 targeted hashtags per post (mix of broad and niche)',
          'Add keyword-rich captions and alt text on all visual content',
          'Create Pinterest and blog backlinks to your social profiles',
        ]},
        { cat: 'Paid Advertising', icon: '💰', color: 'from-purple-500 to-violet-500', items: [
          `Start with $10/day retargeting ads on ${strongest[0][0]}`,
          'Create lookalike audiences from your existing followers',
          'A/B test ad creatives — change one variable at a time',
          'Set up conversion tracking pixels on your website',
        ]},
      ])
    } catch (err) {
      console.error('[AI Analyzer] suggestions failed:', err)
      toast.error(apiErrorMessage(err, 'Failed to load AI suggestions'))
      setSuggestionsData([])
    }
    finally { setSuggestionsLoading(false) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Analyzer</h1>
          <p className="page-subtitle">AI-powered analytics, predictions, and marketing intelligence</p>
        </div>
        {activeTab === 'business' && (
          <div className="flex items-center gap-3">
            <select className="form-select text-sm" value={lookback} onChange={e => setLookback(Number(e.target.value))}>
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn-primary btn-sm gap-1 disabled:opacity-60"
            >
              <FiRefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              {isFetching ? 'Refreshing…' : 'Refresh Analysis'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1.5 overflow-x-auto flex-nowrap md:flex-wrap shadow-sm scrollbar-none">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); if (t.id === 'suggestions') loadAiSuggestions() }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${activeTab === t.id ? 'bg-gradient-to-r from-secondary to-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Business AI Tab */}
      {activeTab === 'business' && (
        isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"/>
            <p className="text-slate-500 text-sm font-medium">AI is analyzing your business data…</p>
          </div>
        ) : isError ? (
          <div className="card card-body text-center py-16">
            <FiXCircle className="mx-auto text-red-400 mb-3" size={40} />
            <h3 className="font-bold text-primary mb-2">Could not load business analytics</h3>
            <p className="text-sm text-slate-500 mb-4 max-w-md mx-auto">{apiErrorMessage(error)}</p>
            <button type="button" onClick={() => refetch()} className="btn-primary btn-sm gap-1"><FiZap size={14}/> Retry</button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'Revenue Prediction', val: formatMoney(predictions.revenue?.nextValue || 0), trend: predictions.revenue?.trend || 0, color: 'kpi-blue' },
                { label: 'Payroll Prediction', val: formatMoney(predictions.payroll?.nextValue || 0), trend: predictions.payroll?.trend || 0, color: 'kpi-green' },
                { label: 'New Projects', val: `${predictions.projects?.nextValue || 0} projects`, trend: predictions.projects?.trend || 0, color: 'kpi-purple' },
              ].map((c, i) => (
                <motion.div key={c.label} initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.1 }} className={`kpi-card ${c.color}`}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{c.label}</p>
                  <p className="text-xs text-purple-600 font-medium flex items-center gap-1 mb-1"><FiZap size={10}/> {nextMonth} Prediction</p>
                  <p className="text-2xl font-bold text-primary">{c.val}</p>
                  <div className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${c.trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {c.trend >= 0 ? <FiTrendingUp size={12}/> : <FiTrendingDown size={12}/>}
                    {Math.abs(c.trend).toFixed(1)}% trend
                  </div>
                </motion.div>
              ))}
            </div>
            {suggestions.length > 0 && (
              <div className="card card-body">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"><FiZap className="text-white" size={14}/></div>
                  <h3 className="font-bold text-primary">AI Insights & Recommendations</h3>
                </div>
                <div className="space-y-3">
                  {suggestions.map((s, i) => (
                    <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${s.type === 'positive' ? 'bg-green-50 border-green-200 text-green-800' : s.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                      <span className="text-xl shrink-0">{s.icon}</span>
                      <p className="text-sm font-medium">{s.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="card card-body">
              <h3 className="font-bold text-primary mb-1">Revenue Trend & Prediction</h3>
              <p className="text-xs text-slate-400 mb-4">Blue = actual · Purple dashed = AI prediction</p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revChartData}>
                  <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563EB" stopOpacity={0.15}/><stop offset="95%" stopColor="#2563EB" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:'#9CA3AF' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:10, fill:'#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={chartMoneyTick}/>
                  <Tooltip contentStyle={{ borderRadius:'10px', fontSize:'12px' }}/>
                  <Area type="monotone" dataKey="actual" name="Actual" stroke="#2563EB" strokeWidth={2.5} fill="url(#rg)" dot={{ fill:'#2563EB', r:3 }} connectNulls={false}/>
                  <Area type="monotone" dataKey="predicted" name="Predicted" stroke="#8B5CF6" strokeWidth={2.5} strokeDasharray="6 3" fill="none" dot={{ fill:'#8B5CF6', r:5 }} connectNulls={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      )}

      {/* Website Analyzer Tab */}
      {activeTab === 'website' && (
        <div className="space-y-5">
          <div className="card card-body">
            <h3 className="font-bold text-primary mb-3">🌐 Website Analyzer</h3>
            <div className="flex gap-3">
              <input className="form-input flex-1" placeholder="https://yourwebsite.com" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} />
              <button onClick={analyzeWebsite} disabled={!websiteUrl || analyzing} className="btn-primary gap-2 px-6">
                {analyzing ? <><span className="spinner"/> Scanning...</> : <><FiSearch size={14}/> Analyze</>}
              </button>
            </div>
          </div>

          {analyzing && (
            <div className="card card-body text-center py-12">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"/>
              <p className="font-semibold text-primary">Scanning website...</p>
              <p className="text-sm text-slate-400 mt-1">Checking SEO, performance, security & more</p>
            </div>
          )}

          {websiteResult && !analyzing && (
            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="space-y-5">
              {/* Overall Scores Gauge Grid */}
              <div className="card card-body">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4 pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-primary text-base flex items-center gap-2">
                      <FiGlobe className="text-secondary" /> Live Audit Summary — <span className="text-blue-600 font-mono">{websiteResult.domain || websiteUrl}</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Real-time HTTP audit &amp; SEO diagnostics</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${websiteResult.meta?.isHttps ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {websiteResult.meta?.isHttps ? '🔒 HTTPS Secured' : '⚠️ HTTP Unencrypted'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                      ⏱️ {websiteResult.responseTimeMs || 0}ms Response
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 justify-around">
                  <ScoreGauge label="SEO" score={websiteResult.seoScore} color="#3B82F6"/>
                  <ScoreGauge label="Speed" score={websiteResult.speedScore} color="#10B981"/>
                  <ScoreGauge label="Mobile" score={websiteResult.mobileScore} color="#8B5CF6"/>
                  <ScoreGauge label="Security" score={websiteResult.securityScore} color="#F59E0B"/>
                  <ScoreGauge label="Accessibility" score={websiteResult.accessibilityScore} color="#EC4899"/>
                  <ScoreGauge label="UI/UX" score={websiteResult.uiuxScore} color="#06B6D4"/>
                  <ScoreGauge label="Content" score={websiteResult.contentScore} color="#84CC16"/>
                </div>
              </div>

              {/* Scraped Website Metadata Details Breakdown */}
              {websiteResult.meta && (
                <div className="card card-body bg-slate-50/70 border border-slate-200/80">
                  <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                    <FiSearch className="text-blue-600" /> Scraped HTML Tags &amp; On-Page Diagnostics
                  </h4>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Page Title</p>
                      <p className="font-semibold text-slate-800 mt-1 truncate" title={websiteResult.meta.title}>
                        {websiteResult.meta.title || <span className="text-red-500 italic">Missing</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{websiteResult.meta.titleLength || 0} characters</p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Meta Description</p>
                      <p className="font-semibold text-slate-800 mt-1 truncate" title={websiteResult.meta.description}>
                        {websiteResult.meta.description || <span className="text-red-500 italic">Missing</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{websiteResult.meta.descriptionLength || 0} characters</p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Image Alt Text</p>
                      <p className="font-semibold text-slate-800 mt-1">
                        {websiteResult.meta.totalImages || 0} total images
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {websiteResult.meta.imagesWithoutAlt > 0 ? (
                          <span className="text-amber-600 font-bold">⚠️ {websiteResult.meta.imagesWithoutAlt} missing alt tag(s)</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">✅ All images have alt text</span>
                        )}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Heading Tags Hierarchy</p>
                      <p className="font-semibold text-slate-800 mt-1">
                        H1: {websiteResult.meta.h1Count} · H2: {websiteResult.meta.h2Count} · H3: {websiteResult.meta.h3Count}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {websiteResult.meta.hasViewport ? '📱 Mobile Viewport Set' : '❌ No Viewport Meta'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Issues & Suggestions Grid */}
              <div className="grid md:grid-cols-2 gap-5">
                <div className="card card-body">
                  <h4 className="font-bold text-primary mb-3 flex items-center gap-2">
                    <span className="p-1 bg-amber-100 text-amber-700 rounded-lg text-xs">⚠️</span> Real-Time Audit Issues ({websiteResult.issues?.length || 0})
                  </h4>
                  <ul className="space-y-2.5">
                    {(websiteResult.issues || []).map((iss, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs font-semibold text-slate-700 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60">
                        <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0"/>
                        <span>{iss}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card card-body">
                  <h4 className="font-bold text-primary mb-3 flex items-center gap-2">
                    <span className="p-1 bg-blue-100 text-blue-700 rounded-lg text-xs">💡</span> Tailored AI Suggestions ({websiteResult.suggestions?.length || 0})
                  </h4>
                  <ul className="space-y-2.5">
                    {(websiteResult.suggestions || []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs font-semibold text-slate-700 bg-blue-50/50 p-2.5 rounded-xl border border-blue-200/60">
                        <FiZap size={14} className="text-secondary shrink-0 mt-0.5"/>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Social Media Tab */}
      {activeTab === 'social' && (
        <div className="space-y-5">
          <div className="card card-body">
            <div className="flex items-center gap-4 flex-wrap">
              <h3 className="font-bold text-primary">Social Media Analytics</h3>
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                {['facebook','instagram','tiktok','linkedin','youtube'].map(p => (
                  <button key={p} onClick={() => setSocialPlatform(p)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${socialPlatform === p ? 'bg-white shadow text-secondary' : 'text-slate-500'}`}>
                    {PLATFORM_CONFIG[p]?.icon || '📱'} {p}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => openApiSettings(socialPlatform)} className="btn-outline btn-sm gap-1 text-slate-600">
                <FiSettings size={14}/> Add API
              </button>
              <button onClick={() => analyzeSocial(true)} disabled={socialAnalyzing} className="btn-primary btn-sm gap-1">
                {socialAnalyzing ? <span className="spinner"/> : <FiZap size={14}/>} {socialAnalyzing ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </div>

          {socialAnalyzing && (
            <div className="card card-body text-center py-12">
              <div className="w-16 h-16 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin mx-auto mb-4"/>
              <p className="font-semibold text-primary">Analyzing {socialPlatform}...</p>
            </div>
          )}

          {socialData && !socialAnalyzing && (
            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="space-y-5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: socialData.subscribers ? 'Subscribers' : 'Followers', val: (socialData.subscribers || socialData.followers).toLocaleString(), sub: `+${socialData.followersGrowth}% growth`, color: 'kpi-blue' },
                  { label: 'Engagement Rate', val: `${socialData.engagementRate}%`, sub: 'avg per post/video', color: 'kpi-green' },
                  { label: 'Monthly Reach', val: socialData.reach.toLocaleString(), sub: `${socialData.impressions.toLocaleString()} impressions`, color: 'kpi-purple' },
                  { label: socialData.avgViews ? 'Avg Views' : 'Avg Likes', val: (socialData.avgViews || socialData.avgLikes).toLocaleString(), sub: `Best time: ${socialData.bestTime}`, color: 'kpi-orange' },
                ].map(c => (
                  <div key={c.label} className={`kpi-card ${c.color}`}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
                    <p className="text-2xl font-bold text-primary mt-1">{c.val}</p>
                    <p className="text-xs text-slate-400 mt-1">{c.sub}</p>
                  </div>
                ))}
              </div>
              <div className="card card-body">
                <h3 className="font-bold text-primary mb-4">Weekly Followers Growth</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={socialData.growthData}>
                    <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/><stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="day" tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{ borderRadius:'10px', fontSize:'12px' }}/>
                    <Area type="monotone" dataKey="followers" name="Followers" stroke="#8B5CF6" strokeWidth={2.5} fill="url(#sg)"/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="card card-body">
                <h4 className="font-bold text-primary mb-3">👥 Audience & recommendations</h4>
                <p className="text-sm text-slate-600 mb-3">{socialData.audienceInsight}</p>
                <ul className="space-y-1.5 mb-4">
                  {(socialData.recommendations || []).map((r, i) => (
                    <li key={i} className="text-sm text-slate-600 flex gap-2"><FiZap size={14} className="text-secondary shrink-0"/>{r}</li>
                  ))}
                </ul>
                <h4 className="font-bold text-primary mb-2">🏷️ Top hashtags / SEO</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  {socialData.topHashtags.map((h, i) => (
                    <span key={i} className="px-3 py-1.5 bg-gradient-to-r from-secondary/10 to-blue-100 text-secondary text-sm font-semibold rounded-full border border-secondary/20">{h}</span>
                  ))}
                </div>
                <ul className="space-y-1">
                  {(socialData.seoTips || []).map((t, i) => (
                    <li key={i} className="text-xs text-slate-500">• {t}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Marketing Tab */}
      {activeTab === 'marketing' && (
        <div className="space-y-5">
          <AnimatePresence mode="wait">
          {!mktgPlatform ? (
            <motion.div key="cards" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key:'facebook', title:'Facebook Analysis', icon:'📘', desc:'Page performance, audience demographics & reach insights', color:'from-blue-600 to-blue-700' },
                { key:'instagram', title:'Instagram Analysis', icon:'📷', desc:'Profile analytics, engagement metrics & content performance', color:'from-pink-500 to-rose-600' },
                { key:'tiktok', title:'TikTok Analysis', icon:'🎵', desc:'Video performance, follower growth & viral potential', color:'from-slate-800 to-slate-900' },
                { key:'linkedin', title:'LinkedIn Analysis', icon:'💼', desc:'B2B audience insights, professional engagement & growth', color:'from-blue-700 to-blue-900' },
                { key:'youtube', title:'YouTube Analysis', icon:'▶️', desc:'Subscriber analytics, watch metrics & channel growth', color:'from-red-600 to-red-800' },
              ].map((item, i) => (
                <motion.div key={i} initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} transition={{delay:i*0.08}}
                  className="group card border border-slate-200 overflow-hidden hover:shadow-xl transition-all cursor-pointer"
                  onClick={() => runMarketingAnalysis(item.key)}>
                  <div className={`h-2 bg-gradient-to-r ${item.color}`}/>
                  <div className="p-5">
                    <div className="text-3xl mb-3">{item.icon}</div>
                    <h3 className="font-bold text-primary mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-500 mb-4">{item.desc}</p>
                    <button className="btn-outline btn-sm text-xs gap-1 group-hover:bg-secondary group-hover:text-white group-hover:border-secondary transition-colors">
                      <FiZap size={11}/> Run Analysis
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div key="detail" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="space-y-5 relative">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 w-full">
                <button onClick={() => { setMktgPlatform(null); setMktgData(null) }} className="btn-outline btn-sm gap-1 shrink-0"><FiArrowLeft size={14}/> Back to Platforms</button>
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
                  <button onClick={() => setShowAssignModal(true)} className="btn-outline btn-sm gap-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50 flex-1 sm:flex-none justify-center">
                    <FiUserPlus size={14}/> Assign
                  </button>
                  {(mktgPlatform === 'facebook' || mktgPlatform === 'instagram' || mktgPlatform === 'youtube' || mktgPlatform === 'tiktok' || mktgPlatform === 'linkedin') && (
                    <button type="button" onClick={() => openApiSettings(mktgPlatform)} className="btn-outline btn-sm gap-1 text-slate-600 flex-1 sm:flex-none justify-center">
                      <FiSettings size={14}/> Add API
                    </button>
                  )}
                  <select 
                    value={mktgTimeframe} 
                    onChange={e => { setMktgTimeframe(e.target.value); runMarketingAnalysis(mktgPlatform); }}
                    className="form-select bg-white border-slate-200 text-sm font-medium py-1.5 px-3 rounded-lg w-full sm:w-32 flex-1 sm:flex-none"
                  >
                    <option value="today">Today</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                    <option value="ytd">Year to Date</option>
                  </select>
                  <button onClick={exportExcel} className="btn-outline btn-sm gap-1 text-green-700 border-green-200 hover:bg-green-50 flex-1 sm:flex-none justify-center">
                    <FiDownload size={14} /> Excel
                  </button>
                  <button onClick={exportPDF} disabled={isExportingPDF} className="btn-outline btn-sm gap-1 text-red-600 border-red-200 hover:bg-red-50 flex-1 sm:flex-none justify-center">
                    {isExportingPDF ? <span className="spinner w-3 h-3" /> : <FiFileText size={14} />} PDF
                  </button>
                </div>
              </div>

              {mktgLoading && (
                <div className="card card-body text-center py-16">
                  <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"/>
                  <p className="font-semibold text-primary">Analyzing {mktgPlatform}...</p>
                  <p className="text-xs text-slate-400 mt-1">Fetching live data from API</p>
                </div>
              )}

              {mktgData && !mktgLoading && !mktgData.error && (
                <div ref={dashboardRef} className="space-y-5 bg-[#f8fafc] p-2 -mx-2 rounded-xl">
                  {/* KPIs */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {[
                      { label:'Followers', val:mktgData.followers.toLocaleString(), icon:'👥', bg:'kpi-blue' },
                      { label:'Engagement Rate', val:`${mktgData.engRate}%`, icon:'💬', bg:'kpi-green' },
                      { label:mktgData.isVideo?'Total Views':'Total Likes', val:(mktgData.isVideo?mktgData.views:mktgData.likes).toLocaleString(), icon:mktgData.isVideo?'👁️':'❤️', bg:'kpi-purple' },
                      { label:'Content Count', val:mktgData.posts.toLocaleString(), icon:'📝', bg:'kpi-orange' },
                      { label:'Health Score', val:`${mktgData.healthScore}/100`, icon: mktgData.healthScore>=70?'🟢':mktgData.healthScore>=40?'🟡':'🔴', bg:'kpi-blue' },
                    ].map((c,i) => (
                      <motion.div key={c.label} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}} className={`kpi-card ${c.bg}`}>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
                        <p className="text-2xl font-bold text-primary mt-1">{c.icon} {c.val}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Charts Row */}
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="card card-body">
                      <h4 className="font-bold text-primary mb-4">📊 Performance Radar</h4>
                      <ResponsiveContainer width="100%" height={260}>
                        <RadarChart data={mktgData.radarData}>
                          <PolarGrid stroke="#e2e8f0"/>
                          <PolarAngleAxis dataKey="metric" tick={{fontSize:11,fill:'#64748b'}}/>
                          <Radar name="Score" dataKey="value" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.25} strokeWidth={2}/>
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="card card-body">
                      <h4 className="font-bold text-primary mb-4">🎯 Content Type Performance</h4>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={mktgData.contentData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                          <XAxis dataKey="type" tick={{fontSize:10,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                          <YAxis tick={{fontSize:10,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                          <Tooltip contentStyle={{borderRadius:'10px',fontSize:'12px'}}/>
                          <Bar dataKey="score" name="Effectiveness" radius={[8,8,0,0]} fill="url(#barGrad)"/>
                          <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Cross-platform comparison */}
                  {mktgData.allPlatforms && (
                    <div className="card card-body">
                      <h4 className="font-bold text-primary mb-4">📈 Cross-Platform Audience Comparison</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={[
                          {name:'Facebook',followers:parseInt(mktgData.allPlatforms.facebook?.followers||0)},
                          {name:'Instagram',followers:parseInt(mktgData.allPlatforms.instagram?.followers||0)},
                          {name:'TikTok',followers:parseInt(mktgData.allPlatforms.tiktok?.followers||0)},
                          {name:'LinkedIn',followers:parseInt(mktgData.allPlatforms.linkedin?.followers||0)},
                          {name:'YouTube',followers:parseInt(mktgData.allPlatforms.youtube?.subscribers||0)},
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                          <XAxis dataKey="name" tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
                          <YAxis tick={{fontSize:10,fill:'#9CA3AF'}} axisLine={false} tickLine={false}/>
                          <Tooltip contentStyle={{borderRadius:'10px',fontSize:'12px'}}/>
                          <Bar dataKey="followers" name="Followers" radius={[8,8,0,0]}>
                            {PIE_COLORS.map((c,i)=><Cell key={i} fill={c}/>)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* DO and DON'T */}
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="card card-body border-l-4 border-l-emerald-500">
                      <h4 className="font-bold text-emerald-700 mb-3 flex items-center gap-2"><FiCheckCircle size={18}/> ✅ What You SHOULD Do</h4>
                      <ul className="space-y-2.5">
                        {mktgData.doList.map((item,i) => (
                          <motion.li key={i} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.08}}
                            className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i+1}</span>
                            {item}
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                    <div className="card card-body border-l-4 border-l-red-500">
                      <h4 className="font-bold text-red-700 mb-3 flex items-center gap-2"><FiXCircle size={18}/> ❌ What You Should NOT Do</h4>
                      <ul className="space-y-2.5">
                        {mktgData.dontList.map((item,i) => (
                          <motion.li key={i} initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} transition={{delay:i*0.08}}
                            className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i+1}</span>
                            {item}
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Growth Strategies */}
                  <div className="card card-body bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border border-blue-100">
                    <h4 className="font-bold text-primary mb-4 flex items-center gap-2">🚀 Growth Strategies for {PLATFORM_CONFIG[mktgPlatform]?.label}</h4>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {mktgData.strategies.map((s,i) => (
                        <motion.div key={i} initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} transition={{delay:i*0.1}}
                          className="flex items-start gap-2 p-3 bg-white/80 backdrop-blur rounded-xl border border-white shadow-sm">
                          <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-secondary to-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">{i+1}</span>
                          <p className="text-sm text-slate-700">{s}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {mktgData?.error && (
                <div className="card card-body text-center py-12">
                  <p className="text-red-500 font-semibold">Failed to fetch data. Please check API credentials.</p>
                </div>
              )}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      )}

      {/* AI Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          <div className="card card-body bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"><FiZap className="text-white" size={18}/></div>
              <div>
                <h3 className="font-bold text-primary">AI-Powered Recommendations</h3>
                <p className="text-xs text-slate-500">Based on your real social media data and performance insights</p>
              </div>
            </div>
          </div>
          {suggestionsLoading && (
            <div className="card card-body text-center py-16">
              <div className="w-14 h-14 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"/>
              <p className="text-slate-500 text-sm font-medium">Generating personalized recommendations from your data…</p>
            </div>
          )}
          {suggestionsData && suggestionsData.map((cat, ci) => (
            <motion.div key={ci} initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay: ci*0.1 }}
              className="card card-body">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-lg`}>{cat.icon}</div>
                <h3 className="font-bold text-primary">{cat.cat} Recommendations</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {cat.items.map((item, ii) => (
                  <motion.div key={ii} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:ci*0.1+ii*0.05}}
                    className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="w-5 h-5 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{ii+1}</span>
                    <p className="text-sm text-slate-700">{item}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
          {!suggestionsLoading && !suggestionsData && (
            <div className="card card-body text-center py-12">
              <p className="text-slate-400 text-sm">Click the tab to load personalized recommendations</p>
            </div>
          )}
        </div>
      )}

      {/* Assignment Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FiUserPlus className="text-indigo-500"/> Assign to {PLATFORM_CONFIG[mktgPlatform]?.label}</h3>
                <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><FiX /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-500 mb-2">Select an employee to give them access to these analyzed insights in their Social Analytics dashboard.</p>
                <div>
                  <label className="form-label">Employee</label>
                  <select value={assignEmployeeId} onChange={e => setAssignEmployeeId(e.target.value)} className="form-select">
                    <option value="">-- Select employee --</option>
                    {employees.map(e => <option key={e._id} value={e._id}>{e.userId?.name} ({e.designation})</option>)}
                  </select>
                </div>
                <button
                  disabled={!assignEmployeeId || assignMut.isPending}
                  onClick={() => assignMut.mutate({ platform: mktgPlatform, employeeId: assignEmployeeId })}
                  className="btn-primary w-full justify-center mt-2"
                >
                  {assignMut.isPending ? <span className="spinner" /> : 'Assign Employee'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showApiSettings && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2"><FiSettings/> Add API — {PLATFORM_CONFIG[apiSettingsPlatform]?.label || apiSettingsPlatform}</h3>
            <p className="text-sm text-slate-500 mb-4">Keys are saved in your browser and sent securely to the backend when fetching data. Works on localhost and Hostinger without server env vars.</p>
            <div className="space-y-4">
              {(PLATFORM_API_FIELDS[apiSettingsPlatform] || []).map((field) => (
                <div key={field.key}>
                  <label className="text-sm font-semibold text-slate-600 mb-1 block">{field.label}</label>
                  <input
                    type="text"
                    className="form-input w-full"
                    placeholder={field.placeholder}
                    value={platformApiForm[field.key] || ''}
                    onChange={(e) => setPlatformApiForm((s) => ({ ...s, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowApiSettings(false)} className="btn-outline">Cancel</button>
              <button type="button" onClick={saveApiSettings} className="btn-primary"><FiSave size={14}/> Save & Fetch</button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
