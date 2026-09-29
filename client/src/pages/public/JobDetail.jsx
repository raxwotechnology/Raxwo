import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import { FiBriefcase, FiMapPin, FiClock, FiArrowRight, FiArrowLeft, FiCheck, FiCalendar } from 'react-icons/fi'
import SEO from '../../components/common/SEO'

export default function JobDetail() {
  const { id } = useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get(`/recruitment/jobs/${id}`).then(r => r.data),
  })
  const job = data?.job

  if (isLoading) return (
    <div className="min-h-screen pt-32 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" />
    </div>
  )

  if (!job) return (
    <div className="min-h-screen pt-32 text-center">
      <h2 className="text-2xl font-bold text-primary">Job not found</h2>
      <Link to="/careers" className="btn-primary mt-6">Back to Careers</Link>
    </div>
  )

  return (
    <div>
      <SEO
        title={`${job.title} (${job.department}) — Careers at Raxwo Technology`}
        description={`Apply for ${job.title} position in ${job.department} at Raxwo Technology. Location: ${job.location}. Employment: ${job.type}. Apply online now.`}
        keywords={`${job.title}, ${job.department} Jobs, IT Jobs Sri Lanka, Raxwo Careers, ${job.skills?.join(', ') || ''}`}
        schema={{
          '@context': 'https://schema.org',
          '@type': 'JobPosting',
          title: job.title,
          description: job.description,
          datePosted: job.createdAt || new Date().toISOString(),
          validThrough: job.deadline ? new Date(job.deadline).toISOString() : undefined,
          employmentType: job.type === 'full-time' ? 'FULL_TIME' : job.type === 'part-time' ? 'PART_TIME' : job.type === 'contract' ? 'CONTRACTOR' : 'INTERN',
          hiringOrganization: {
            '@type': 'Organization',
            name: 'Raxwo Technology',
            sameAs: 'https://manage.raxwo.net'
          },
          jobLocation: {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              addressCountry: 'LK',
              addressLocality: job.location || 'Colombo'
            }
          },
          baseSalary: job.salaryRange?.min ? {
            '@type': 'MonetaryAmount',
            currency: job.salaryRange.currency || 'LKR',
            value: {
              '@type': 'QuantitativeValue',
              minValue: job.salaryRange.min,
              maxValue: job.salaryRange.max || job.salaryRange.min,
              unitText: 'MONTH'
            }
          } : undefined
        }}
      />
      <section className="bg-gradient-hero pt-32 pb-16">
        <div className="container-max">
          <Link to="/careers" className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-6 transition-colors">
            <FiArrowLeft size={16} /> Back to all jobs
          </Link>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="badge bg-white/10 text-white border border-white/20 mb-4">{job.department}</span>
            <h1 className="text-4xl font-bold text-white font-heading mb-4">{job.title}</h1>
            <div className="flex flex-wrap gap-4">
              {[
                { icon: FiMapPin, val: job.location },
                { icon: FiClock, val: job.type },
                { icon: FiBriefcase, val: job.department },
                job.deadline && { icon: FiCalendar, val: `Apply by ${new Date(job.deadline).toLocaleDateString('en-LK')}` },
              ].filter(Boolean).map((item, i) => (
                <span key={i} className="flex items-center gap-2 text-white/70 text-sm">
                  <item.icon size={14} /> {item.val}
                </span>
              ))}
              {job.salaryRange?.min && (
                <span className="text-accent font-semibold text-sm">
                  LKR {job.salaryRange.min.toLocaleString()} – {job.salaryRange.max?.toLocaleString()} / month
                </span>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-gray-50">
        <div className="container-max">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="card card-body">
                <h2 className="text-xl font-bold text-primary font-heading mb-4">About This Role</h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{job.description}</p>
              </div>
              {job.requirements?.length > 0 && (
                <div className="card card-body">
                  <h2 className="text-xl font-bold text-primary font-heading mb-4">Requirements</h2>
                  <ul className="space-y-2">
                    {job.requirements.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-600 text-sm">
                        <FiCheck className="text-accent mt-0.5 flex-shrink-0" size={15} /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {job.skills?.length > 0 && (
                <div className="card card-body">
                  <h2 className="text-xl font-bold text-primary font-heading mb-4">Technical Skills</h2>
                  <div className="flex flex-wrap gap-2">
                    {job.skills.map(s => <span key={s} className="badge badge-blue">{s}</span>)}
                  </div>
                </div>
              )}
            </div>

            {/* Apply sidebar */}
            <div className="space-y-4">
              <div className="card card-body sticky top-24">
                <h3 className="font-bold text-primary font-heading mb-2">Interested in this role?</h3>
                <p className="text-gray-500 text-sm mb-5">Submit your application today and our team will review it within 5 business days.</p>
                <Link to={`/careers/${job._id}/apply`} className="btn-primary w-full justify-center btn-lg">
                  Apply Now <FiArrowRight />
                </Link>
                <Link to="/contact" className="btn-ghost w-full justify-center mt-2 text-sm">Have a question? Contact HR</Link>
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Department</span><span className="font-medium text-gray-800">{job.department}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Type</span><span className="font-medium text-gray-800 capitalize">{job.type}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Applicants</span><span className="font-medium text-gray-800">{job.applicantCount || 0}</span>
                  </div>
                  {job.deadline && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Deadline</span>
                      <span className="font-medium text-red-600">{new Date(job.deadline).toLocaleDateString('en-LK')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
