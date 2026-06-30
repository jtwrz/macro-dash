const FRED_API_KEY = '0c5ec822b88305af24b391d44ecd7ce6';
const BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

export async function fetchSeries(seriesId, startDate = '2000-01-01', units = 'lin') {
  const params = new URLSearchParams({
    series_id: seriesId,
    observation_start: startDate,
    units,
    api_key: FRED_API_KEY,
    file_type: 'json',
  });
  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`FRED ${seriesId}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.error_message) throw new Error(`FRED ${seriesId}: ${json.error_message}`);
  return json.observations
    .filter(o => o.value !== '.')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
}

export async function fetchMultiple(seriesIds, startDate = '2000-01-01', units = 'lin') {
  const entries = await Promise.all(
    seriesIds.map(id => fetchSeries(id, startDate, units).then(data => [id, data]))
  );
  return Object.fromEntries(entries);
}
