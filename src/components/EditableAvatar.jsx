/* Nocta — the profile card's avatar, editable in place: tap it (or "Add a
 * photo") to pick an image; it's centre-cropped to a 256 px square and kept
 * on this device (lib/profile.js › setPhoto). Shared by You on mobile and
 * desktop. */
import { useRef } from 'react';
import { useStore } from '../lib/store.jsx';
import { setPhoto } from '../lib/profile.js';
import { ProfileAvatar } from './ProfileAvatar.jsx';
import { Icon } from './Icons.jsx';

/* centre-crop to a square, like the round avatar shows it */
export function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/* the avatar (a button) plus its hidden file input */
export function EditableAvatar() {
  const { profile, authUser, showToast } = useStore();
  const fileRef = useRef(null);
  const has = Boolean(profile.photo ?? authUser?.photo);
  return (
    <>
      <button
        type="button"
        className="avatar avatar-edit"
        onClick={() => fileRef.current?.click()}
        aria-label={has ? 'Change your photo' : 'Add a photo'}
        title={has ? 'Change photo' : 'Add a photo'}
      >
        <ProfileAvatar user={authUser} />
        <span className="avatar-edit-badge" aria-hidden="true">
          <Icon name="plus" size={12} />
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            setPhoto(await shrink(f));
            showToast('Photo updated', 'check');
          } catch {
            showToast('That image couldn’t be read', 'info');
          }
        }}
      />
    </>
  );
}

/* "Change photo · Remove" under the name (Remove only for an uploaded one) */
export function PhotoLinks() {
  const { profile, authUser } = useStore();
  const has = Boolean(profile.photo ?? authUser?.photo);
  return (
    <div className="ph-photo">
      <button
        type="button"
        className="ob-link"
        onClick={(e) => e.currentTarget.closest('.profile-card')?.querySelector('.avatar-edit')?.click()}
      >
        {has ? 'Change photo' : 'Add a photo'}
      </button>
      {profile.photo && (
        <button type="button" className="ob-link subtle" onClick={() => setPhoto(null)}>
          Remove
        </button>
      )}
    </div>
  );
}
