import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import SectionHeader from '../../components/ui/SectionHeader'
import useAuthStore from '../../store/authStore'
import { FiThumbsUp, FiThumbsDown, FiStar } from 'react-icons/fi'

export default function ClientFeedback() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isAuthenticated, user } = useAuthStore()
  const isClient = isAuthenticated && user?.role === 'client'
  const { register, handleSubmit, reset } = useForm({ defaultValues: { rating: 5 } })

  const { data: publicData } = useQuery({
    queryKey: ['public-feedbacks'],
    queryFn: () => api.get('/feedback/public').then((r) => r.data),
  })
  const { data: myData } = useQuery({
    queryKey: ['client-feedbacks'],
    queryFn: () => api.get('/feedback').then((r) => r.data),
    enabled: isClient,
  })
  const feedbacks = publicData?.feedbacks || []
  const myFeedbacks = myData?.feedbacks || []

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/feedback', payload).then((r) => r.data),
    onSuccess: () => {
      toast.success('Feedback submitted')
      reset({ rating: 5, message: '' })
      qc.invalidateQueries({ queryKey: ['client-feedbacks'] })
      qc.invalidateQueries({ queryKey: ['public-feedbacks'] })
      navigate('/feedback#history')
      setTimeout(() => {
        const section = document.getElementById('feedback-history')
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Submission failed'),
  })
  const reactMut = useMutation({
    mutationFn: ({ id, action }) => api.put(`/feedback/${id}/reaction`, { action }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public-feedbacks'] })
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Reaction failed'),
  })

  return (
    <div className="animate-fade-in">
      <section className="bg-gradient-hero pt-32 pb-10">
        <div className="container-max">
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-white mt-2">Feedback</h1>
          <p className="text-white/75 mt-2">Share your project experience with our team.</p>
        </div>
      </section>
      <section className="section-padding bg-slate-50">
        <div className="container-max space-y-6">
          <SectionHeader title="Submit Feedback" subtitle="Help us improve — your feedback is reviewed by the team." />
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="card p-6 space-y-4">
            {!isAuthenticated && (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Name</label>
                  <input {...register('name', { required: true })} className="form-input" placeholder="Your name" />
                </div>
                <div>
                  <label className="form-label">Email</label>
                  <input {...register('email', { required: true })} type="email" className="form-input" placeholder="Your email" />
                </div>
              </div>
            )}
            <div>
              <label className="form-label">Rating</label>
              <select {...register('rating', { required: true, valueAsNumber: true })} className="form-select">
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Good</option>
                <option value={3}>3 - Average</option>
                <option value={2}>2 - Needs Improvement</option>
                <option value={1}>1 - Poor</option>
              </select>
            </div>
            <div>
              <label className="form-label">Your Feedback</label>
              <textarea {...register('message', { required: true })} className="form-input min-h-28" />
            </div>
            <button className="btn-primary" disabled={mutation.isPending}>Submit Feedback</button>
          </form>

          <SectionHeader title="Public Feedback Wall" subtitle="Modern testimonial feed with ratings and reactions." />
          <div className="grid lg:grid-cols-2 gap-4">
            {feedbacks.map((f) => {
              const liked = (f.likedBy || []).some((id) => String(id) === String(user?._id))
              const disliked = (f.dislikedBy || []).some((id) => String(id) === String(user?._id))
              return (
                <div key={f._id} className="card p-5 shadow-card-hover">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold">
                        {(f.client?.name || f.name || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-primary">{f.client?.name || f.name || 'Anonymous'}</p>
                        <p className="text-xs text-slate-400">{new Date(f.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <FiStar key={i} className={i < Number(f.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} size={14} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 mt-4">{f.message}</p>
                  {f.response ? (
                    <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase">Team response</p>
                      <p className="text-sm text-slate-700 mt-1">{f.response}</p>
                    </div>
                  ) : null}
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      className={`btn-sm ${liked ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => isAuthenticated ? reactMut.mutate({ id: f._id, action: 'like' }) : navigate('/')}
                    >
                      <FiThumbsUp size={13} /> {f.likes || 0}
                    </button>
                    <button
                      type="button"
                      className={`btn-sm ${disliked ? 'btn-danger' : 'btn-outline'}`}
                      onClick={() => isAuthenticated ? reactMut.mutate({ id: f._id, action: 'dislike' }) : navigate('/')}
                    >
                      <FiThumbsDown size={13} /> {f.dislikes || 0}
                    </button>
                  </div>
                </div>
              )
            })}
            {feedbacks.length === 0 ? <div className="card p-8 text-center text-slate-400 lg:col-span-2">No feedback available yet.</div> : null}
          </div>

          {isAuthenticated && (
            <>
              <div id="feedback-history">
                <SectionHeader title="My Feedback History" subtitle="All feedback you submitted (latest first)." />
              </div>
              <div className="space-y-3" id="feedback-history-list">
                {myFeedbacks.map((f) => (
                  <div key={f._id} className="card p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-primary flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <FiStar key={i} className={i < Number(f.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} size={14} />
                          ))}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">{f.message}</p>
                        {f.response ? (
                          <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Team response</p>
                            <p className="text-sm text-slate-700 mt-1">{f.response}</p>
                          </div>
                        ) : null}
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(f.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {myFeedbacks.length === 0 ? (
                  <div className="card p-8 text-center text-slate-400">No feedback submitted yet.</div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
