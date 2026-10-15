/* Nocta — the person's avatar: a photo they uploaded (Settings), else the
 * photo their sign-in shares (Google), else a neutral placeholder. Never a
 * stand-in photo of someone else. */
import { useStore } from '../lib/store.jsx';

export function PlaceholderAvatar({ className = '' }) {
  return (
    <svg className={`avatar-placeholder ${className}`} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="20" fill="var(--surface-3)" />
      <circle cx="20" cy="16" r="7" fill="var(--text-tertiary)" />
      <path d="M7 36c1.6-7 7-10.5 13-10.5S31.4 29 33 36" fill="var(--text-tertiary)" />
    </svg>
  );
}

export function ProfileAvatar({ user, className = '' }) {
  const { profile } = useStore();
  const photo = profile?.photo ?? user?.photo ?? null;
  if (photo) return <img className={className} src={photo} alt="" />;
  return <PlaceholderAvatar className={className} />;
}
