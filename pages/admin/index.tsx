import { useState, useEffect } from 'react';
import Head from 'next/head';

interface User {
  id: string;
  email: string;
  planType: string;
  monthlyCredits: number;
  monthlyCreditsUsed: number;
  bonusCredits: number;
  isVip: boolean;
  isAdmin: boolean;
  adminNotes: string | null;
  createdAt: string;
  lastActiveAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState(50);
  const [creditReason, setCreditReason] = useState('');
  const [stats, setStats] = useState<any>(null);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
      setToken(savedToken);
      setIsLoggedIn(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isLoggedIn && token) {
      fetchUsers();
    }
  }, [isLoggedIn, token, search, planFilter]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setLoginError(data.error || 'Login failed');
        return;
      }
      
      localStorage.setItem('adminToken', data.token);
      setToken(data.token);
      setIsLoggedIn(true);
    } catch (err) {
      setLoginError('Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken('');
    setIsLoggedIn(false);
  };

  const fetchUsers = async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(planFilter !== 'all' && { plan: planFilter }),
      });

      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 403) {
        setLoginError('Admin access required');
        handleLogout();
        return;
      }

      const data = await res.json();
      setUsers(data.users || []);
      setPagination(data.pagination);
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const addCredits = async () => {
    if (!selectedUser) return;

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          credits: creditsToAdd,
          reason: creditReason || 'Admin adjustment',
        }),
      });

      if (res.ok) {
        alert(`Added ${creditsToAdd} credits to ${selectedUser.email}`);
        setSelectedUser(null);
        setCreditsToAdd(50);
        setCreditReason('');
        fetchUsers();
      }
    } catch (err) {
      alert('Failed to add credits');
    }
  };

  const toggleVip = async (user: User) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/vip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isVip: !user.isVip }),
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      alert('Failed to toggle VIP');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Head>
          <title>Admin Login - OpenDoor</title>
        </Head>
        <div className="bg-gray-800 p-8 rounded-xl shadow-xl w-full max-w-md">
          <h1 className="text-2xl font-bold text-white mb-6 text-center">
            🔐 Admin Login
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="••••••••"
              />
            </div>
            {loginError && (
              <div className="text-red-400 text-sm">{loginError}</div>
            )}
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head>
        <title>Admin Dashboard - OpenDoor</title>
      </Head>

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">🎛️ OpenDoor Admin</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Stats */}
      {stats && (
        <div className="px-6 py-4 grid grid-cols-2 gap-4">
          <div className="bg-gray-800 p-4 rounded-xl">
            <div className="text-gray-400 text-sm">Free Users</div>
            <div className="text-2xl font-bold text-green-400">{stats.free || 0}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl">
            <div className="text-gray-400 text-sm">Pro Users</div>
            <div className="text-2xl font-bold text-blue-400">{stats.pro || 0}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 py-4 flex gap-4">
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 bg-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="px-6">
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Plan</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Credits</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Bonus</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">VIP</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-750">
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.email}</div>
                    {user.adminNotes && (
                      <div className="text-xs text-gray-400">{user.adminNotes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      user.planType === 'pro' ? 'bg-blue-600' :
                      user.planType === 'unlimited' ? 'bg-purple-600' : 'bg-gray-600'
                    }`}>
                      {user.planType.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.monthlyCredits - user.monthlyCreditsUsed} / {user.monthlyCredits}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-yellow-400">⭐ {user.bonusCredits}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleVip(user)}
                      className={`px-2 py-1 rounded text-xs ${
                        user.isVip ? 'bg-yellow-600' : 'bg-gray-600'
                      }`}
                    >
                      {user.isVip ? '⭐ VIP' : 'Regular'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition"
                    >
                      + Credits
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 py-4">
            {Array.from({ length: pagination.totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => fetchUsers(i + 1)}
                className={`px-3 py-1 rounded ${
                  pagination.page === i + 1 ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add Credits Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Credits</h2>
            <p className="text-gray-400 mb-4">Adding credits to: {selectedUser.email}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Credits Amount</label>
                <div className="flex gap-2">
                  {[25, 50, 100, 250, 500].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setCreditsToAdd(amount)}
                      className={`px-3 py-2 rounded ${
                        creditsToAdd === amount ? 'bg-blue-600' : 'bg-gray-700'
                      }`}
                    >
                      +{amount}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={creditsToAdd}
                  onChange={(e) => setCreditsToAdd(parseInt(e.target.value) || 0)}
                  className="w-full mt-2 px-4 py-2 bg-gray-700 rounded-lg"
                  placeholder="Custom amount"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-300 mb-2">Reason (optional)</label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg"
                  placeholder="e.g., VIP bonus, compensation..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={addCredits}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition"
              >
                Add {creditsToAdd} Credits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

