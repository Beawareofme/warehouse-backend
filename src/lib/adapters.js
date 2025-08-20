export function toLegacyRole(user) {
  // legacy single role string for AdminDashboard.jsx
  if (user.roles?.includes('ADMIN')) return 'admin';
  if (user.roles?.includes('WAREHOUSE_OWNER')) return 'owner';
  if (user.roles?.includes('MERCHANT')) return 'merchant';
  return 'user';
}

export function toPublicCard(w) {
  return {
    id: w.id,
    name: w.title || deriveName(w),
    address: w.addressLine1 || '',
    city: w.city || '',
    state: w.state || '',
    pincode: w.zip || '',
    totalSpace: w.totalSqFt ?? null,
    availableSpace: w.totalSqFt ?? null,
    pricePerSqFt: w.ratePerSqFtPerMonth != null ? Number(w.ratePerSqFtPerMonth) : null,
    latitude: w.latitude ?? null,
    longitude: w.longitude ?? null,
    imageUrl: w.images?.[0]?.url ?? null
  };
}

function deriveName(w) {
  const parts = [w.city, w.state].filter(Boolean).join(', ');
  return parts ? `Warehouse in ${parts}` : 'Warehouse Space';
}
