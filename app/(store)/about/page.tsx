'use client'
import React from 'react'
import { motion } from 'framer-motion'
import { AnimatedNavbar } from '@/components/store/AnimatedNavbar'
import { StayConnected } from '@/components/store/StayConnected'

export default function AboutPage() {
    const [isMobile, setIsMobile] = React.useState(false)

    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const gold = '#d4af37'
    const black = '#111111'
    const gray = '#f4f4f4'
    const textGray = '#666666'

    return (
        <main style={{ background: '#ffffff', color: black, minHeight: '100vh', overflowX: 'hidden' }}>
            {/* HIDDEN SEO HEADINGS */}
            <div className="sr-only">
                <h1>About Réveil — 25 Years of Fragrance Expertise, Now Online in India</h1>
                <h2>Premium Long-Lasting Perfumes Crafted From Decades of Industry Experience</h2>
                <p>Réveil is built on over 25 years of expertise in the fragrance industry. We craft high-quality, long-lasting perfumes at pocket-friendly prices, awakening senses across India.</p>
                <h3>Réveil — Awakening Your Senses</h3>
            </div>

            <AnimatedNavbar />

            {/* Editorial Hero */}
            <section style={{
                padding: isMobile ? '160px 24px 80px' : '220px 40px 120px',
                background: '#ffffff',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
            }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 0.03, scale: 1 }}
                    transition={{ duration: 2 }}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: isMobile ? '80px' : '280px',
                        fontWeight: 900,
                        whiteSpace: 'nowrap',
                        zIndex: 0,
                        pointerEvents: 'none',
                        fontFamily: 'var(--font-baskerville)'
                    }}
                >
                    RÉVEIL
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    style={{ zIndex: 1 }}
                >
                    <span style={{
                        fontSize: '12px',
                        letterSpacing: '0.4em',
                        textTransform: 'uppercase',
                        color: gold,
                        fontWeight: 600,
                        display: 'block',
                        marginBottom: '20px'
                    }}>
                        Our Story
                    </span>
                    <h1 style={{
                        fontSize: isMobile ? '42px' : 'clamp(40px, 7vw, 90px)',
                        fontFamily: 'var(--font-baskerville)',
                        fontWeight: 400,
                        lineHeight: 1.1,
                        margin: '0 auto 32px',
                        maxWidth: '900px'
                    }}>
                        Born from passion, <br />
                        <span style={{ fontStyle: 'italic', color: gold }}>shaped by experience.</span>
                    </h1>
                    <p style={{
                        fontSize: isMobile ? '15px' : '17px',
                        color: textGray,
                        maxWidth: '640px',
                        lineHeight: 1.7,
                        margin: '0 auto 40px'
                    }}>
                        Réveil was born from passion, experience, and a deep understanding of fragrances —
                        crafted by people who have spent a lifetime mastering the art of scent.
                    </p>
                    <div style={{ width: '60px', height: '1px', background: black, margin: '0 auto' }} />
                </motion.div>
            </section>

            {/* Stats Strip */}
            <section style={{
                background: black,
                color: '#fff',
                padding: isMobile ? '60px 24px' : '80px 40px'
            }}>
                <div style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                    gap: isMobile ? '40px 20px' : '40px',
                    textAlign: 'center'
                }}>
                    {[
                        { num: '25+', label: 'Years of Industry Expertise' },
                        { num: '2024', label: 'Year Réveil Was Born' },
                        { num: '100%', label: 'Quality Tested Fragrances' },
                        { num: 'Pan', label: 'India Delivery Network' }
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <div style={{
                                fontSize: isMobile ? '36px' : '56px',
                                fontFamily: 'var(--font-baskerville)',
                                color: gold,
                                marginBottom: '8px',
                                lineHeight: 1
                            }}>
                                {stat.num}
                            </div>
                            <div style={{
                                fontSize: isMobile ? '11px' : '12px',
                                letterSpacing: '0.2em',
                                textTransform: 'uppercase',
                                opacity: 0.7
                            }}>
                                {stat.label}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Heritage / Origin Story */}
            <section style={{ padding: isMobile ? '80px 24px' : '120px 80px', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? '60px' : '100px',
                    alignItems: 'center'
                }}>
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        style={{ flex: 1.2, position: 'relative', width: '100%' }}
                    >
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '20px'
                        }}>
                            <motion.img
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                src="https://lhnamtkpjkrawgql.public.blob.vercel-storage.com/1.jpg"
                                alt="Réveil perfume craftsmanship"
                                style={{ width: '100%', height: isMobile ? '200px' : '380px', objectFit: 'cover', borderRadius: '12px' }}
                            />
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 }}
                                style={{
                                    background: black,
                                    padding: '30px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    borderRadius: '12px'
                                }}
                            >
                                <span style={{
                                    fontSize: '11px',
                                    letterSpacing: '0.3em',
                                    color: gold,
                                    marginBottom: '12px',
                                    textTransform: 'uppercase'
                                }}>Since 2024</span>
                                <h4 style={{
                                    fontSize: '22px',
                                    fontFamily: 'var(--font-baskerville)',
                                    marginBottom: '12px',
                                    lineHeight: 1.3
                                }}>
                                    A new chapter in scent
                                </h4>
                                <p style={{ fontSize: '13px', opacity: 0.7, lineHeight: 1.6 }}>
                                    Built on decades of insight. Designed for the modern wearer.
                                </p>
                            </motion.div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        style={{ flex: 1 }}
                    >
                        <span style={{
                            fontSize: '11px',
                            letterSpacing: '0.4em',
                            color: gold,
                            textTransform: 'uppercase',
                            display: 'block',
                            marginBottom: '16px'
                        }}>
                            Our Heritage
                        </span>
                        <h2 style={{
                            fontSize: isMobile ? '30px' : '46px',
                            fontFamily: 'var(--font-baskerville)',
                            marginBottom: '32px',
                            lineHeight: 1.15
                        }}>
                            Twenty-five years <br />
                            <span style={{ fontStyle: 'italic', color: gold }}>of mastering scent.</span>
                        </h2>
                        <div style={{ fontSize: isMobile ? '15px' : '17px', lineHeight: 1.8, color: textGray }}>
                            <p style={{ marginBottom: '20px' }}>
                                With over <strong style={{ color: black }}>25 years of experience</strong> in the fragrance industry,
                                we have closely observed market trends, customer preferences, and the evolving taste for fine scents.
                            </p>
                            <p>
                                Two years ago, we took a significant step forward by launching our own brand —
                                <strong style={{ color: black }}> Réveil</strong> — with a vision to deliver high-quality fragrances
                                that resonate with modern consumers.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Philosophy — three pillars */}
            <section style={{
                padding: isMobile ? '80px 24px' : '120px 80px',
                background: gray
            }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: isMobile ? '60px' : '80px' }}>
                        <span style={{
                            fontSize: '11px',
                            letterSpacing: '0.4em',
                            color: gold,
                            textTransform: 'uppercase',
                            display: 'block',
                            marginBottom: '16px'
                        }}>
                            Our Philosophy
                        </span>
                        <h2 style={{
                            fontSize: isMobile ? '30px' : '46px',
                            fontFamily: 'var(--font-baskerville)',
                            marginBottom: '24px'
                        }}>
                            Premium scent. <span style={{ fontStyle: 'italic', color: gold }}>For everyone.</span>
                        </h2>
                        <p style={{
                            fontSize: isMobile ? '15px' : '17px',
                            color: textGray,
                            maxWidth: '720px',
                            margin: '0 auto',
                            lineHeight: 1.7
                        }}>
                            Our products are thoughtfully developed based on years of market expertise and real customer insights.
                            We believe that premium fragrance experiences should be available to everyone.
                        </p>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                        gap: '24px'
                    }}>
                        {[
                            {
                                num: '01',
                                title: 'Crafted Quality',
                                desc: 'Every fragrance is built on insight gathered from decades of industry expertise. Long-lasting, refined, and unmistakably premium.'
                            },
                            {
                                num: '02',
                                title: 'Honest Pricing',
                                desc: 'Pocket-friendly without compromise. We believe luxury should not be locked behind impossible price tags.'
                            },
                            {
                                num: '03',
                                title: 'Real Insights',
                                desc: 'Before expanding, we ran extensive market trials. Every Réveil scent earned its place by winning real customers first.'
                            }
                        ].map((p, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                style={{
                                    background: '#fff',
                                    padding: isMobile ? '32px' : '48px 36px',
                                    borderRadius: '4px',
                                    position: 'relative'
                                }}
                            >
                                <div style={{
                                    fontSize: '14px',
                                    fontFamily: 'var(--font-baskerville)',
                                    color: gold,
                                    marginBottom: '24px',
                                    letterSpacing: '0.1em'
                                }}>
                                    {p.num}
                                </div>
                                <h4 style={{
                                    fontSize: isMobile ? '20px' : '24px',
                                    fontFamily: 'var(--font-baskerville)',
                                    marginBottom: '16px'
                                }}>
                                    {p.title}
                                </h4>
                                <div style={{ width: '32px', height: '1px', background: gold, marginBottom: '20px' }} />
                                <p style={{
                                    fontSize: isMobile ? '14px' : '15px',
                                    color: textGray,
                                    lineHeight: 1.7
                                }}>
                                    {p.desc}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Journey Timeline */}
            <section style={{ padding: isMobile ? '80px 24px' : '120px 80px', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: isMobile ? '60px' : '80px' }}>
                    <span style={{
                        fontSize: '11px',
                        letterSpacing: '0.4em',
                        color: gold,
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '16px'
                    }}>
                        Our Journey
                    </span>
                    <h2 style={{
                        fontSize: isMobile ? '30px' : '46px',
                        fontFamily: 'var(--font-baskerville)'
                    }}>
                        From craft to <span style={{ fontStyle: 'italic', color: gold }}>nationwide reach.</span>
                    </h2>
                </div>

                <div style={{
                    position: 'relative',
                    paddingLeft: isMobile ? '32px' : '0'
                }}>
                    {!isMobile && (
                        <div style={{
                            position: 'absolute',
                            left: '50%',
                            top: 0,
                            bottom: 0,
                            width: '1px',
                            background: gray,
                            transform: 'translateX(-50%)'
                        }} />
                    )}
                    {isMobile && (
                        <div style={{
                            position: 'absolute',
                            left: '8px',
                            top: 0,
                            bottom: 0,
                            width: '1px',
                            background: gray
                        }} />
                    )}

                    {[
                        {
                            year: '25 Years Ago',
                            title: 'A passion takes root',
                            desc: 'We entered the fragrance industry with a singular goal — to understand scent at its deepest level.'
                        },
                        {
                            year: '2024',
                            title: 'Réveil is born',
                            desc: 'After decades of mastery, we launched our own brand with a clear vision: high-quality fragrances for modern consumers.'
                        },
                        {
                            year: 'Market Trials',
                            title: 'Tested. Loved. Proven.',
                            desc: 'Extensive trials confirmed what we already believed — Réveil resonates with people who value scent done right.'
                        },
                        {
                            year: 'Today',
                            title: 'Going online, going further',
                            desc: 'We took Réveil to the digital marketplace, allowing us to reach customers far beyond our local presence.'
                        }
                    ].map((event, i) => {
                        const isRight = i % 2 === 1
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                style={{
                                    display: 'flex',
                                    justifyContent: isMobile ? 'flex-start' : (isRight ? 'flex-end' : 'flex-start'),
                                    marginBottom: isMobile ? '40px' : '64px',
                                    position: 'relative'
                                }}
                            >
                                <div style={{
                                    position: 'absolute',
                                    left: isMobile ? '-30px' : '50%',
                                    top: '8px',
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    background: gold,
                                    border: `3px solid #fff`,
                                    boxShadow: `0 0 0 1px ${gold}`,
                                    transform: isMobile ? 'none' : 'translateX(-50%)'
                                }} />
                                <div style={{
                                    width: isMobile ? '100%' : '45%',
                                    padding: isMobile ? '0' : '0 32px'
                                }}>
                                    <div style={{
                                        fontSize: '12px',
                                        letterSpacing: '0.3em',
                                        color: gold,
                                        textTransform: 'uppercase',
                                        marginBottom: '10px',
                                        fontWeight: 600
                                    }}>
                                        {event.year}
                                    </div>
                                    <h4 style={{
                                        fontSize: isMobile ? '20px' : '24px',
                                        fontFamily: 'var(--font-baskerville)',
                                        marginBottom: '12px'
                                    }}>
                                        {event.title}
                                    </h4>
                                    <p style={{
                                        fontSize: isMobile ? '14px' : '15px',
                                        color: textGray,
                                        lineHeight: 1.7
                                    }}>
                                        {event.desc}
                                    </p>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            </section>

            {/* Commitment / Why Choose Us */}
            <section style={{ padding: isMobile ? '80px 24px' : '120px 80px', background: '#fff' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: isMobile ? '60px' : '80px' }}>
                        <span style={{
                            fontSize: '11px',
                            letterSpacing: '0.4em',
                            color: gold,
                            textTransform: 'uppercase',
                            display: 'block',
                            marginBottom: '16px'
                        }}>
                            Our Commitment
                        </span>
                        <h2 style={{
                            fontSize: isMobile ? '30px' : '46px',
                            fontFamily: 'var(--font-baskerville)',
                            marginBottom: '16px'
                        }}>
                            What you can <span style={{ fontStyle: 'italic', color: gold }}>count on.</span>
                        </h2>
                        <div style={{ width: '40px', height: '2px', background: gold, margin: '0 auto' }} />
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                        gap: '40px'
                    }}>
                        {[
                            {
                                title: 'Quality First',
                                desc: 'Every bottle reflects 25 years of expertise. Long-lasting performance, premium ingredients, and refined character.'
                            },
                            {
                                title: 'Affordable Luxury',
                                desc: 'Pocket-friendly pricing without diluting the experience. Premium scent, accessible price.'
                            },
                            {
                                title: 'Customer Trust',
                                desc: 'Driven by real customer insights. We earn loyalty by listening, refining, and delivering.'
                            }
                        ].map((v, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                style={{
                                    padding: '40px',
                                    border: `1px solid ${gray}`,
                                    textAlign: 'center'
                                }}
                            >
                                <h4 style={{
                                    fontSize: '20px',
                                    fontFamily: 'var(--font-baskerville)',
                                    marginBottom: '16px'
                                }}>
                                    {v.title}
                                </h4>
                                <div style={{ width: '24px', height: '1px', background: gold, margin: '0 auto 16px' }} />
                                <p style={{ fontSize: '14px', color: textGray, lineHeight: 1.7 }}>{v.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Signature Closing — Brand Tagline */}
            <section style={{
                background: black,
                color: '#fff',
                padding: isMobile ? '100px 24px' : '160px 40px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 0.04 }}
                    viewport={{ once: true }}
                    transition={{ duration: 2 }}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: isMobile ? '120px' : '320px',
                        fontWeight: 900,
                        fontFamily: 'var(--font-baskerville)',
                        whiteSpace: 'nowrap',
                        color: gold,
                        pointerEvents: 'none'
                    }}
                >
                    RÉVEIL
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    style={{ position: 'relative', zIndex: 1 }}
                >
                    <span style={{
                        fontSize: '11px',
                        letterSpacing: '0.5em',
                        color: gold,
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '32px'
                    }}>
                        — Our Promise —
                    </span>
                    <h2 style={{
                        fontSize: isMobile ? '32px' : '64px',
                        fontFamily: 'var(--font-baskerville)',
                        fontWeight: 400,
                        lineHeight: 1.2,
                        marginBottom: '24px',
                        maxWidth: '900px',
                        margin: '0 auto 24px'
                    }}>
                        Réveil — <span style={{ fontStyle: 'italic', color: gold }}>Awakening Your Senses.</span>
                    </h2>
                    <p style={{
                        fontSize: isMobile ? '14px' : '16px',
                        opacity: 0.7,
                        maxWidth: '600px',
                        margin: '0 auto',
                        lineHeight: 1.7
                    }}>
                        As we grow, our goal stays the same — to spread the essence of our brand
                        and become a trusted name in fragrances across India.
                    </p>
                </motion.div>
            </section>

            <StayConnected theme="light" />
        </main>
    )
}
