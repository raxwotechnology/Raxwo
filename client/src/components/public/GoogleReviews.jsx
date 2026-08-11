import { motion } from 'framer-motion'
import { FiStar, FiCheckCircle } from 'react-icons/fi'

const REVIEWS = [
  {
    id: 1,
    name: 'Kavinda Perera',
    role: 'Managing Director, City Logistics',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    rating: 5,
    date: '2 weeks ago',
    comment: 'Raxwo delivered our custom fleet management ERP on time and within budget. Their engineering team in Sri Lanka is top-notch and super responsive!',
  },
  {
    id: 2,
    name: 'Dilshan Silva',
    role: 'Founder, Gymora Fitness',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    rating: 5,
    date: '1 month ago',
    comment: 'The Gym Management ERP Software changed how we handle memberships and automated billing. Highly recommended for any growing gym business!',
  },
  {
    id: 3,
    name: 'Sarah Jenkins',
    role: 'COO, Global Tech Solutions',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    rating: 5,
    date: '2 months ago',
    comment: 'Exceptional web development and API integration. The team has great attention to detail and clear communication throughout the project.',
  },
]

export default function GoogleReviews() {
  return (
    <section className="py-16 bg-slate-50 border-t border-slate-200/80">
      <div className="container-max">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" /> Verified Google Reviews
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 font-heading">
              What Our Clients Say
            </h2>
            <p className="text-slate-600 text-sm md:text-base mt-2">
              Real feedback from businesses powered by Raxwo Software Engineering.
            </p>
          </div>

          {/* Google Score Badge */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-md flex items-center gap-4 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white font-black text-xl flex items-center justify-center">
              G
            </div>
            <div>
              <div className="flex items-center gap-1 text-amber-500 mb-0.5">
                {[...Array(5)].map((_, i) => (
                  <FiStar key={i} className="fill-current text-sm" />
                ))}
                <span className="font-extrabold text-slate-900 text-base ml-1">4.9 / 5.0</span>
              </div>
              <p className="text-xs font-medium text-slate-500">Based on 120+ Google Customer Reviews</p>
            </div>
          </div>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {REVIEWS.map((rev, i) => (
            <motion.div
              key={rev.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(rev.rating)].map((_, idx) => (
                      <FiStar key={idx} className="fill-current text-xs" />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">{rev.date}</span>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed italic mb-6">
                  "{rev.comment}"
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <img
                  src={rev.avatar}
                  alt={rev.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{rev.name}</h4>
                    <FiCheckCircle className="text-blue-500 shrink-0" size={12} title="Verified Customer" />
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{rev.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
