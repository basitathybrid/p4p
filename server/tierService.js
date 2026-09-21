const DEFAULT_THRESHOLDS = [
  { name: 'Bronze', minimum: 0 },
  { name: 'Silver', minimum: 5000 },
  { name: 'Gold', minimum: 10000 },
  { name: 'Diamond', minimum: 15000 },
];

const TIER_RANK = Object.fromEntries(DEFAULT_THRESHOLDS.map((tier, index) => [tier.name, index]));

async function getTierThresholds(conn) {
  const [rows] = await conn.query('SELECT tier_name AS name, minimum_volume AS minimum FROM tier_thresholds ORDER BY minimum_volume ASC');
  return rows.length === DEFAULT_THRESHOLDS.length ? rows : DEFAULT_THRESHOLDS;
}

function tierForVolume(volume, thresholds) {
  return [...thresholds].reverse().find((tier) => Number(volume) >= Number(tier.minimum))?.name || 'Bronze';
}

function validateThresholds(thresholds) {
  if (!Array.isArray(thresholds) || thresholds.length !== DEFAULT_THRESHOLDS.length) return false;
  const names = thresholds.map((tier) => tier.name);
  if (DEFAULT_THRESHOLDS.some((tier) => !names.includes(tier.name))) return false;
  const ordered = [...thresholds].sort((left, right) => Number(left.minimum) - Number(right.minimum));
  return ordered[0].name === 'Bronze'
    && Number(ordered[0].minimum) === 0
    && ordered.every((tier, index) => index === 0 || Number(tier.minimum) > Number(ordered[index - 1].minimum));
}

module.exports = { DEFAULT_THRESHOLDS, TIER_RANK, getTierThresholds, tierForVolume, validateThresholds };