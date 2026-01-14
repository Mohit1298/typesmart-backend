import React from 'react';
import Head from 'next/head';

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service - TypeSmart</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Terms of Service for TypeSmart AI Keyboard" />
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
              ⌨️
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
            Terms of Service
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
          <Section title="1. Acceptance of Terms">
            <p>By downloading, installing, or using TypeSmart ("the App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>TypeSmart is an AI-powered keyboard application that provides:</p>
            <ul>
              <li>Text rephrasing and improvement</li>
              <li>Grammar correction</li>
              <li>Content generation</li>
              <li>Tone adjustment</li>
              <li>Image analysis</li>
            </ul>
          </Section>

          <Section title="3. Account Registration">
            <ul>
              <li>Account registration is optional for using basic features</li>
              <li>An account is required to track your credit balance across devices</li>
              <li>You are responsible for maintaining the confidentiality of your account</li>
              <li>You must provide accurate information when creating an account</li>
            </ul>
          </Section>

          <Section title="4. Credits and Subscriptions">
            <Subsection title="Free Credits">
              <ul>
                <li>New accounts receive 50 free credits</li>
                <li>Free plan users receive 50 credits per month</li>
              </ul>
            </Subsection>

            <Subsection title="Pro Subscription (Auto-Renewable)">
              <ul>
                <li>Pro subscription provides 500 credits per month</li>
                <li>Subscription automatically renews monthly unless cancelled</li>
                <li>Payment is charged to your Apple ID account at confirmation of purchase</li>
                <li>Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period</li>
                <li>Your account will be charged for renewal within 24 hours prior to the end of the current period</li>
                <li>You can manage and cancel subscriptions in your Account Settings on the App Store after purchase</li>
              </ul>
            </Subsection>

            <Subsection title="Credit Packs">
              <ul>
                <li>Credit packs are one-time purchases (consumable)</li>
                <li>Credits do not expire</li>
                <li>Unused credits roll over</li>
              </ul>
            </Subsection>
          </Section>

          <Section title="5. Refund Policy">
            <p>All purchases are processed through Apple's App Store. Refund requests must be made through Apple. We do not process refunds directly.</p>
          </Section>

          <Section title="6. Acceptable Use">
            <p>You agree NOT to use TypeSmart to:</p>
            <ul>
              <li>Generate illegal, harmful, or offensive content</li>
              <li>Harass, abuse, or harm others</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Attempt to reverse engineer or hack the App</li>
              <li>Create content that infringes intellectual property rights</li>
            </ul>
          </Section>

          <Section title="7. AI-Generated Content">
            <ul>
              <li>TypeSmart uses AI (powered by OpenAI) to process your text</li>
              <li>AI-generated content may not always be accurate</li>
              <li>You are responsible for reviewing and verifying AI suggestions</li>
              <li>We do not claim ownership of content you create</li>
            </ul>
          </Section>

          <Section title="8. Privacy">
            <p>Your use of TypeSmart is also governed by our <a href="/privacy" style={{ color: '#a78bfa', textDecoration: 'none' }}>Privacy Policy</a>. Please review our Privacy Policy to understand our data practices.</p>
          </Section>

          <Section title="9. Intellectual Property">
            <ul>
              <li>TypeSmart and its content are owned by Wirtel</li>
              <li>You may not copy, modify, or distribute the App</li>
              <li>All trademarks and logos are property of their respective owners</li>
            </ul>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <p style={{ textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.5px' }}>
              The App is provided "as is" without warranties of any kind. We do not guarantee:
            </p>
            <ul>
              <li>The App will be error-free or uninterrupted</li>
              <li>AI suggestions will be accurate or appropriate</li>
              <li>The App will meet your specific requirements</li>
            </ul>
          </Section>

          <Section title="11. Limitation of Liability">
            <p style={{ textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.5px' }}>
              To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the App.
            </p>
          </Section>

          <Section title="12. Account Termination">
            <ul>
              <li>You may delete your account at any time through the App</li>
              <li>We reserve the right to suspend or terminate accounts that violate these Terms</li>
              <li>Upon termination, your data will be deleted</li>
            </ul>
          </Section>

          <Section title="13. Changes to Terms">
            <p>We may update these Terms at any time. Continued use of the App after changes constitutes acceptance of the new Terms.</p>
          </Section>

          <Section title="14. Contact">
            <p>For questions about these Terms, contact us at: <a href="mailto:contact@wirtel.ca" style={{ color: '#a78bfa', textDecoration: 'none' }}>contact@wirtel.ca</a></p>
          </Section>

          <Section title="15. Governing Law" isLast>
            <p>These Terms are governed by the laws of Canada.</p>
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
          <a href="/privacy" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: '14px' }}>
            Privacy Policy
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
