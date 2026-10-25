export const sameUser = (profile, viewer) => Boolean(viewer &&
  String(profile?._id ?? profile?.id) === String(viewer._id ?? viewer.id));

export const canViewProfile = (profile, viewer) => Boolean(profile && (
  sameUser(profile, viewer) || viewer?.role === 'ADMIN' || (
    profile.isActive !== false && !profile.isDeleted && (
      profile.privacySettings?.isProfilePublic !== false ||
      profile.followers?.some(id => String(id._id ?? id) === String(viewer?._id ?? viewer?.id))
    )
  )
));

export const canViewLibrary = (profile, viewer) => sameUser(profile, viewer) ||
  (canViewProfile(profile, viewer) && profile.privacySettings?.isLibraryPublic !== false);

export const canViewFollowList = (profile, viewer) => sameUser(profile, viewer) ||
  (canViewProfile(profile, viewer) && profile.privacySettings?.isFollowListPublic !== false);

export const canReceiveMessage = (recipient, senderId) => {
  if (!recipient || recipient.isActive === false || recipient.isDeleted) return false;
  const permission = recipient.privacySettings?.allowMessages ?? 'everyone';
  if (permission === 'none') return false;
  // "Sadece takipçiler": the recipient's followers may write to them.
  if (permission === 'followers') return recipient.followers?.some(id => String(id._id ?? id) === String(senderId));
  return true;
};
