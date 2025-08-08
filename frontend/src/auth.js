export function getToken(){ try{return JSON.parse(localStorage.getItem('token'))}catch{return null} }
export function setToken(t){ localStorage.setItem('token', JSON.stringify(t)); }
export function clearToken(){ localStorage.removeItem('token'); localStorage.removeItem('user'); }
export function getUser(){ try{return JSON.parse(localStorage.getItem('user'))}catch{return null} }
export function setUser(u){ localStorage.setItem('user', JSON.stringify(u)); }

export async function api(path, opts={}){
  const token = getToken();
  const headers = { 'Content-Type':'application/json', ...(opts.headers||{}) };
  if(token){ headers['Authorization'] = 'Bearer ' + token; }
  const res = await fetch(path, { ...opts, headers });
  if(!res.ok) throw new Error(await res.text());
  try { return await res.json(); } catch { return null; }
}