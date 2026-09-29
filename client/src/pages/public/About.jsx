import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FiArrowRight, FiAward, FiUsers, FiTarget, FiGlobe, FiHeart, FiZap, FiShield, FiTrendingUp } from 'react-icons/fi'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'

import { mediaUrl } from '../../lib/media'
import SEO from '../../components/common/SEO'

const values = [
  { icon: FiZap, title: 'Innovation First', desc: 'We embrace new technologies and creative approaches to solve complex problems.', color: 'bg-yellow-50 text-yellow-600' },
  { icon: FiHeart, title: 'Client-Centric', desc: 'Every decision we make starts with our clients\' success and satisfaction in mind.', color: 'bg-red-50 text-red-600' },
  { icon: FiShield, title: 'Quality & Trust', desc: 'We deliver robust, tested, and secure solutions you can depend on for years.', color: 'bg-blue-50 text-blue-600' },
  { icon: FiUsers, title: 'Collaborative Spirit', desc: 'We believe the best work happens when talented people work together openly.', color: 'bg-green-50 text-green-600' },
  { icon: FiTarget, title: 'Results-Driven', desc: 'We measure success by the tangible impact our work has on your business.', color: 'bg-purple-50 text-purple-600' },
  { icon: FiGlobe, title: 'Global Mindset', desc: 'Sri Lankan roots, global standards — we serve clients across 15+ countries.', color: 'bg-teal-50 text-teal-600' },
]

const milestones = [
  { year: '2020', title: 'Founded in Colombo', desc: 'Raxwo was founded with a vision to bring world-class software development to Sri Lanka.' },
  { year: '2021', title: 'First 10 Clients', desc: 'Delivered 10 successful projects across e-commerce, healthcare, and finance verticals.' },
  { year: '2022', title: 'Team of 20', desc: 'Expanded to 20 engineers and designers, opened our first dedicated office in Colombo 03.' },
  { year: '2023', title: 'ISO Certified & 50+ Projects', desc: 'Achieved ISO 9001 certification and surpassed 50 completed projects milestone.' },
  { year: '2024', title: 'International Expansion', desc: 'Serving clients in UAE, UK, and Australia. Team grew to 35+ professionals.' },
  { year: '2026', title: 'Raxwo Portal Launch', desc: 'Launched our proprietary HRM platform to streamline internal operations.' },
]

const fadeUp = { 
  hidden: { opacity: 0, y: 40, scale: 0.96 }, 
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: 'spring', stiffness: 100, damping: 20 }
  } 
}

export default function About() {
  const { data } = useQuery({
    queryKey: ['public-leaders'],
    queryFn: () => api.get('/leaders').then(r => r.data.leaders),
  })
  
  const team = data || []

  return (
    <div className="overflow-x-hidden">
      <SEO
        title="About Raxwo Technology | Our Story, Vision & Engineering Leadership"
        description="Learn about Raxwo Technology, Sri Lanka's leading digital engineering firm. Discover our mission, values, milestones, and leadership delivering global software solutions."
        keywords="About Raxwo, Raxwo Technology Story, Software Company Colombo, IT Leadership Sri Lanka, Enterprise Technology Partner"
        schema={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: 'About Raxwo Technology',
          description: 'Raxwo Technology is a leading software engineering and enterprise solutions firm in Sri Lanka.',
          publisher: {
            '@type': 'Organization',
            name: 'Raxwo Technology',
            url: 'https://manage.raxwo.net'
          }
        }}
      />
      {/* Hero */}
      <section className="relative bg-[#0C0227] pt-32 pb-24 overflow-hidden">
        <div className="container-max relative z-10 text-center">
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.2, delayChildren: 0.1 } } }}>
            <motion.h1 variants={fadeUp} className="text-4xl lg:text-5xl font-bold text-white font-heading leading-tight mb-4 tracking-tight">
              Who We Are
            </motion.h1>
            <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 text-white/80 text-sm font-medium">
              <Link to="/" className="flex items-center gap-1 hover:text-[#20b2f5] transition-colors"><FiGlobe className="text-[#20b2f5]" /> Home</Link>
              <span className="text-white/40">|</span>
              <span className="flex items-center gap-1"><FiUsers className="text-[#20b2f5]" /> Who We Are</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Mission / About Content */}
      <section className="py-20 bg-white">
        <div className="container-max">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                  alt="Team collaborating" 
                  className="w-full h-auto object-cover rounded-2xl"
                />
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="inline-block px-4 py-1.5 bg-[#0C0227] text-white text-xs font-bold rounded-lg mb-6 tracking-wide">
                Our Company
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-[#0C0227] font-heading mb-2">
                About Raxwo Pvt Ltd
              </h2>
              <h3 className="text-2xl lg:text-3xl font-bold text-[#20b2f5] font-heading leading-tight mb-6">
                Your Trusted Software Development & Digital Solutions Partner
              </h3>
              <p className="text-gray-600 leading-relaxed mb-6 text-sm lg:text-base">
                At <strong className="text-[#0C0227]">Raxwo Pvt Ltd</strong>, we are a forward-thinking <strong className="text-[#0C0227]">software development company based in Sri Lanka</strong>, delivering <strong className="text-[#0C0227]">custom software, product development, web design</strong>, and <strong className="text-[#0C0227]">digital marketing solutions</strong> for businesses worldwide. Our mission is simple — to transform business challenges into scalable, digital-first solutions that generate real results.
              </p>
              <div className="flex gap-4 mt-8">
                <Link to="/contact" className="btn-primary bg-[#20b2f5] hover:bg-blue-400">Start Your Project <FiArrowRight /></Link>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-white">
        <div className="container-max">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <span className="badge badge-green mb-4">Our Values</span>
            <h2 className="text-4xl font-bold text-primary font-heading mb-4">What Drives Us</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">Six core values that guide every decision, every line of code, and every client interaction.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 100 }}
                className="card card-body card-hover group"
              >
                <div className={`w-12 h-12 rounded-2xl ${v.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <v.icon size={22} />
                </div>
                <h3 className="font-semibold text-primary font-heading mb-2">{v.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="section-padding bg-gray-50">
        <div className="container-max">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <span className="badge badge-purple mb-4">Our Journey</span>
            <h2 className="text-4xl font-bold text-primary font-heading mb-4">Milestones & Growth</h2>
          </motion.div>

          <div className="relative max-w-3xl mx-auto">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-8">
              {milestones.map((m, i) => (
                <motion.div
                  key={m.year}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ delay: i * 0.15, type: 'spring', stiffness: 80 }}
                  className="flex gap-6"
                >
                  <div className="w-16 flex-shrink-0 flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full bg-secondary border-4 border-white shadow-blue z-10" />
                    <span className="text-xs font-bold text-secondary mt-2">{m.year}</span>
                  </div>
                  <div className="card card-body flex-1 mb-0">
                    <h3 className="font-semibold text-primary font-heading mb-1">{m.title}</h3>
                    <p className="text-gray-500 text-sm">{m.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="section-padding bg-white">
        <div className="container-max">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <span className="badge badge-blue mb-4">The Team</span>
            <h2 className="text-4xl font-bold text-primary font-heading mb-4">Meet Our Leaders</h2>
            <p className="text-gray-500 max-w-xl mx-auto">A diverse, talented group of professionals passionate about building great software.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 100 }}
                className="card card-body card-hover text-center group"
              >
                {member.imageUrl ? (
                  <img
                    src={mediaUrl(member.imageUrl)}
                    alt={member.name}
                    className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 shadow-lg group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className={`w-20 h-20 ${member.color} rounded-2xl flex items-center justify-center text-white font-bold text-2xl font-heading mx-auto mb-4 group-hover:scale-105 transition-transform shadow-lg`}>
                    {member.initials}
                  </div>
                )}
                <h3 className="font-semibold text-primary font-heading">{member.name}</h3>
                <p className="text-secondary text-sm font-medium mt-0.5">{member.role}</p>
                <span className="badge badge-gray mt-2">{member.dept}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-gradient-hero">
        <div className="container-max text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl font-bold text-white font-heading mb-6">Ready to Work With Us?</h2>
            <p className="text-white/70 text-lg max-w-xl mx-auto mb-10">
              Whether you need a new system built from scratch or want to modernize your existing platform, let's talk.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/contact" className="btn-primary btn-lg">Start a Project <FiArrowRight /></Link>
              <Link to="/careers" className="btn-outline btn-lg border-white/30 text-white hover:bg-white/10">Join Our Team</Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
