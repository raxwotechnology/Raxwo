import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { FiUpload, FiArrowLeft, FiArrowRight, FiFile } from 'react-icons/fi'
import SEO from '../../components/common/SEO'

export default function Apply() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [cvFile, setCvFile] = useState(null)

  const { data } = useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get(`/recruitment/jobs/${id}`).then(r => r.data),
  })
  const job = data?.job

  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (formData) => {
    if (!cvFile) return toast.error('Please upload your CV')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('cv', cvFile)
      Object.entries(formData).forEach(([k, v]) => fd.append(k, v))

      await api.post(`/recruitment/apply/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success('Application submitted! We\'ll review it and get back to you soon.')
      navigate('/careers')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <SEO
        title={job ? `Apply for ${job.title} | Careers at Raxwo Technology` : 'Job Application | Careers at Raxwo'}
        description="Submit your application to join Raxwo Technology's engineering and leadership team."
        noindex={true}
      />
      <section className="bg-gradient-hero pt-32 pb-12">
        <div className="container-max">
          <Link to={`/careers/${id}`} className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <FiArrowLeft size={16} /> Back to job details
          </Link>
          <h1 className="text-3xl font-bold text-white font-heading">
            Apply for: <span className="text-blue-300">{job?.title || 'Position'}</span>
          </h1>
          {job?.department && <p className="text-white/60 mt-1">{job.department} · {job.location}</p>}
        </div>
      </section>

      <section className="section-padding bg-gray-50">
        <div className="container-max max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card card-body">
            <h2 className="text-xl font-bold text-primary font-heading mb-6">Your Application</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Full Name *</label>
                  <input {...register('name', { required: 'Required' })} placeholder="Your full name" className="form-input" />
                  {errors.name && <p className="form-error">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="form-label">Email *</label>
                  <input {...register('email', { required: 'Required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })} type="email" placeholder="you@email.com" className="form-input" />
                  {errors.email && <p className="form-error">{errors.email.message}</p>}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Phone</label>
                  <input {...register('phone')} placeholder="+94 77 xxx xxxx" className="form-input" />
                </div>
                <div>
                  <label className="form-label">LinkedIn Profile</label>
                  <input {...register('linkedin')} placeholder="linkedin.com/in/yourprofile" className="form-input" />
                </div>
              </div>
              <div>
                <label className="form-label">Portfolio / GitHub URL</label>
                <input {...register('portfolio')} placeholder="github.com/username or portfolio URL" className="form-input" />
              </div>
              <div>
                <label className="form-label">Cover Letter</label>
                <textarea {...register('coverLetter')} rows={4} placeholder="Why are you interested in this role? What makes you a great fit?" className="form-input resize-none" />
              </div>

              {/* CV Upload */}
              <div>
                <label className="form-label">Upload CV / Resume *</label>
                <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all
                  ${cvFile ? 'border-accent bg-green-50' : 'border-gray-200 hover:border-secondary hover:bg-blue-50/30'}`}>
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => setCvFile(e.target.files[0])} />
                  {cvFile ? (
                    <>
                      <FiFile size={32} className="text-accent mb-2" />
                      <p className="font-medium text-accent">{cvFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{(cvFile.size / 1024).toFixed(0)} KB — Click to change</p>
                    </>
                  ) : (
                    <>
                      <FiUpload size={32} className="text-gray-400 mb-2" />
                      <p className="font-medium text-gray-600">Click to upload or drag & drop</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX — Max 5MB</p>
                    </>
                  )}
                </label>
                <p className="text-xs text-gray-400 mt-1.5">Your CV will be automatically parsed for skills and experience matching.</p>
              </div>

              <div className="pt-2 flex gap-3">
                <Link to={`/careers/${id}`} className="btn-ghost flex-1 justify-center">Cancel</Link>
                <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
                  {loading ? <><span className="spinner" /> Submitting...</> : <>Submit Application <FiArrowRight size={16} /></>}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
