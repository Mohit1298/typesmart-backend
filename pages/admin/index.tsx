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
  archivedAt: string | null;
  isArchived: boolean;
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
  const [archivedFilter, setArchivedFilter] = useState('false'); // Show active by default
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState(50);
  const [creditReason, setCreditReason] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [archivedCount, setArchivedCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

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
  }, [isLoggedIn, token, search, planFilter, archivedFilter]);

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
        archived: archivedFilter,
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
      setArchivedCount(data.archivedCount || 0);
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

  const changePlan = async (user: User, newPlan: 'free' | 'pro') => {
    if (!confirm(`Change ${user.email} to ${newPlan.toUpperCase()} plan?`)) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planType: newPlan }),
      });

      if (res.ok) {
        alert(`Changed ${user.email} to ${newPlan.toUpperCase()}`);
        fetchUsers();
      } else {
        alert('Failed to change plan');
      }
    } catch (err) {
      alert('Failed to change plan');
    } finally {
      setActionLoading(false);
    }
  };

  const archiveUser = async (user: User) => {
    const action = user.isArchived ? 'restore' : 'archive';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${user.email}?`)) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ archived: !user.isArchived }),
      });

      if (res.ok) {
        alert(`Account ${action}d successfully`);
        fetchUsers();
      } else {
        alert(`Failed to ${action} account`);
      }
    } catch (err) {
      alert(`Failed to ${action} account`);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteUser = async (user: User) => {
    if (!confirm(`⚠️ PERMANENTLY DELETE ${user.email}?\n\nThis cannot be undone!`)) return;
    if (!confirm(`Are you SURE? Type the email to confirm:\n${user.email}`)) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        alert(`Deleted ${user.email} permanently`);
        fetchUsers();
      } else {
        alert('Failed to delete account');
      }
    } catch (err) {
      alert('Failed to delete account');
    } finally {
      setActionLoading(false);
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
          <title>Admin Login - TypeSmart</title>
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
        <title>Admin Dashboard - TypeSmart</title>
      </Head>

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">🎛️ TypeSmart Admin</h1>
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
        <div className="px-6 py-4 grid grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-xl">
            <div className="text-gray-400 text-sm">Free Users</div>
            <div className="text-2xl font-bold text-green-400">{stats.free || 0}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl">
            <div className="text-gray-400 text-sm">Pro Users</div>
            <div className="text-2xl font-bold text-blue-400">{stats.pro || 0}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl">
            <div className="text-gray-400 text-sm">Total Users</div>
            <div className="text-2xl font-bold text-white">{pagination?.total || 0}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl">
            <div className="text-gray-400 text-sm">Archived</div>
            <div className="text-2xl font-bold text-orange-400">{archivedCount}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 py-4 flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 bg-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
        <select
          value={archivedFilter}
          onChange={(e) => setArchivedFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="false">Active Only</option>
          <option value="true">Archived Only</option>
          <option value="all">All Users</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="px-6">
        <div className="bg-gray-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Plan</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Credits</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Bonus</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-750 ${user.isArchived ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.email}</div>
                    {user.adminNotes && (
                      <div className="text-xs text-gray-400">{user.adminNotes}</div>
                    )}
                    {user.isArchived && (
                      <div className="text-xs text-orange-400">
                        📦 Archived: {new Date(user.archivedAt!).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => changePlan(user, 'free')}
                        disabled={actionLoading || user.planType === 'free'}
                        className={`px-2 py-1 rounded text-xs font-medium transition ${
                          user.planType === 'free' 
                            ? 'bg-gray-600 cursor-default' 
                            : 'bg-gray-700 hover:bg-gray-600 cursor-pointer'
                        }`}
                      >
                        FREE
                      </button>
                      <button
                        onClick={() => changePlan(user, 'pro')}
                        disabled={actionLoading || user.planType === 'pro'}
                        className={`px-2 py-1 rounded text-xs font-medium transition ${
                          user.planType === 'pro' 
                            ? 'bg-blue-600 cursor-default' 
                            : 'bg-gray-700 hover:bg-blue-600 cursor-pointer'
                        }`}
                      >
                        PRO
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user.monthlyCredits - user.monthlyCreditsUsed} / {user.monthlyCredits}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-yellow-400">⭐ {user.bonusCredits}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleVip(user)}
                        className={`px-2 py-1 rounded text-xs ${
                          user.isVip ? 'bg-yellow-600' : 'bg-gray-600 hover:bg-gray-500'
                        }`}
                      >
                        {user.isVip ? '⭐ VIP' : 'Regular'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition"
                      >
                        + Credits
                      </button>
                      <button
                        onClick={() => archiveUser(user)}
                        disabled={actionLoading}
                        className={`px-2 py-1 rounded text-xs transition ${
                          user.isArchived 
                            ? 'bg-blue-600 hover:bg-blue-700' 
                            : 'bg-orange-600 hover:bg-orange-700'
                        }`}
                      >
                        {user.isArchived ? '↩️ Restore' : '📦 Archive'}
                      </button>
                      <button
                        onClick={() => deleteUser(user)}
                        disabled={actionLoading}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition"
                      >
                        🗑️ Delete
                      </button>
                    </div>
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
                <div className="flex gap-2 flex-wrap">
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
