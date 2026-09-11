import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import WhatsAppButton from '../components/layout/WhatsAppButton'
import Hero from '../components/sections/Hero'
import Portfolio from '../components/sections/Portfolio'
import About from '../components/sections/About'
import Reservation from '../components/sections/Reservation'

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Portfolio />
        <About />
        <Reservation />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  )
}
