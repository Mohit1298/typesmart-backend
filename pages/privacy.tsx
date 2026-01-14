import React from 'react';
import Head from 'next/head';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy - TypeSmart</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Privacy Policy for TypeSmart AI Keyboard" />
      </Head>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
          min-height: 100vh;
          color: #e0e0e0;
        }
      `}</style>
      
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '60px 24px',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '48px',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #6B5CE7 0%, #8B7CF7 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}>
              🔒
            </div>
            <span style={{
              fontSize: '24px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #6B5CE7 0%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              TypeSmart
            </span>
          </div>
          <h1 style={{
            fontSize: '36px',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '8px',
          }}>
            Privacy Policy
          </h1>
          <p style={{
            color: '#888',
            fontSize: '14px',
          }}>
            Last Updated: January 12, 2026
          </p>
        </div>

        {/* Content Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '24px',
          padding: '40px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
        }}>
          {/* Trust Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(107, 92, 231, 0.2) 0%, rgba(139, 124, 247, 0.1) 100%)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px',
            border: '1px solid rgba(107, 92, 231, 0.3)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
            }}>
              <span style={{ fontSize: '24px' }}>🛡️</span>
              <span style={{ fontSize: '18px', fontWeight: '600', color: '#fff' }}>Your Privacy Matters</span>
            </div>
            <p style={{ color: '#b0b0b0', fontSize: '14px', lineHeight: '1.6' }}>
              TypeSmart is designed with privacy at its core. We do NOT log your keystrokes, access your passwords, or share your data with advertisers.
            </p>
          </div>

          <Section title="Introduction">
            <p>TypeSmart ("we", "our", or "us") respects your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our TypeSmart keyboard application.</p>
          </Section>

          <Section title="Information We Collect">
            <Subsection title="Account Information">
              <ul>
                <li>Email address (for account creation and login)</li>
                <li>Password (stored securely with encryption)</li>
              </ul>
            </Subsection>

            <Subsection title="Usage Data">
              <ul>
                <li>Number of AI requests made (for credit tracking)</li>
                <li>Type of AI features used (rephrase, grammar, etc.)</li>
              </ul>
            </Subsection>

            <Subsection title="Keyboard Input">
              <div style={{
                background: 'rgba(34, 197, 94, 0.1)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid rgba(34, 197, 94, 0.2)',
              }}>
                <ul style={{ margin: 0 }}>
                  <li><strong style={{ color: '#22c55e' }}>We do NOT store or transmit your keystrokes</strong></li>
                  <li>Text is only sent to our AI service when you explicitly tap an AI action button</li>
                  <li>Images you attach are processed for AI analysis and immediately discarded</li>
                </ul>
              </div>
            </Subsection>
          </Section>

          <Section title="How We Use Your Information">
            <ul>
              <li>To provide AI-powered text assistance features</li>
              <li>To manage your account and credit balance</li>
              <li>To improve our services</li>
              <li>To communicate important updates</li>
            </ul>
          </Section>

          <Section title="Data Security">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginTop: '16px',
            }}>
              <SecurityCard icon="🔐" title="Encrypted" description="All data transmission uses HTTPS/TLS" />
              <SecurityCard icon="🔑" title="Hashed Passwords" description="Never stored in plain text" />
              <SecurityCard icon="✅" title="Industry Standard" description="Best security practices" />
            </div>
          </Section>

          <Section title="Third-Party Services">
            <p>We use the following third-party services:</p>
            <div style={{ marginTop: '16px' }}>
              <ServiceCard name="OpenAI" description="For AI text processing" />
              <ServiceCard name="Supabase" description="For secure data storage" />
              <ServiceCard name="Apple" description="For payment processing via App Store" />
            </div>
          </Section>

          <Section title="Full Access Permission">
            <p>TypeSmart requires "Full Access" to:</p>
            <ul>
              <li>Send your text to AI services when you tap AI buttons</li>
              <li>Process images you attach for analysis</li>
              <li>Sync your credit balance</li>
            </ul>

            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '16px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}>
              <p style={{ color: '#fca5a5', fontWeight: '600', marginBottom: '8px' }}>We do NOT:</p>
              <ul style={{ margin: 0, color: '#fca5a5' }}>
                <li>Log your keystrokes</li>
                <li>Access your passwords</li>
                <li>Share your data with advertisers</li>
              </ul>
            </div>
          </Section>

          <Section title="Children's Privacy">
            <p>TypeSmart is not intended for children under 13. We do not knowingly collect data from children.</p>
          </Section>

          <Section title="Your Rights">
            <p>You can:</p>
            <ul>
              <li>Request deletion of your account and data</li>
              <li>Export your usage data</li>
              <li>Opt out of promotional communications</li>
            </ul>
          </Section>

          <Section title="Account Deletion">
            <p>You can delete your account at any time through the TypeSmart app. When you delete your account:</p>
            <ul>
              <li>All your personal data will be permanently deleted</li>
              <li>Your usage history will be removed</li>
              <li>This action cannot be undone</li>
            </ul>
          </Section>

          <Section title="Contact Us">
            <p>For privacy concerns, contact us at: <a href="mailto:contact@wirtel.ca" style={{ color: '#a78bfa', textDecoration: 'none' }}>contact@wirtel.ca</a></p>
          </Section>

          <Section title="Changes to This Policy" isLast>
            <p>We may update this policy. Changes will be posted here with an updated date.</p>
          </Section>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>
            © 2026 TypeSmart. All rights reserved.
          </p>
          <a href="/terms" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '14px' }}>
            Terms of Service
          </a>
        </div>
      </div>
    </>
  );
}

function Section({ title, children, isLast = false }: { title: string; children: React.ReactNode; isLast?: boolean }) {
  return (
    <div style={{
      marginBottom: isLast ? 0 : '32px',
      paddingBottom: isLast ? 0 : '32px',
      borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
    }}>
      <h2 style={{
        fontSize: '20px',
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: '16px',
      }}>
        {title}
      </h2>
      <div style={{
        color: '#b0b0b0',
        lineHeight: '1.7',
        fontSize: '15px',
      }}>
        {children}
      </div>
      <style jsx>{`
        div :global(ul) {
          margin: 12px 0;
          padding-left: 24px;
        }
        div :global(li) {
          margin-bottom: 8px;
        }
        div :global(p) {
          margin-bottom: 12px;
        }
        div :global(p:last-child) {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: '600',
        color: '#d0d0d0',
        marginBottom: '12px',
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function SecurityCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '12px',
      padding: '16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontWeight: '600', color: '#fff', marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '13px', color: '#888' }}>{description}</div>
    </div>
  );
}

function ServiceCard({ name, description }: { name: string; description: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#6B5CE7',
      }} />
      <div>
        <span style={{ fontWeight: '600', color: '#fff' }}>{name}</span>
        <span style={{ color: '#888' }}> — {description}</span>
      </div>
    </div>
  );
}
