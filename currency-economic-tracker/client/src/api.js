const API = import.meta.env.VITE_API_URL
  || (typeof window !== "undefined" ? `http://${window.location.hostname}:5000` : "http://localhost:5000");

export async function api(path) {
  const token = localStorage.getItem("currency_tracker_token");
  const response = await fetch(`${API}/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}
