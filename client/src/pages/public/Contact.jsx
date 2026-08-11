import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { FiMapPin, FiPhone, FiMail } from 'react-icons/fi'
import api from '../../lib/api'
import GoogleReviews from '../../components/public/GoogleReviews'
import ContactForm from '../../components/public/ContactForm'

export default function Contact() {
  const { data: siteData } = useQuery({
    queryKey: ['site-settings-public'],
    queryFn: () => api.get('/site-settings').then((r) => r.data),
  })
  const settings = siteData?.settings || {}

  return (
    <div>
      <section className="bg-gradient-hero section-padding pt-32 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 right-20 w-64 h-64 bg-secondary/15 rounded-full blur-3xl" />
        </div>
        <div className="container-max relative text-center">
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95, filter: 'blur(10px)' }} 
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }} 
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            className="flex flex-col items-center"
          >
            <motion.span 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="badge bg-white/10 text-white border border-white/20 mb-6 shadow-xl px-4 py-2"
            >
              Get In Touch
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-3xl lg:text-5xl font-bold text-white font-heading mb-6 tracking-tight drop-shadow-2xl"
            >
              Contact <span className="text-[#20b2f5]">Us</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-white/80 max-w-2xl mx-auto text-lg md:text-xl leading-relaxed font-normal"
            >
              Ready to start your project? Get a free consultation and quote from our expert software engineering team.
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-slate-50/70">
        <div className="container-max">
          <div className="grid lg:grid-cols-3 gap-10 items-start">
            {/* Contact Info */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 font-heading mb-2">Let's Talk</h2>
                <p className="text-slate-600 text-sm leading-relaxed">Fill out the form and our team will respond within one business day.</p>
              </div>
              {/* Info Items */}
              {[
                { icon: FiMapPin, label: 'Company', value: settings.siteName || 'Raxwo Technology (Pvt) Ltd' },
                { icon: FiPhone, label: 'Phone', value: settings.contactPhone || '+94 11 234 5678' },
                { icon: FiMail, label: 'Email', value: settings.contactEmail || 'hello@raxwo.com' },
              ].map((info, i) => (
                <motion.div 
                  key={info.label} 
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, type: 'spring' }}
                  className="flex gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-default group"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                    <info.icon className="text-blue-600" size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{info.label}</p>
                    <p className="text-slate-800 text-sm font-medium whitespace-pre-line">{info.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Reusable Contact Form Component */}
            <div className="lg:col-span-2">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Google Reviews Section */}
      <GoogleReviews />
    </div>
  )
}

