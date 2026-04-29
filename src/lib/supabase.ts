const BASE = process.env.EXPO_PUBLIC_SUPABASE_URL + '/rest/v1';
const KEY  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  'apikey':        KEY,
  'Authorization': `Bearer ${KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=minimal',
};

export async function insertEvent(record: object) {
  const res = await fetch(`${BASE}/events`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`Supabase insert failed: ${await res.text()}`);
}

export async function fetchEvents(limit = 100): Promise<object[]> {
  const res = await fetch(
    `${BASE}/events?order=timestamp.desc&limit=${limit}`,
    { headers: { ...headers, 'Prefer': 'return=representation' } },
  );
  if (!res.ok) throw new Error(`Supabase fetch failed: ${await res.text()}`);
  return res.json();
}

export async function getLastEvent(txnId: string): Promise<{ event: string; station_name: string } | null> {
  const res = await fetch(
    `${BASE}/events?txn_id=eq.${encodeURIComponent(txnId)}&order=timestamp.desc&limit=1`,
    { headers: { ...headers, 'Prefer': 'return=representation' } },
  );
  if (!res.ok) throw new Error(`Supabase fetch failed: ${await res.text()}`);
  const rows = await res.json();
  return rows[0] ?? null;
}
