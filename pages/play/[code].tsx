import { GetServerSideProps } from 'next';
import Head from 'next/head';

interface PlayPageProps {
  code: string;
  error?: string;
}

/**
 * Voice Note Play Page
 * 
 * This page serves as a redirect from shared voice note links to the TypeSmart app.
 * When a user taps a link like: https://typesmart-backend.vercel.app/play/ABC12345
 * 
 * Flow:
 * 1. Page loads with the voice note code
 * 2. Attempts to open the TypeSmart app via deep link
 * 3. If app not installed, shows download prompt
 */
export default function PlayPage({ code, error }: PlayPageProps) {
  const deepLink = `typesmart://play/${code}`;
  
  if (error) {
    return (
      <div style={styles.container}>
        <Head>
          <title>TypeSmart Voice Note</title>
        </Head>
        <div style={styles.card}>
          <div style={styles.emoji}>❌</div>
          <h1 style={styles.title}>Voice Note Not Found</h1>
          <p style={styles.subtitle}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <Head>
        <title>TypeSmart Voice Note</title>
        <meta name="description" content="Listen to this voice note in TypeSmart" />
        {/* Auto-redirect to app */}
        <meta httpEquiv="refresh" content={`0;url=${deepLink}`} />
      </Head>
      
      <div style={styles.card}>
        <div style={styles.emoji}>🎤</div>
        <h1 style={styles.title}>Voice Note</h1>
        <p style={styles.subtitle}>Opening in TypeSmart...</p>
        
        <a href={deepLink} style={styles.button}>
          Open in App
        </a>
        
        <p style={styles.footnote}>
          Don't have TypeSmart?{' '}
          <a 
            href="https://apps.apple.com/app/typesmart" 
            style={styles.link}
          >
            Download it here
          </a>
        </p>
      </div>
      
      {/* Fallback script to try opening the app */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Try to open the app
            window.location.href = "${deepLink}";
            
            // If still on this page after 2 seconds, user probably doesn't have the app
            setTimeout(function() {
              // Could show app store link here
            }, 2000);
          `,
        }}
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { code } = context.params as { code: string };
  
  // Validate code format (should be 8 uppercase hex characters)
  if (!code || !/^[A-Fa-f0-9]{6,8}$/i.test(code)) {
    return {
      props: {
        code: code || '',
        error: 'Invalid voice note code',
      },
    };
  }

  return {
    props: {
      code: code.toUpperCase(),
    },
  };
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '24px',
    padding: '48px 40px',
    textAlign: 'center' as const,
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  emoji: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  title: {
    color: '#ffffff',
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 8px 0',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '16px',
    margin: '0 0 32px 0',
  },
  button: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#ffffff',
    padding: '14px 32px',
    borderRadius: '12px',
    textDecoration: 'none',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  footnote: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '14px',
    marginTop: '24px',
  },
  link: {
    color: '#667eea',
    textDecoration: 'none',
  },
};
