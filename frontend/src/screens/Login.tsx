import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, apiGet } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import type { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '@/api/types';

type Mode = 'login' | 'register';

export default function Login() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const login = useAuthStore((s) => s.login);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let authResp: AuthResponse;

      if (mode === 'register') {
        const body: RegisterRequest = {
          email: email.trim(),
          password,
          ...(displayName.trim() ? { display_name: displayName.trim() } : {}),
        };
        authResp = await apiPost<AuthResponse>('/auth/register', body);
      } else {
        const body: LoginRequest = {
          email: email.trim(),
          password,
        };
        authResp = await apiPost<AuthResponse>('/auth/login', body);
      }

      // Store the token first so the next request can attach it.
      setToken(authResp.token);

      // Fetch full profile now that we have a valid token.
      const profile = await apiGet<UserProfile>('/auth/me');

      login(authResp.token, authResp.refresh_token, profile);

      navigate('/', { replace: true });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-800">Dialed</h1>
          <p className="text-sm text-gray-500 mt-1">Motorcycle management and tuning</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
          </h2>

          {error && (
            <div
              className="mb-4 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-700"
              data-testid="auth-error"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="display-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Display Name (optional)
                </label>
                <input
                  id="display-name"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your name"
                  data-testid="display-name-input"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="you@example.com"
                data-testid="email-input"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={mode === 'register' ? 'Choose a password' : 'Your password'}
                data-testid="password-input"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-800 text-white py-2 min-h-[44px] rounded-md text-sm font-medium hover:bg-blue-900 disabled:opacity-50 transition-colors"
              data-testid="auth-submit-btn"
            >
              {isSubmitting
                ? mode === 'login'
                  ? 'Signing in...'
                  : 'Creating account...'
                : mode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={toggleMode}
              className="text-blue-800 font-medium hover:underline"
              data-testid="auth-mode-toggle"
            >
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
