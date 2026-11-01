export const canAccessPublisherPortal = user => ['PUBLISHER', 'ADMIN'].includes(user?.role);
