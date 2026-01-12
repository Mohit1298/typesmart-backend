import React from 'react';
import Head from 'next/head';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy - TypeSmart</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto', 
        padding: '40px 20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        lineHeight: '1.6',
        color: '#333'
      }}>
        <h1 style={{ color: '#6B5CE7' }}>Privacy Policy for TypeSmart</h1>
        <p><strong>Last Updated: January 12, 2026</strong></p>
        
        <h2>Introduction</h2>
        <p>TypeSmart ("we", "our", or "us") respects your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our TypeSmart keyboard application.</p>
        
        <h2>Information We Collect</h2>
        
        <h3>Account Information</h3>
        <ul>
          <li>Email address (for account creation and login)</li>
          <li>Password (stored securely with encryption)</li>
        </ul>
        
        <h3>Usage Data</h3>
        <ul>
          <li>Number of AI requests made (for credit tracking)</li>
          <li>Type of AI features used (rephrase, grammar, etc.)</li>
        </ul>
        
        <h3>Keyboard Input</h3>
        <ul>
          <li><strong>We do NOT store or transmit your keystrokes</strong></li>
          <li>Text is only sent to our AI service when you explicitly tap an AI action button</li>
          <li>Images you attach are processed for AI analysis and immediately discarded</li>
        </ul>
        
        <h2>How We Use Your Information</h2>
        <ul>
          <li>To provide AI-powered text assistance features</li>
          <li>To manage your account and credit balance</li>
          <li>To improve our services</li>
          <li>To communicate important updates</li>
        </ul>
        
        <h2>Data Security</h2>
        <ul>
          <li>All data transmission is encrypted using HTTPS/TLS</li>
          <li>Passwords are hashed and never stored in plain text</li>
          <li>We use industry-standard security practices</li>
        </ul>
        
        <h2>Third-Party Services</h2>
        <p>We use the following third-party services:</p>
        <ul>
          <li><strong>OpenAI</strong>: For AI text processing (subject to OpenAI's privacy policy)</li>
          <li><strong>Supabase</strong>: For secure data storage</li>
          <li><strong>Apple</strong>: For payment processing via App Store</li>
        </ul>
        
        <h2>Full Access Permission</h2>
        <p>TypeSmart requires "Full Access" to:</p>
        <ul>
          <li>Send your text to AI services when you tap AI buttons</li>
          <li>Process images you attach for analysis</li>
          <li>Sync your credit balance</li>
        </ul>
        
        <p><strong>We do NOT:</strong></p>
        <ul>
          <li>Log your keystrokes</li>
          <li>Access your passwords</li>
          <li>Share your data with advertisers</li>
        </ul>
        
        <h2>Children's Privacy</h2>
        <p>TypeSmart is not intended for children under 13. We do not knowingly collect data from children.</p>
        
        <h2>Your Rights</h2>
        <p>You can:</p>
        <ul>
          <li>Request deletion of your account and data</li>
          <li>Export your usage data</li>
          <li>Opt out of promotional communications</li>
        </ul>
        
        <h2>Account Deletion</h2>
        <p>You can delete your account at any time through the TypeSmart app. When you delete your account:</p>
        <ul>
          <li>All your personal data will be permanently deleted</li>
          <li>Your usage history will be removed</li>
          <li>This action cannot be undone</li>
        </ul>
        
        <h2>Contact Us</h2>
        <p>For privacy concerns, contact us at: <a href="mailto:contact@wirtel.ca" style={{ color: '#6B5CE7' }}>contact@wirtel.ca</a></p>
        
        <h2>Changes to This Policy</h2>
        <p>We may update this policy. Changes will be posted here with an updated date.</p>
        
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #eee', textAlign: 'center', color: '#888' }}>
          <p>© 2026 TypeSmart. All rights reserved.</p>
          <p><a href="/terms" style={{ color: '#6B5CE7' }}>Terms of Service</a></p>
        </div>
      </div>
    </>
  );
}
