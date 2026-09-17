/**
 * HomeLayout — used exclusively for the "/" (home) route.
 * No fixed header; the Home page manages its own minimal top nav.
 */
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FaFacebookF, FaInstagram, FaYoutube, FaLinkedinIn, FaTiktok } from 'react-icons/fa'
import WhatsAppButton from '../components/ui/WhatsAppButton'
import SiteLogo from '../components/branding/SiteLogo'

export default function HomeLayout() {
  const location = useLocation()
  return (
    <div className="min-h-screen flex flex-col">
      <WhatsAppButton />
      <motion.main
        key={location.pathname}
        className="flex-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      >
        <Outlet />
      </motion.main>

      {/* Footer */}
      <footer className="bg-black text-white relative overflow-hidden border-t border-white/5 mt-auto">
        {/* Subtle World Map / Abstract Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.08] pointer-events-none bg-[url('/world-map.svg')] bg-no-repeat bg-center bg-cover md:bg-[length:85%_auto]"
        />

        <div className="container-max py-16 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
            
            {/* Column 1: Company Section */}
            <div className="flex flex-col space-y-8">
              <div className="mb-2">
                <SiteLogo to="/" variant="dark" asLink={false} />
              </div>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-heading font-bold text-[#20b2f5] text-[15px] mb-2">Head Office:</h4>
                  <p className="text-white text-[15px]">Weliweriya, Sri lanka</p>
                </div>
                
                <div>
                  <h4 className="font-heading font-bold text-[#20b2f5] text-[15px] mb-2">Contact:</h4>
                  <p className="text-white text-[15px]">+94 74 357 3333</p>
                </div>

                <div className="flex gap-3 pt-2">
                  {[
                    { Icon: FaFacebookF, link: 'https://web.facebook.com/Raxwo' },
                    { Icon: FaInstagram, link: 'https://www.instagram.com/raxwo/' },
                    { Icon: FaYoutube, link: 'https://www.youtube.com/@RaxwoTechnology' },
                    { Icon: FaLinkedinIn, link: 'https://www.linkedin.com/company/raxwo/' },
                    { Icon: FaTiktok, link: 'https://www.tiktok.com/@raxwotech' }
                  ].map((social, idx) => (
                    <a key={idx} href={social.link} target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-[#20b2f5] hover:bg-white hover:text-[#20b2f5] text-white transition-colors duration-300 flex items-center justify-center text-sm shadow-lg">
                      <social.Icon />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h4 className="font-heading font-bold text-[#20b2f5] text-lg mb-6">Quick links</h4>
              <ul className="space-y-4">
                {[
                  { name: 'Home', path: '/' },
                  { name: 'Who We Are', path: '/about' },
                  { name: 'Let\'s Talk', path: '/contact' },
                  { name: 'FAQ\'s', path: 'https://raxwo.net/faqs/' },
                  { name: 'Careers', path: '/careers' }
                ].map((link, idx) => (
                  <li key={idx}>
                    {link.path.startsWith('http') ? (
                      <a href={link.path} target="_blank" rel="noopener noreferrer" className="text-white font-bold text-[15px] hover:text-[#20b2f5] transition-colors duration-200">
                        {link.name}
                      </a>
                    ) : (
                      <NavLink to={link.path} className="text-white font-bold text-[15px] hover:text-[#20b2f5] transition-colors duration-200">
                        {link.name}
                      </NavLink>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Services */}
            <div>
              <h4 className="font-heading font-bold text-[#20b2f5] text-lg mb-6">Services</h4>
              <ul className="space-y-4">
                {[
                  { name: 'All Services', path: 'https://raxwo.net/services/' },
                  { name: 'Development Hub', path: 'https://raxwo.net/development-hub/' },
                  { name: 'Creative & Design Studio', path: 'https://raxwo.net/creative-design-studio/' },
                  { name: 'Marketing Lab', path: 'https://raxwo.net/marketing-lab/' },
                  { name: 'Services & Products', path: 'https://raxwo.net/services-products/' }
                ].map((link, idx) => (
                  <li key={idx}>
                    <a href={link.path} className="text-white font-bold text-[15px] hover:text-[#20b2f5] transition-colors duration-200">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Products */}
            <div>
              <h4 className="font-heading font-bold text-[#20b2f5] text-lg mb-6">Products</h4>
              <ul className="space-y-4">
                {[
                  { name: 'Software Products', path: 'https://raxwo.net/software-products/' },
                  { name: 'Mobile Shop ERP 📱', path: 'https://raxwo.net/mobile-shop-erp/' },
                  { name: 'Salon Management ERP 💇', path: 'https://raxwo.net/salon-management-erp/' },
                  { name: 'Restaurant & Hotel ERP 🍽️', path: 'https://raxwo.net/restaurant-hotel-erp/' },
                  { name: 'Hardware & Distribution ERP 🏗️', path: 'https://raxwo.net/hardware-distribution-erp/' }
                ].map((link, idx) => (
                  <li key={idx}>
                    <a href={link.path} className="text-white font-bold text-[15px] hover:text-[#20b2f5] transition-colors duration-200">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="border-t-[1px] border-dotted border-white/20 mt-16 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white text-sm font-bold tracking-wide">
              ©{new Date().getFullYear()} - Raxwo (Pvt) ltd. | All Rights Reserved
            </p>
            <div className="flex items-center gap-4 text-sm font-bold tracking-wide">
              <a href="https://raxwo.net/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#20b2f5] transition-colors">Privacy Policy</a>
              <span className="text-white/30">|</span>
              <a href="https://raxwo.net/terms-conditions-tc/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#20b2f5] transition-colors">Terms & Conditions</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
