'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function ProfilePage() {
  const [current, setCurrent]   = useState('');
  const [newPass, setNewPass]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState('');
  const [error, setError]       = useState('');
  const supabase = createSupabaseBrowserClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');

    if (newPass.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPass !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);

    // Re-authenticate first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setError('Session error. Please sign in again.'); setLoading(false); return; }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (signInErr) { setError('Current password is incorrect.'); setLoading(false); return; }

    // Update password
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPass });
    if (updateErr) { setError(updateErr.message); setLoading(false); return; }

    setSuccess('Password updated successfully.');
    setCurrent(''); setNewPass(''); setConfirm('');
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
          Change Password
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
          Update your password — only you can do this.
        </p>
      </div>

      <div className="pes-card" style={{ padding: '28px 28px 24px' }}>
        {success && (
          <div style={{ marginBottom: 18, padding: '10px 14px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
            ✓ {success}
          </div>
        )}
        {error && (
          <div style={{ marginBottom: 18, padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--red)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>Current Password</label>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required
              className="pes-input" placeholder="••••••••" style={{ fontSize: 13 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>New Password</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required
              className="pes-input" placeholder="Min. 8 characters" style={{ fontSize: 13 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>Confirm New Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="pes-input" placeholder="••••••••" style={{ fontSize: 13 }} />
          </div>

          <button type="submit" disabled={loading} className="pes-btn pes-btn-primary"
            style={{ marginTop: 8, fontSize: 13, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
