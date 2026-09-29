import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import { FiBriefcase, FiMapPin, FiClock, FiArrowRight, FiSearch } from 'react-icons/fi'
import { useState } from 'react'
import SEO from '../../components/common/SEO'

export default function Careers() {
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['public-jobs'],
    queryFn: () => api.get('/recruitment/jobs?status=open').then(r => r.data),
  })

  const jobs = (data?.jobs || []).filter(j => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) || j.department.toLowerCase().includes(search.toLowerCase())
    const matchDept = !dept || j.department === dept
    return matchSearch && matchDept
  })

  const departments = [...new Set((data?.jobs || []).map(j => j.department))]

  return (
    <div>
      <SEO
        title="Careers & Job Openings in Sri Lanka | Raxwo Technology"
        description="Join Raxwo Technology's engineering and leadership team. Explore open software engineering, QA, DevOps, and design roles in Sri Lanka with competitive salaries and remote flexibility."
        keywords="Careers Raxwo, Software Engineer Jobs Sri Lanka, IT Jobs Colombo, React Developer Vacancies, Remote Developer Jobs Sri Lanka"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Open Job Vacancies at Raxwo Technology',
          itemListElement: jobs.map((j, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: j.title,
            description: `${j.department} · ${j.type} · ${j.location}`,
            url: `https://manage.raxwo.net/careers/${j._id}`
          }))
        }}
      />
      {/* Hero */}
      <section className="bg-gradient-hero section-padding pt-32 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 right-20 w-64 h-64 bg-secondary/15 rounded-full blur-3xl" />
        </div>
        <div className="container-max relative">
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95, filter: 'blur(10px)' }} 
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} 
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            className="text-center mb-12 flex flex-col items-center"
          >
            <motion.span 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="badge bg-white/10 text-white border border-white/20 mb-6 shadow-xl px-4 py-2"
            >
              We're Hiring
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-2xl lg:text-4xl font-bold text-white font-heading mb-6 tracking-tight drop-shadow-2xl"
            >
              Join Our <span className="text-[#20b2f5]">Team</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-white/80 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed font-normal"
            >
              Build your career at Raxwo. Work on exciting projects with brilliant minds in a collaborative, growth-focused environment.
            </motion.p>
          </motion.div>

          {/* Why Raxwo */}
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: '🚀', title: 'Exciting Projects', desc: 'Work on cutting-edge systems for diverse industries' },
              { icon: '📈', title: 'Career Growth', desc: 'Clear advancement paths with mentorship and training' },
              { icon: '💰', title: 'Competitive Pay', desc: 'Market-leading salaries with EPF/ETF and bonuses' },
            ].map((p, i) => (
              <motion.div 
                key={p.title} 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + (i * 0.1), type: 'spring' }}
                className="glass-card p-6 text-center hover:scale-105 transition-transform duration-300"
              >
                <div className="text-4xl mb-4">{p.icon}</div>
                <h3 className="font-semibold text-white font-heading mb-2 text-lg">{p.title}</h3>
                <p className="text-white/70 text-sm leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Jobs */}
      <section className="section-padding bg-gray-50">
        <div className="container-max">
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search positions..." className="form-input !pl-10" />
            </div>
            <select value={dept} onChange={e => setDept(e.target.value)} className="form-select md:w-48">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-20">
              <FiBriefcase size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-500">No positions found</h3>
              <p className="text-gray-400 mt-2">Try adjusting your search or check back soon.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job, i) => (
                <motion.div
                  key={job._id}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ delay: i * 0.1, type: 'spring', stiffness: 100 }}
                  className="card card-body card-hover flex flex-col md:flex-row md:items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <FiBriefcase className="text-secondary" size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-primary font-heading text-lg">{job.title}</h3>
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-gray-500"><FiBriefcase size={12} /> {job.department}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-500"><FiMapPin size={12} /> {job.location}</span>
                      <span className="flex items-center gap-1 text-xs text-gray-500"><FiClock size={12} /> {job.type}</span>
                      {job.salaryRange?.min && (
                        <span className="text-xs text-accent font-medium">
                          LKR {job.salaryRange.min.toLocaleString()} – {job.salaryRange.max?.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/careers/${job._id}`} className="btn-ghost btn-sm">View Details</Link>
                    <Link to={`/careers/${job._id}/apply`} className="btn-primary btn-sm">Apply Now <FiArrowRight size={13} /></Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
