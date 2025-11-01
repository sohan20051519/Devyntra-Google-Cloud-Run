import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';
import { Icons } from './icons/Icons';
import { signInWithGitHub } from '../services/firebase';

interface LandingPageProps {
  onLogin: () => void;
}

const AnimatedFeatureText: React.FC<{ features: { icon: React.ReactNode; text: string }[] }> = ({ features }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prevIndex => (prevIndex + 1) % features.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [features.length]);

  return (
    <div className="relative h-8 overflow-hidden">
      {features.map((feature, i) => (
        <div
          key={i}
          className={`absolute inset-0 flex items-center gap-2 transition-transform duration-500 ease-in-out ${index === i ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ transform: `translateY(${(i - index) * 100}%)` }}
        >
          {feature.icon}
          <span className="text-primary">{feature.text}</span>
        </div>
      ))}
    </div>
  );
};

const AnimatedText: React.FC<{ text: string; delay?: number; className?: string }> = ({ text, delay = 0, className = '' }) => (
    <span className={`inline-block animate-fade-in-up opacity-0 ${className}`} style={{ animationDelay: `${delay}ms` }}>
        {text}
    </span>
);


const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    { icon: <Icons.Code size={24} />, text: 'Code Analysis' },
    { icon: <Icons.Wrench size={24} />, text: 'Automated Fixes' },
    { icon: <Icons.Box size={24} />, text: 'Containerization' },
    { icon: <Icons.GitHub size={24} />, text: 'CI/CD Pipelines' },
  ];

  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-background text-on-background">
      {/* Background Gradient */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem]">
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_800px_at_50%_200px,#EADDFF66,transparent)]"></div>
      </div>
      
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out animate-fade-in-up ${isScrolled ? 'py-2' : 'p-4'}`}>
        <nav className={`flex justify-between items-center transition-all duration-300 ease-in-out ${
          isScrolled 
            ? 'max-w-md mx-auto bg-surface/90 backdrop-blur-lg rounded-full shadow-xl p-2 px-4' 
            : 'container mx-auto px-4 sm:px-6 lg:px-8'
        }`}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary rounded-md">
              <Icons.Code size={20} className="text-on-primary" />
            </div>
            <h1 className={`font-bold text-primary transition-all duration-300 ${isScrolled ? 'text-xl hidden sm:block' : 'text-2xl'}`}>Devyntra</h1>
          </div>
          <Button 
            variant="outlined" 
            onClick={async () => {
              try {
                const res = await signInWithGitHub();
                if (res?.accessToken) {
                  localStorage.setItem('github_access_token', res.accessToken);
                  if (res.email) localStorage.setItem('github_email', res.email);
                  onLogin();
                }
              } catch (e) {
                console.error('GitHub auth failed', e);
                alert('GitHub authentication failed. Check console for details.');
              }
            }} 
            icon={<Icons.GitHub size={16} />}
            className={`transition-all duration-300 ${isScrolled ? '!py-1.5 !px-4 !text-xs' : ''}`}
          >
            <span className={isScrolled ? 'hidden sm:inline' : 'inline'}>Connect GitHub</span>
            <span className={isScrolled ? 'inline sm:hidden' : 'hidden'}>Connect</span>
          </Button>
        </nav>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="min-h-screen flex items-center pt-20 pb-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-on-background mb-6">
                <AnimatedText text="The" delay={100} />{' '}
                <AnimatedText text="End" delay={200} />{' '}
                <AnimatedText text="of" delay={300} />{' '}
                <AnimatedText text="Manual" delay={400} />{' '}
                <AnimatedText text="DevOps." delay={500} className="text-primary" />
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-on-surface-variant max-w-xl mx-auto lg:mx-0 mb-10 animate-fade-in-up" style={{ animationDelay: '700ms' }}>
                Stop wrestling with YAML and CI configurations. Devyntra is a zero-config platform that takes your code from repository to live Cloud Run URL in a single click.
              </p>
              <div className="animate-fade-in-up flex justify-center lg:justify-start" style={{ animationDelay: '800ms' }}>
                 <Button 
                   onClick={async () => {
                     try {
                       const res = await signInWithGitHub();
                       if (res?.accessToken) {
                         localStorage.setItem('github_access_token', res.accessToken);
                         if (res.email) localStorage.setItem('github_email', res.email);
                         onLogin();
                       }
                     } catch (e) {
                       console.error('GitHub auth failed', e);
                       alert('GitHub authentication failed. Check console for details.');
                     }
                   }} 
                   icon={<Icons.GitHub size={20}/>} 
                   className="py-4 px-8 text-base shadow-lg hover:shadow-primary/30 animate-pulse-bright"
                 >
                    Connect with GitHub to Start
                 </Button>
              </div>
            </div>
            <div className="hidden lg:block animate-zoom-in" style={{ animationDelay: '900ms' }}>
              <Card className="p-8 bg-primary-container/30 border border-primary/20">
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-surface">
                        <div className="p-3 bg-primary-container rounded-full text-primary">
                            <Icons.Code size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-on-surface">Detect Language & Framework</h3>
                            <p className="text-sm text-on-surface-variant">Node.js (React) detected.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-surface shadow-md scale-105 border border-primary/30">
                        <div className="p-3 bg-primary-container rounded-full text-primary">
                           <Icons.Wrench size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-on-surface">Automated Code Fixes</h3>
                            <p className="text-sm text-on-surface-variant">Applied 2 critical patches.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-surface">
                        <div className="p-3 bg-primary-container rounded-full text-primary">
                           <Icons.NewDeployment size={24} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-on-surface">Deploy to Cloud</h3>
                            <p className="text-sm text-on-surface-variant">Deployment to Google Cloud Run successful.</p>
                        </div>
                    </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* No YAML Section */}
        <section className="py-20">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-on-background mb-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    Escape the YAML Maze
                </h2>
                <p className="text-lg text-on-surface-variant animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    Say goodbye to endless configuration files and complex setup. Devyntra intelligently handles the entire build and deploy process for you.
                </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 items-stretch">
                {/* The Old Way */}
                <div className="animate-fade-in-right" style={{ animationDelay: '300ms' }}>
                    <Card className="h-full p-0 overflow-hidden bg-inverse-surface flex flex-col">
                        <div className="p-6 border-b border-white/10">
                            <h3 className="text-xl font-bold text-on-inverse-surface">Manual CI/CD Setup</h3>
                            <p className="text-sm text-on-inverse-surface/70">The old, complex way.</p>
                        </div>
                        <div className="p-6 font-mono text-xs text-on-inverse-surface/70 overflow-x-auto flex-1">
                            <pre>
                                <code>
                                    <span className="text-blue-400">name:</span> Deploy to Production
                                    <br />
                                    <span className="text-blue-400">on:</span>
                                    <br />
                                    {'  '}<span className="text-blue-400">push:</span>
                                    <br />
                                    {'    '}<span className="text-blue-400">branches:</span> [ main ]
                                    <br />
                                    <span className="text-blue-400">jobs:</span>
                                    <br />
                                    {'  '}<span className="text-blue-400">build:</span>
                                    <br />
                                    {'    '}<span className="text-blue-400">runs-on:</span> ubuntu-latest
                                    <br />
                                    {'    '}<span className="text-blue-400">steps:</span>
                                    <br />
                                    {'    '}- <span className="text-blue-400">uses:</span> actions/checkout@v2
                                    <br />
                                    {'    '}- <span className="text-blue-400">name:</span> Setup Node.js
                                    <br />
                                    {'      '}<span className="text-blue-400">run:</span> # ... more config ...
                                    <br />
                                    {'    '}- <span className="text-blue-400">name:</span> Install Dependencies
                                    <br />
                                    {'      '}<span className="text-blue-400">run:</span> npm install
                                    <br />
                                    {'    '}- <span className="text-blue-400">name:</span> <span className="text-red-400">Build Project... ???</span>
                                    <br />
                                    {'    '}- <span className="text-blue-400">name:</span> Configure Docker
                                    <br />
                                    {'      '}<span className="text-blue-400">run:</span> echo "Good luck!"
                                </code>
                            </pre>
                        </div>
                    </Card>
                </div>

                {/* The Devyntra Way */}
                <div className="animate-fade-in-left" style={{ animationDelay: '400ms' }}>
                    <Card className="h-full p-6 border-2 border-primary shadow-2xl bg-surface flex flex-col justify-center">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-primary text-center mb-8">The Devyntra Way</h3>
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
                                    <div className="p-3 bg-primary-container rounded-full text-primary">
                                        <Icons.GitHub size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-on-surface">1. Connect Your Repository</h4>
                                        <p className="text-sm text-on-surface-variant">Just grant access. That's it.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '600ms' }}>
                                    <div className="p-3 bg-primary-container rounded-full text-primary">
                                        <Icons.DevAI size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-on-surface">2. AI Handles Everything</h4>
                                        <p className="text-sm text-on-surface-variant">Analysis, fixes, containerization, and pipelines.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '700ms' }}>
                                    <div className="p-3 bg-primary-container rounded-full text-primary">
                                        <Icons.NewDeployment size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-on-surface">3. Get a Live URL</h4>
                                        <p className="text-sm text-on-surface-variant">Deployed to the cloud in minutes.</p>
                                    </div>
                                </div>
                            </div>
                            <p className="mt-8 text-center text-on-surface-variant text-sm">Zero YAML required. Ever.</p>
                        </div>
                    </Card>
                </div>
            </div>
        </section>

        {/* Features Section */}
        <section className="py-20">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-on-background mb-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>Built for Developers, by Developers</h2>
                <p className="text-lg text-on-surface-variant animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    Devyntra is packed with features that eliminate the tedious parts of deployment, letting you focus on what you do best: building incredible software.
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <Card className="p-8 text-center h-full">
                  <div className="inline-block p-4 bg-primary-container rounded-full text-primary mb-4">
                    <Icons.NewDeployment size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-on-primary-container mb-2">One-Click Deployment</h3>
                  <p className="text-on-surface-variant">Go from a GitHub repository to a live Google Cloud Run URL in a single click. No YAML, no manual steps.</p>
                </Card>
              </div>

              {/* Feature 2 */}
              <div className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                <Card className="p-8 text-center h-full border-2 border-primary shadow-lg">
                  <div className="inline-block p-4 bg-primary-container rounded-full text-primary mb-4">
                    <Icons.DevAI size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-on-primary-container mb-2">AI-Powered Code Analysis & Fixes</h3>
                  <p className="text-on-surface-variant">Our AI assistant, Jules, scans your code for errors, applies fixes, and ensures your app is production-ready before deployment.</p>
                </Card>
              </div>

              {/* Feature 3 */}
              <div className="animate-fade-in-up" style={{ animationDelay: '500ms' }}>
                <Card className="p-8 text-center h-full">
                  <div className="inline-block p-4 bg-primary-container rounded-full text-primary mb-4">
                    <Icons.GitHub size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-on-primary-container mb-2">Automated CI/CD & Secret Management</h3>
                  <p className="text-on-surface-variant">Devyntra automatically generates a complete CI/CD pipeline and securely injects any required secrets. Zero configuration required.</p>
                </Card>
              </div>
            </div>
        </section>

        {/* Final CTA */}
        <section className="text-center py-20">
          <div className="animate-zoom-in" style={{ animationDelay: '300ms' }}>
              <h2 className="text-3xl md:text-4xl font-bold text-on-background mb-4">Ready to Ship Faster?</h2>
              <p className="text-lg text-on-surface-variant max-w-2xl mx-auto mb-8">
                  Stop wrestling with configurations and start building what matters. Connect your repository and deploy your first application in minutes.
              </p>
              <div className="flex justify-center">
                  <Button 
                    onClick={async () => {
                      try {
                        const res = await signInWithGitHub();
                        if (res?.accessToken) {
                          localStorage.setItem('github_access_token', res.accessToken);
                          if (res.email) localStorage.setItem('github_email', res.email);
                          onLogin();
                        }
                      } catch (e) {
                        console.error('GitHub auth failed', e);
                        alert('GitHub authentication failed. Check console for details.');
                      }
                    }} 
                    icon={<Icons.GitHub size={20}/>} 
                    className="py-4 px-8 text-base shadow-lg hover:shadow-primary/30 animate-pulse-bright"
                  >
                      Connect with GitHub to Start
                  </Button>
              </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;