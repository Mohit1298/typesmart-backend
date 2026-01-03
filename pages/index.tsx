import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <Head>
        <title>OpenDoor Keyboard - AI-Powered Typing</title>
        <meta name="description" content="AI-powered keyboard for iOS" />
      </Head>

      <div className="container mx-auto px-6 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            ⌨️ OpenDoor Keyboard
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            AI-powered iOS keyboard that rephrases, generates, and enhances your text instantly.
          </p>
          
          <div className="flex justify-center gap-4 mb-12">
            <a
              href="#"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold text-lg transition shadow-lg"
            >
              📱 Download App
            </a>
            <Link
              href="/admin"
              className="px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold text-lg transition"
            >
              🔐 Admin Panel
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
            <div className="text-4xl mb-4">✨</div>
            <h3 className="text-xl font-bold mb-2">Rephrase</h3>
            <p className="text-gray-400">Make your text clearer and more professional instantly.</p>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-xl font-bold mb-2">Generate</h3>
            <p className="text-gray-400">Create content from prompts right from your keyboard.</p>
          </div>
          <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
            <div className="text-4xl mb-4">📸</div>
            <h3 className="text-xl font-bold mb-2">Vision</h3>
            <p className="text-gray-400">Paste screenshots and let AI analyze them for you.</p>
          </div>
        </div>

        {/* Pricing */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center mb-12">Simple Pricing</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-8 border border-white/10">
              <h3 className="text-xl font-bold mb-2">Free</h3>
              <div className="text-3xl font-bold mb-4">$0</div>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>✓ 50 requests/month</li>
                <li>✓ Text rephrasing</li>
                <li>✓ Grammar correction</li>
                <li>✓ Formal & casual tone</li>
                <li>✗ Vision features</li>
              </ul>
              <button className="w-full mt-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition">
                Get Started Free
              </button>
            </div>
            <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl p-8 border-2 border-blue-500 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 px-3 py-1 rounded-full text-xs font-bold">
                RECOMMENDED
              </div>
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-3xl font-bold mb-4">$5<span className="text-lg text-gray-400">/mo</span></div>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>✓ 500 requests/month</li>
                <li>✓ All text features</li>
                <li>✓ Vision & screenshots</li>
                <li>✓ Image analysis</li>
                <li>✓ Pay-as-you-go overage</li>
              </ul>
              <button className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition">
                Upgrade to Pro
              </button>
            </div>
          </div>
          
          {/* Credit Packs */}
          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-4">Need more credits? Buy credit packs anytime:</p>
            <div className="flex justify-center gap-4">
              <div className="bg-white/5 px-6 py-3 rounded-xl border border-white/10">
                <span className="font-bold">100 Credits</span> - $1
              </div>
              <div className="bg-white/5 px-6 py-3 rounded-xl border border-white/10">
                <span className="font-bold">500 Credits</span> - $4
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-20 py-8 text-center text-gray-500">
        <p>© 2024 OpenDoor Keyboard. All rights reserved.</p>
      </footer>
    </div>
  );
}

