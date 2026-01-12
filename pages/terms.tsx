import React from 'react';
import Head from 'next/head';

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service - TypeSmart</title>
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
        <h1 style={{ color: '#6B5CE7' }}>Terms of Service for TypeSmart</h1>
        <p><strong>Last Updated: January 12, 2026</strong></p>
        
        <h2>1. Acceptance of Terms</h2>
        <p>By downloading, installing, or using TypeSmart ("the App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.</p>
        
        <h2>2. Description of Service</h2>
        <p>TypeSmart is an AI-powered keyboard application that provides:</p>
        <ul>
          <li>Text rephrasing and improvement</li>
          <li>Grammar correction</li>
          <li>Content generation</li>
          <li>Tone adjustment</li>
          <li>Image analysis</li>
        </ul>
        
        <h2>3. Account Registration</h2>
        <ul>
          <li>Account registration is optional for using basic features</li>
          <li>An account is required to track your credit balance across devices</li>
          <li>You are responsible for maintaining the confidentiality of your account</li>
          <li>You must provide accurate information when creating an account</li>
        </ul>
        
        <h2>4. Credits and Subscriptions</h2>
        
        <h3>Free Credits</h3>
        <ul>
          <li>New accounts receive 50 free credits</li>
          <li>Free plan users receive 10 credits per month</li>
        </ul>
        
        <h3>Pro Subscription (Auto-Renewable)</h3>
        <ul>
          <li>Pro subscription provides 500 credits per month</li>
          <li>Subscription automatically renews monthly unless cancelled</li>
          <li>Payment is charged to your Apple ID account at confirmation of purchase</li>
          <li>Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period</li>
          <li>Your account will be charged for renewal within 24 hours prior to the end of the current period</li>
          <li>You can manage and cancel subscriptions in your Account Settings on the App Store after purchase</li>
        </ul>
        
        <h3>Credit Packs</h3>
        <ul>
          <li>Credit packs are one-time purchases (consumable)</li>
          <li>Credits do not expire</li>
          <li>Unused credits roll over</li>
        </ul>
        
        <h2>5. Refund Policy</h2>
        <p>All purchases are processed through Apple's App Store. Refund requests must be made through Apple. We do not process refunds directly.</p>
        
        <h2>6. Acceptable Use</h2>
        <p>You agree NOT to use TypeSmart to:</p>
        <ul>
          <li>Generate illegal, harmful, or offensive content</li>
          <li>Harass, abuse, or harm others</li>
          <li>Violate any applicable laws or regulations</li>
          <li>Attempt to reverse engineer or hack the App</li>
          <li>Create content that infringes intellectual property rights</li>
        </ul>
        
        <h2>7. AI-Generated Content</h2>
        <ul>
          <li>TypeSmart uses AI (powered by OpenAI) to process your text</li>
          <li>AI-generated content may not always be accurate</li>
          <li>You are responsible for reviewing and verifying AI suggestions</li>
          <li>We do not claim ownership of content you create</li>
        </ul>
        
        <h2>8. Privacy</h2>
        <p>Your use of TypeSmart is also governed by our <a href="/privacy" style={{ color: '#6B5CE7' }}>Privacy Policy</a>. Please review our Privacy Policy to understand our data practices.</p>
        
        <h2>9. Intellectual Property</h2>
        <ul>
          <li>TypeSmart and its content are owned by Wirtel</li>
          <li>You may not copy, modify, or distribute the App</li>
          <li>All trademarks and logos are property of their respective owners</li>
        </ul>
        
        <h2>10. Disclaimer of Warranties</h2>
        <p>THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE:</p>
        <ul>
          <li>The App will be error-free or uninterrupted</li>
          <li>AI suggestions will be accurate or appropriate</li>
          <li>The App will meet your specific requirements</li>
        </ul>
        
        <h2>11. Limitation of Liability</h2>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE APP.</p>
        
        <h2>12. Account Termination</h2>
        <ul>
          <li>You may delete your account at any time through the App</li>
          <li>We reserve the right to suspend or terminate accounts that violate these Terms</li>
          <li>Upon termination, your data will be deleted</li>
        </ul>
        
        <h2>13. Changes to Terms</h2>
        <p>We may update these Terms at any time. Continued use of the App after changes constitutes acceptance of the new Terms.</p>
        
        <h2>14. Contact</h2>
        <p>For questions about these Terms, contact us at: <a href="mailto:contact@wirtel.ca" style={{ color: '#6B5CE7' }}>contact@wirtel.ca</a></p>
        
        <h2>15. Governing Law</h2>
        <p>These Terms are governed by the laws of Canada.</p>
        
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #eee', textAlign: 'center', color: '#888' }}>
          <p>© 2026 TypeSmart. All rights reserved.</p>
        </div>
      </div>
    </>
  );
}
