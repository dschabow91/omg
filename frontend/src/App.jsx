import { useEffect, useMemo, useState } from "react";
import "./index.css";
import { api, clearToken, getToken, getUser, setToken, setUser } from "./auth";

export default function App() {
  const [user, setUserState] = useState(getUser());
  const [dark, setDark] = useState(() => getLS("dark", true));
  useEffect(()=> setLS("dark", dark), [dark]);
  async function onLogin(email, password){
    const data = await api('/api/auth/login', { method:'POST', body: JSON.stringify({ email, password }) });
    setToken(data.token); setUser(data.user); setUserState(data.user);
  }
  function onLogout(){ clearToken(); setUserState(null); }
  return (
    <div className={tw("min-h-screen", dark ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900")}>
      <header className={tw("sticky top-0 z-20 border-b", dark ? "border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950/90 backdrop-blur":"border-slate-200 bg-gradient-to-r from-white via-sky-50 to-white/80 backdrop-blur")}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center gap-3">
          <Logo />
          <div className="font-semibold text-lg">Motherlode CMMS</div>
          <div className="ml-auto flex items-center gap-2">
            {user && <HeaderStats user={user} /> }
            <button className={btn(dark, "ghost")} onClick={()=>setDark(v=>!v)}>{dark? "Light":"Dark"}</button>
            {user ? <button className={btn(dark, "danger")} onClick={onLogout}>Logout</button> : null}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
        {!user ? <LoginCard dark={dark} onLogin={onLogin} /> : <Home dark={dark} user={user} />}
      </main>
    </div>
  );
}

function LoginCard({ dark, onLogin }){
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  async function submit(e){ e.preventDefault(); setErr(""); try{ await onLogin(email, password); }catch(ex){ setErr("Invalid login"); } }
  return (
    <div className={panel(dark) + " max-w-md mx-auto"}>
      <h2 className="text-xl font-semibold mb-2">Sign in</h2>
      <form className="space-y-3" onSubmit={submit}>
        <label className="space-y-1 block"><span className="text-sm opacity-80">Email</span><input value={email} onChange={e=>setEmail(e.target.value)} className={inputCls(dark)} placeholder="you@motherlode.com" /></label>
        <label className="space-y-1 block"><span className="text-sm opacity-80">Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className={inputCls(dark)} placeholder="••••••••" /></label>
        {err && <div className="text-rose-500 text-sm">{err}</div>}
        <div className="flex justify-end"><button className={btn(dark)}>Log in</button></div>
      </form>
      <p className="text-xs opacity-70 mt-3">Default admin: <code>admin@motherlode.local</code> / <code>admin123</code></p>
    </div>
  );
}

function Home({ dark, user }){
  const [tab, setTab] = useState("Work Orders");
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      <aside className={tw("rounded-2xl p-3 h-fit", dark ? "bg-zinc-900/60 border border-zinc-800":"bg-white border border-slate-200 shadow-sm")}>
        <NavItem label="Work Orders" icon="🧾" active={tab==="Work Orders"} onClick={()=>setTab("Work Orders")} />
        <NavItem label="PM Schedules" icon="🗓️" active={tab==="PM Schedules"} onClick={()=>setTab("PM Schedules")} />
        <NavItem label="Assets" icon="🏷️" active={tab==="Assets"} onClick={()=>setTab("Assets")} />
        <NavItem label="Inventory" icon="📦" active={tab==="Inventory"} onClick={()=>setTab("Inventory")} />
        {user.role === "admin" && <NavItem label="Technicians" icon="👷" active={tab==="Technicians"} onClick={()=>setTab("Technicians")} />}
        <NavItem label="Handoff Board" icon="📌" active={tab==="Handoff Board"} onClick={()=>setTab("Handoff Board")} />
        <NavItem label="Daily Reports" icon="📝" active={tab==="Daily Reports"} onClick={()=>setTab("Daily Reports")} />
        <NavItem label="Reports" icon="📊" active={tab==="Reports"} onClick={()=>setTab("Reports")} />
      </aside>

      <section className="min-h-[70vh] space-y-4">
        {tab === "Work Orders" && <WorkOrdersView dark={dark} user={user} />}
        {tab === "PM Schedules" && <PMView dark={dark} user={user} />}
        {tab === "Assets" && <AssetsView dark={dark} user={user} />}
        {tab === "Inventory" && <InventoryView dark={dark} user={user} />}
        {tab === "Technicians" && user.role === "admin" && <TechsView dark={dark} />}
        {tab === "Handoff Board" && <HandoffView dark={dark} user={user} />}
        {tab === "Daily Reports" && <DailyReportsView dark={dark} user={user} />}
        {tab === "Reports" && <ReportsView dark={dark} />}
      </section>
    </div>
  );
}

// -------- Header bits --------
function HeaderStats({ user }){
  const [wos,setWos]=useState([]); const [handoffs,setH]=useState([]);
  useEffect(()=>{ (async()=>{ try{ setWos(await api('/api/workorders')); setH(await api('/api/handoffs')); }catch{} })(); }, []);
  const mineWOs = wos.filter(w=> (w.assignedTo||"").toLowerCase() === user.name.toLowerCase() && !["Completed","Canceled"].includes(w.status)).length;
  const myH = handoffs.filter(h=> (h.assignedTo||"").toLowerCase() === user.name.toLowerCase() && h.status!=="Done").length;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="opacity-80">{user.name} · {user.role}</span>
      <span className="px-2 py-0.5 rounded-full bg-sky-600 text-white">My WOs: {mineWOs}</span>
      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white">Handoffs: {myH}</span>
    </div>
  );
}

// ======= Work Orders =======
function WorkOrdersView({ dark, user }){
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState(""); const [status, setStatus] = useState("All");
  const [assignee, setAssignee] = useState("All");
  const [modal, setModal] = useState(false); const [editing, setEditing] = useState(null);

  async function load(){ setRows(await api('/api/workorders')); }
  useEffect(()=>{ load(); }, []);

  const filtered = useMemo(()=> rows
    .filter(w => status==="All" ? true : w.status===status)
    .filter(w => assignee==="All" ? true : (w.assignedTo||"")===assignee)
    .filter(w => q ? [w.title,w.asset,w.location,w.description].join(" ").toLowerCase().includes(q.toLowerCase()) : true)
    .sort((a,b)=> b.createdAt - a.createdAt), [rows,q,status,assignee]);

  async function save(data){
    if(editing){ await api('/api/workorders/'+editing.id, { method:'PUT', body: JSON.stringify(data) }); }
    else { await api('/api/workorders', { method:'POST', body: JSON.stringify(data) }); }
    setModal(false); setEditing(null); await load();
  }
  async function del(id){ if(!confirm("Delete WO?")) return; await api('/api/workorders/'+id, { method:'DELETE' }); await load(); }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold">Work Orders</h2>
        <span className="opacity-70">({filtered.length})</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <input placeholder="Search..." value={q} onChange={e=>setQ(e.target.value)} className={inputCls(dark)} />
          <select value={status} onChange={e=>setStatus(e.target.value)} className={inputCls(dark)}>{["All","Open","In Progress","On Hold","Completed","Canceled"].map(s=><option key={s}>{s}</option>)}</select>
          <input placeholder="Assignee (exact)" value={assignee==="All"?"":assignee} onChange={e=>setAssignee(e.target.value||"All")} className={inputCls(dark)} />
          <button className={btn(dark)} onClick={()=>{setEditing(null); setModal(true);}}>+ New</button>
        </div>
      </div>
      <div className="text-xs opacity-70">Only the creator (or admin) can edit/delete a WO.</div>

      <div className="flex flex-wrap gap-2">
        <button className={btn(dark,"ghost")} onClick={()=>{
          const name = prompt("Save view as?"); if(!name) return;
          const views = JSON.parse(localStorage.getItem('woViews')||'{}');
          views[name] = { q, status, assignee };
          localStorage.setItem('woViews', JSON.stringify(views));
          alert('Saved: ' + name);
        }}>Save View</button>
        <button className={btn(dark,"ghost")} onClick={()=>{
          const views = JSON.parse(localStorage.getItem('woViews')||'{}');
          const names = Object.keys(views); if(names.length===0) return alert('No saved views');
          const pick = prompt('Load view: ' + names.join(', ')); if(!pick || !views[pick]) return;
          const v = views[pick]; setQ(v.q||''); setStatus(v.status||'All'); setAssignee(v.assignee||'All');
        }}>Load View</button>
        <button className={btn(dark,"ghost")} onClick={()=>{
          const views = JSON.parse(localStorage.getItem('woViews')||'{}');
          const names = Object.keys(views); if(names.length===0) return alert('No saved views');
          const pick = prompt('Delete view: ' + names.join(', ')); if(!pick || !views[pick]) return;
          delete views[pick]; localStorage.setItem('woViews', JSON.stringify(views)); alert('Deleted');
        }}>Delete View</button>
      </div>

      <div className={panel(dark)}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left uppercase text-xs opacity-70"><tr><th className="p-2">ID</th><th className="p-2">Title</th><th className="p-2">Asset</th><th className="p-2">Priority</th><th className="p-2">Assigned</th><th className="p-2">Status</th><th className="p-2">Due</th><th className="p-2">Owner</th><th className="p-2">Created</th><th className="p-2 text-right">Actions</th></tr></thead>
            <tbody>
              {filtered.map(w=>(
                <tr key={w.id} className="border-t border-black/10 dark:border-white/10">
                  <td className="p-2 font-mono text-xs">{shortId(w.id)}</td>
                  <td className="p-2 font-medium">{w.title}</td>
                  <td className="p-2">{w.asset || "—"}</td>
                  <td className="p-2"><Badge color={prioColor(w.priority)}>{w.priority}</Badge></td>
                  <td className="p-2">{w.assignedTo || "Unassigned"}</td>
                  <td className="p-2">{w.status}</td>
                  <td className="p-2 text-xs">{w.dueDate ? (<Badge color={(new Date(w.dueDate) < new Date() && !["Completed","Canceled"].includes(w.status))?"red":"blue"}>{w.dueDate}</Badge>): "—"}</td>
                  <td className="p-2 text-xs">{w.createdBy===user.id? <Badge color="emerald">You</Badge>: <Badge>{w.createdBy?.slice(0,6) || "—"}</Badge>}</td>
                  <td className="p-2 text-xs opacity-70">{new Date(w.createdAt).toLocaleString()}</td>
                  <td className="p-2 text-right space-x-2 whitespace-nowrap">
                    <button className={btn(dark,"ghost")} onClick={async()=>{ await api('/api/workorders/'+w.id, { method:'PUT', body: JSON.stringify({ assignedTo: user.name }) }); await load(); }}>Assign to me</button>
                    <button className={btn(dark,"ghost")} onClick={()=>{setEditing(w); setModal(true);}} disabled={!(user.role==='admin' || w.createdBy===user.id)}>Edit</button>
                    <button className={btn(dark,"danger")} onClick={()=>del(w.id)} disabled={!(user.role==='admin' || w.createdBy===user.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td className="p-6 text-center opacity-70" colSpan={10}>No WOs.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <Modal dark={dark} onClose={()=>{setModal(false); setEditing(null);}}><WOForm dark={dark} initial={editing || { title:"", description:"", asset:"", location:"", priority:"Medium", assignedTo:"", status:"Open", dueDate:"", checklist:[] }} onSave={save} /></Modal>}
    </div>
  );
}

function WOForm({ dark, initial, onSave }){
  const [form, setForm] = useState(initial);
  function set(k,v){ setForm(p=>({...p,[k]:v})) }
  return (
    <form className="space-y-3" onSubmit={e=>{e.preventDefault(); onSave(form);}}>
      <h3 className="text-lg font-semibold">{initial?.id? "Edit Work Order":"New Work Order"}</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="space-y-1"><span className="text-sm opacity-80">Title</span><input required value={form.title} onChange={e=>set("title",e.target.value)} className={inputCls(dark)} /></label>
        <label className="space-y-1"><span className="text-sm opacity-80">Asset</span><input value={form.asset} onChange={e=>set("asset",e.target.value)} className={inputCls(dark)} /></label>
        <label className="space-y-1"><span className="text-sm opacity-80">Location</span><input value={form.location} onChange={e=>set("location",e.target.value)} className={inputCls(dark)} /></label>
        <label className="space-y-1"><span className="text-sm opacity-80">Priority</span><select value={form.priority} onChange={e=>set("priority",e.target.value)} className={inputCls(dark)}>{["Low","Medium","High","Critical"].map(o=><option key={o}>{o}</option>)}</select></label>
        <label className="space-y-1"><span className="text-sm opacity-80">Assign To</span><input value={form.assignedTo||""} onChange={e=>set("assignedTo",e.target.value)} className={inputCls(dark)} placeholder="Tech name (optional)"/></label>
        <label className="space-y-1"><span className="text-sm opacity-80">Status</span><select value={form.status} onChange={e=>set("status",e.target.value)} className={inputCls(dark)}>{["Open","In Progress","On Hold","Completed","Canceled"].map(o=><option key={o}>{o}</option>)}</select></label>
        <label className="space-y-1"><span className="text-sm opacity-80">Due Date</span><input type="date" value={form.dueDate||""} onChange={e=>set("dueDate",e.target.value)} className={inputCls(dark)} /></label>
      </div>
      <label className="space-y-1 block"><span className="text-sm opacity-80">Description</span><textarea rows={4} value={form.description} onChange={e=>set("description",e.target.value)} className={inputCls(dark)} /></label>
      {initial?.id && <WOComments dark={dark} woId={initial.id} />}
      <div className="mt-4 border-t pt-3 dark:border-zinc-800">
        <div className="text-sm font-medium mb-2">Checklist</div>
        <ChecklistEditor dark={dark} items={form.checklist||[]} onChange={(items)=>set("checklist", items)} />
      </div>
      <div className="flex items-center justify-end gap-2 pt-2"><button type="button" className={btn(dark,"ghost")} onClick={(e)=>{e.preventDefault(); window.dispatchEvent(new CustomEvent('modal:close'));}}>Cancel</button><button className={btn(dark)}>{initial?.id? "Save":"Create"}</button></div>
    </form>
  );
}

function WOComments({ dark, woId }){
  const [list, setList] = useState([]);
  const [text, setText] = useState("");
  async function load(){ try{ setList(await api('/api/workorders/'+woId+'/comments')); }catch{} }
  useEffect(()=>{ load(); }, [woId]);
  async function send(){ if(!text.trim()) return; await api('/api/workorders/'+woId+'/comments', { method:'POST', body: JSON.stringify({ text }) }); setText(""); await load(); }
  async function remove(id){ await api('/api/workorders/'+woId+'/comments/'+id, { method:'DELETE' }); await load(); }
  return (
    <div className="mt-4 border-t pt-3 dark:border-zinc-800">
      <div className="text-sm font-medium mb-2">Comments</div>
      <div className="space-y-2 max-h-48 overflow-auto pr-1">
        {list.map(c=> (
          <div key={c.id} className="text-sm flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-sky-600 text-white grid place-items-center text-xs">{(c.userName||'?').slice(0,2).toUpperCase()}</div>
            <div className="flex-1">
              <div className="text-xs opacity-70">{c.userName} • {new Date(c.createdAt).toLocaleString()}</div>
              <span dangerouslySetInnerHTML={{__html: highlightMentions(c.text)}} />
            </div>
            <button className={btn(dark,"ghost")} onClick={()=>remove(c.id)}>Delete</button>
          </div>
        ))}
        {list.length===0 && <div className="text-xs opacity-70">No comments yet.</div>}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <input value={text} onChange={e=>setText(e.target.value)} className={inputCls(dark)} placeholder="Write a comment… use @name to mention" />
        <button className={btn(dark)} onClick={send}>Send</button>
      </div>
    </div>
  );
}

// ======= PM =======
function PMView({ dark, user }){
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false); const [editing, setEditing] = useState(null);
  async function load(){ setRows(await api('/api/pms')); } useEffect(()=>{ load(); }, []);
  function nd(startDate, freq, interval){ const start=new Date(startDate); const now=new Date(); const next=new Date(start); while(next<now){ if(freq==="Daily") next.setDate(next.getDate()+interval); if(freq==="Weekly") next.setDate(next.getDate()+7*interval); if(freq==="Monthly") next.setMonth(next.getMonth()+interval);} return next.toISOString().slice(0,10); }
  async function save(data){ if(editing){ await api('/api/pms/'+editing.id, { method:'PUT', body: JSON.stringify(data) }); } else { await api('/api/pms', { method:'POST', body: JSON.stringify(data) }); } setModal(false); setEditing(null); await load(); }
  async function del(id){ if(!confirm("Delete PM?")) return; await api('/api/pms/'+id, { method:'DELETE' }); await load(); }
  return (<div className="space-y-2">
    <div className="flex items-center gap-2"><h2 className="text-xl font-semibold">PM Schedules</h2>{user.role==='admin' && <div className="ml-auto"><button className={btn(dark)} onClick={()=>{setEditing(null); setModal(true);}}>+ New PM</button></div>}</div>
    <div className={panel(dark)}><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left uppercase text-xs opacity-70"><tr><th className="p-2">Asset</th><th className="p-2">Task</th><th className="p-2">Start</th><th className="p-2">Freq</th><th className="p-2">Int</th><th className="p-2">Next Due</th>{user.role==='admin' && <th className="p-2 text-right">Actions</th>}</tr></thead><tbody>
      {rows.map(pm=> <tr key={pm.id} className="border-t border-black/10 dark:border-white/10"><td className="p-2 font-medium">{pm.asset}</td><td className="p-2">{pm.task}</td><td className="p-2">{pm.startDate}</td><td className="p-2">{pm.frequency}</td><td className="p-2">{pm.interval||1}</td><td className="p-2"><Badge color="blue">{nd(pm.startDate, pm.frequency, Number(pm.interval||1))}</Badge></td>{user.role==='admin' && <td className="p-2 text-right space-x-2"><button className={btn(dark,"ghost")} onClick={()=>{setEditing(pm); setModal(true);}}>Edit</button><button className={btn(dark,"danger")} onClick={()=>del(pm.id)}>Delete</button></td>}</tr>)}
      {rows.length===0 && <tr><td className="p-6 text-center opacity-70" colSpan={7}>No PM schedules yet.</td></tr>}
    </tbody></table></div></div>
    {modal && <Modal dark={dark} onClose={()=>{setModal(false); setEditing(null);}}><PMForm dark={dark} initial={editing || { asset:"", task:"", startDate: new Date().toISOString().slice(0,10), frequency:"Monthly", interval: 1 }} onSave={save} /></Modal>}
  </div>);
}
function PMForm({ dark, initial, onSave }){ const [form, setForm] = useState(initial); function set(k,v){ setForm(p=>({...p,[k]:v})) } return (<form className="space-y-3" onSubmit={e=>{e.preventDefault(); onSave(form);}}><h3 className="text-lg font-semibold">{initial?.id? "Edit PM":"New PM"}</h3><div className="grid sm:grid-cols-2 gap-3">
  <label className="space-y-1"><span className="text-sm opacity-80">Asset</span><input required value={form.asset} onChange={e=>set("asset",e.target.value)} className={inputCls(dark)} /></label>
  <label className="space-y-1"><span className="text-sm opacity-80">Task</span><input required value={form.task} onChange={e=>set("task",e.target.value)} className={inputCls(dark)} /></label>
  <label className="space-y-1"><span className="text-sm opacity-80">Start Date</span><input type="date" value={form.startDate} onChange={e=>set("startDate",e.target.value)} className={inputCls(dark)} /></label>
  <label className="space-y-1"><span className="text-sm opacity-80">Frequency</span><select value={form.frequency} onChange={e=>set("frequency",e.target.value)} className={inputCls(dark)}>{["Daily","Weekly","Monthly"].map(o=> <option key={o}>{o}</option>)}</select></label>
  <label className="space-y-1"><span className="text-sm opacity-80">Interval</span><input type="number" min="1" value={form.interval} onChange={e=>set("interval",Number(e.target.value))} className={inputCls(dark)} /></label>
</div><div className="flex items-center justify-end gap-2 pt-2"><button type="button" className={btn(dark,"ghost")} onClick={(e)=>{e.preventDefault(); window.dispatchEvent(new CustomEvent('modal:close'));}}>Cancel</button><button className={btn(dark)}>{initial?.id? "Save":"Create"}</button></div></form>);}

// ======= Assets =======
function AssetsView({ dark, user }){
  const [qr, setQR] = useState(null);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState(""); const [modal,setModal]=useState(false); const [editing,setEditing]=useState(null);
  async function load(){ setRows(await api('/api/assets')); } useEffect(()=>{ load(); }, []);
  const filtered = useMemo(()=> rows.filter(a => q ? (a.name + ' ' + (a.category||'') + ' ' + (a.location||'')).toLowerCase().includes(q.toLowerCase()) : true).sort((a,b)=> a.name.localeCompare(b.name)), [rows,q]);
  async function save(data){ if(editing){ await api('/api/assets/'+editing.id, { method:'PUT', body: JSON.stringify(data) }); } else { await api('/api/assets', { method:'POST', body: JSON.stringify(data) }); } setModal(false); setEditing(null); await load(); }
  async function delItem(id){ if(!confirm('Delete asset?')) return; await api('/api/assets/'+id, { method:'DELETE' }); await load(); }
  return (<div className="space-y-3"><div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Assets</h2><div className="ml-auto flex gap-2"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search assets" className={inputCls(dark)} />{user.role==='admin' && <button className={btn(dark)} onClick={()=>{setEditing(null); setModal(true);}}>+ New Asset</button>}</div></div><div className={panel(dark)}>{filtered.length===0 ? <div className="p-8 text-center text-sm opacity-70">No assets yet.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left uppercase text-xs opacity-70"><tr><th className="p-2">Name</th><th className="p-2">Category</th><th className="p-2">Location</th><th className="p-2">Criticality</th><th className="p-2">Notes</th>{user.role==='admin' && <th className="p-2 text-right">Actions</th>}</tr></thead><tbody>{filtered.map(a=> (<tr key={a.id} className="border-t border-black/10 dark:border-white/10"><td className="p-2 font-medium">{a.name}</td><td className="p-2">{a.category||"—"}</td><td className="p-2">{a.location||"—"}</td><td className="p-2">{a.criticality||"—"}</td><td className="p-2 whitespace-pre-wrap">{a.notes||"—"}</td>{user.role==='admin' && <td className="p-2 text-right space-x-2 whitespace-nowrap"><button className={btn(dark,'ghost')} onClick={()=>{setEditing(a); setModal(true);}}>Edit</button>
                  <button className={btn(dark,'ghost')} onClick={()=> setQR(a)}>QR</button><button className={btn(dark,'danger')} onClick={()=>delItem(a.id)}>Delete</button></td>}</tr>))}</tbody></table></div>}</div>{modal && <Modal dark={dark} onClose={()=>{setModal(false); setEditing(null);}}><AssetForm dark={dark} initial={editing || { name:'', category:'', location:'', criticality:'Medium', notes:'' }} onSave={save} /></Modal>}
      {qr && <AssetQRModal dark={dark} asset={qr} onClose={()=> setQR(null)} />}</div>);
}
function AssetForm({ dark, initial, onSave }){ const [form, setForm] = useState(initial); function set(k,v){ setForm(p=>({...p,[k]:v})) } return (<form className="space-y-3" onSubmit={e=>{e.preventDefault(); onSave(form);}}><h3 className="text-lg font-semibold">{initial?.id? "Edit Asset":"New Asset"}</h3><div className="grid sm:grid-cols-2 gap-3"><label className="space-y-1"><span className="text-sm opacity-80">Name</span><input required value={form.name} onChange={e=>set('name',e.target.value)} className={inputCls(dark)} /></label><label className="space-y-1"><span className="text-sm opacity-80">Category</span><input value={form.category} onChange={e=>set('category',e.target.value)} className={inputCls(dark)} /></label><label className="space-y-1"><span className="text-sm opacity-80">Location</span><input value={form.location} onChange={e=>set('location',e.target.value)} className={inputCls(dark)} /></label><label className="space-y-1"><span className="text-sm opacity-80">Criticality</span><select value={form.criticality} onChange={e=>set('criticality',e.target.value)} className={inputCls(dark)}>{['Low','Medium','High','Critical'].map(o=> <option key={o}>{o}</option>)}</select></label></div><label className="space-y-1 block"><span className="text-sm opacity-80">Notes</span><textarea rows={3} value={form.notes} onChange={e=>set('notes',e.target.value)} className={inputCls(dark)} /></label><div className="flex items-center justify-end gap-2 pt-2"><button type="button" className={btn(dark,'ghost')} onClick={(e)=>{e.preventDefault(); window.dispatchEvent(new CustomEvent('modal:close'));}}>Cancel</button><button className={btn(dark)}>{initial?.id? "Save":"Create"}</button></div></form>);}

// ======= Inventory =======
function InventoryView({ dark, user }){
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  async function load(){ setRows(await api('/api/inventory')); } useEffect(()=>{ load(); }, []);
  const filtered = useMemo(()=> rows.filter(i => search ? (i.name + " " + i.sku).toLowerCase().includes(search.toLowerCase()):true).sort((a,b)=> a.name.localeCompare(b.name)), [rows,search]);
  async function save(data){ if(editing){ await api('/api/inventory/'+editing.id, { method:'PUT', body: JSON.stringify(data) }); } else { await api('/api/inventory', { method:'POST', body: JSON.stringify(data) }); } setModal(false); setEditing(null); await load(); }
  async function delItem(id){ if(!confirm("Delete item?")) return; await api('/api/inventory/'+id, { method:'DELETE' }); await load(); }
  async function adjQty(id, delta){ const it = rows.find(r=>r.id===id); if(!it) return; await api('/api/inventory/'+id, { method:'PUT', body: JSON.stringify({ qty: Math.max(0, (it.qty||0)+delta) }) }); await load(); }
  return (<div className="space-y-3"><div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Inventory</h2><div className="ml-auto flex gap-2"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items" className={inputCls(dark)} />{user.role==='admin' && <button className={btn(dark)} onClick={()=>{setEditing(null); setModal(true);}}>+ Add Item</button>}</div></div><div className={panel(dark)}>{filtered.length === 0 ? (<div className="p-8 text-center"><img src="/src/assets/empty-shelf.svg" alt="Empty" className="mx-auto w-40 opacity-80" /><div className="mt-3 text-sm opacity-80">No inventory yet. {user.role==='admin' ? "Add your first item.":"Ask an admin to add items."}</div></div>) : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left uppercase text-xs opacity-70"><tr><th className="p-2">Name</th><th className="p-2">SKU</th><th className="p-2">Qty</th><th className="p-2">Min</th><th className="p-2">Status</th><th className="p-2 text-right">Actions</th></tr></thead><tbody>{filtered.map(item=>(<tr key={item.id} className="border-t border-black/10 dark:border-white/10"><td className="p-2 font-medium">{item.name}</td><td className="p-2 font-mono text-xs">{item.sku}</td><td className="p-2">{item.qty}</td><td className="p-2">{item.min}</td><td className="p-2">{(item.qty||0) <= (item.min||0) ? <Badge color="amber">Low</Badge>: <Badge color="emerald">OK</Badge>}</td><td className="p-2 text-right space-x-2 whitespace-nowrap"><button className={btn(dark,"ghost")} onClick={()=>adjQty(item.id, +1)}>+1</button><button className={btn(dark,"ghost")} onClick={()=>adjQty(item.id, -1)}>-1</button>{user.role==='admin' && <><button className={btn(dark,"ghost")} onClick={()=>{setEditing(item); setModal(true);}}>Edit</button><button className={btn(dark,"danger")} onClick={()=>delItem(item.id)}>Delete</button></>}</td></tr>))}{filtered.length===0 && <tr><td className="p-6 text-center opacity-70" colSpan={6}>No items.</td></tr>}</tbody></table></div>)}</div>{modal && <Modal dark={dark} onClose={()=>{setModal(false); setEditing(null);}}><InventoryForm dark={dark} initial={editing || { name:"", sku:"", qty:0, min:5 }} onSave={save} /></Modal>}</div>);
}
function InventoryForm({ dark, initial, onSave }){ const [form, setForm] = useState(initial); function set(k,v){ setForm(p=>({...p,[k]:v})) } return (<form className="space-y-3" onSubmit={e=>{e.preventDefault(); onSave(form);}}><h3 className="text-lg font-semibold">{initial?.id? "Edit Item":"Add Item"}</h3><div className="grid sm:grid-cols-2 gap-3"><label className="space-y-1"><span className="text-sm opacity-80">Name</span><input required value={form.name} onChange={e=>set("name",e.target.value)} className={inputCls(dark)} /></label><label className="space-y-1"><span className="text-sm opacity-80">SKU</span><input value={form.sku} onChange={e=>set("sku",e.target.value)} className={inputCls(dark)} /></label><label className="space-y-1"><span className="text-sm opacity-80">Quantity</span><input type="number" min="0" value={form.qty} onChange={e=>set("qty",Number(e.target.value))} className={inputCls(dark)} /></label><label className="space-y-1"><span className="text-sm opacity-80">Minimum</span><input type="number" min="0" value={form.min} onChange={e=>set("min",Number(e.target.value))} className={inputCls(dark)} /></label></div><div className="flex items-center justify-end gap-2 pt-2"><button type="button" className={btn(dark,"ghost")} onClick={(e)=>{e.preventDefault(); window.dispatchEvent(new CustomEvent('modal:close'));}}>Cancel</button><button className={btn(dark)}>{initial?.id? "Save":"Create"}</button></div></form>);}

// ======= Handoff =======
function HandoffView({ dark, user }){
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState(""); const [status,setStatus]=useState("All");
  const [modal, setModal] = useState(false); const [editing, setEditing] = useState(null);
  async function load(){ setRows(await api('/api/handoffs')); } useEffect(()=>{ load(); }, []);
  const filtered = useMemo(()=> rows.filter(h=> status==="All" ? true : h.status===status).filter(h=> q ? (h.title+" "+h.notes).toLowerCase().includes(q.toLowerCase()) : true).sort((a,b)=> (a.status===b.status ? (a.dueDate||'').localeCompare(b.dueDate||'') : a.status.localeCompare(b.status))), [rows,q,status]);
  async function save(data){ if(editing){ await api('/api/handoffs/'+editing.id, { method:'PUT', body: JSON.stringify(data) }); } else { await api('/api/handoffs', { method:'POST', body: JSON.stringify(data) }); } setModal(false); setEditing(null); await load(); }
  async function del(id){ if(!confirm("Delete handoff?")) return; await api('/api/handoffs/'+id, { method:'DELETE' }); await load(); }
  async function quickStatus(h, s){ await api('/api/handoffs/'+h.id, { method:'PUT', body: JSON.stringify({ status:s }) }); await load(); }
  return (<div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">Handoff Board</h2><div className="ml-auto flex gap-2"><input placeholder="Search..." value={q} onChange={e=>setQ(e.target.value)} className={inputCls(dark)} /><select value={status} onChange={e=>setStatus(e.target.value)} className={inputCls(dark)}>{["All","Open","Picked Up","Done"].map(s=><option key={s}>{s}</option>)}</select><button className={btn(dark)} onClick={()=>{setEditing(null); setModal(true);}}>+ New</button></div></div><div className="text-xs opacity-70">Techs can edit/delete their own handoffs; Admin can manage all.</div><div className="grid md:grid-cols-3 gap-3">{["Open","Picked Up","Done"].map(col=> (<div key={col} className={panel(dark)}><div className="flex items-center justify-between mb-2"><div className="font-semibold">{col}</div></div><div className="space-y-2">{filtered.filter(h=>h.status===col).map(h=> (<div key={h.id} className="rounded-xl border p-3 dark:border-zinc-800"><div className="flex items-center justify-between"><div className="font-medium">{h.title} {h.priority==='High' && <Badge color="red">High</Badge>}</div><div className="text-xs opacity-70">{h.dueDate||''}</div></div><div className="text-sm opacity-90 whitespace-pre-wrap mt-1">{h.notes}</div><div className="text-xs mt-2 opacity-70">Assigned: {h.assignedTo||"—"}</div><div className="flex gap-2 mt-2 justify-end"><button className={btn(dark,"ghost")} onClick={()=>quickStatus(h, col==="Open"?"Picked Up":"Done")}>{col==="Open"?"Pick Up":"Mark Done"}</button><button className={btn(dark,"ghost")} onClick={()=>{setEditing(h); setModal(true);}}>Edit</button><button className={btn(dark,"danger")} onClick={()=>del(h.id)}>Delete</button></div></div>))}{filtered.filter(h=>h.status===col).length===0 && <div className="text-sm opacity-60">No items.</div>}</div></div>))}</div>{modal && <Modal dark={dark} onClose={()=>{setModal(false); setEditing(null);}}><HandoffForm dark={dark} initial={editing || { title:"", notes:"", priority:"Medium", dueDate:new Date(Date.now()+86400000).toISOString().slice(0,10), assignedTo:"", status:"Open" }} onSave={save} /></Modal>}</div>);
}
function HandoffForm({ dark, initial, onSave }){ const [form, setForm] = useState(initial); function set(k,v){ setForm(p=>({...p,[k]:v})) } return (<form className="space-y-3" onSubmit={e=>{e.preventDefault(); onSave(form);}}><h3 className="text-lg font-semibold">{initial?.id? "Edit Handoff":"New Handoff"}</h3><div className="grid sm:grid-cols-2 gap-3"><label className="space-y-1"><span className="text-sm opacity-80">Title</span><input required value={form.title} onChange={e=>set("title",e.target.value)} className={inputCls(dark)} /></label><label className="space-y-1"><span className="text-sm opacity-80">Priority</span><select value={form.priority} onChange={e=>set("priority",e.target.value)} className={inputCls(dark)}>{["Low","Medium","High"].map(o=> <option key={o}>{o}</option>)}</select></label><label className="space-y-1"><span className="text-sm opacity-80">Due Date</span><input type="date" value={form.dueDate} onChange={e=>set("dueDate",e.target.value)} className={inputCls(dark)} /></label><label className="space-y-1"><span className="text-sm opacity-80">Assign To (name)</span><input value={form.assignedTo||""} onChange={e=>set("assignedTo",e.target.value)} className={inputCls(dark)} /></label></div><label className="space-y-1 block"><span className="text-sm opacity-80">Notes</span><textarea rows={4} value={form.notes} onChange={e=>set("notes",e.target.value)} className={inputCls(dark)} /></label><div className="flex items-center justify-end gap-2 pt-2"><button type="button" className={btn(dark,"ghost")} onClick={(e)=>{e.preventDefault(); window.dispatchEvent(new CustomEvent('modal:close'));}}>Cancel</button><button className={btn(dark)}>{initial?.id? "Save":"Create"}</button></div></form>);}

// ======= Daily Reports =======
function DailyReportsView({ dark, user }){
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(false); const [editing, setEditing] = useState(null);
  async function load(){ setRows(await api('/api/reports')); } useEffect(()=>{ load(); }, []);
  async function save(data){ if(editing){ await api('/api/reports/'+editing.id, { method:'PUT', body: JSON.stringify(data) }); } else { await api('/api/reports', { method:'POST', body: JSON.stringify(data) }); } setModal(false); setEditing(null); await load(); }
  async function del(id){ if(!confirm("Delete report?")) return; await api('/api/reports/'+id, { method:'DELETE' }); await load(); }
  return (<div className="space-y-2"><div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Daily Reports</h2><div className="ml-auto"><button className={btn(dark)} onClick={()=>{setEditing(null); setModal(true);}}>+ New Report</button></div></div><div className={panel(dark)}><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left uppercase text-xs opacity-70"><tr><th className="p-2">Date</th><th className="p-2">Tech</th><th className="p-2">Shift</th><th className="p-2">Tasks</th><th className="p-2">Issues</th><th className="p-2">Parts</th><th className="p-2">Hours</th><th className="p-2">Next Day</th><th className="p-2">Images</th><th className="p-2 text-right">Actions</th></tr></thead><tbody>{rows.map(r=> (<tr key={r.id} className="border-t border-black/10 dark:border-white/10"><td className="p-2">{r.date}</td><td className="p-2">{r.userName}</td><td className="p-2">{r.shift||""}</td><td className="p-2 whitespace-pre-wrap">{r.tasksCompleted}</td><td className="p-2 whitespace-pre-wrap">{r.issues}</td><td className="p-2">{r.partsUsed}</td><td className="p-2">{r.hours}</td><td className="p-2 whitespace-pre-wrap">{r.nextDayNotes}</td><td className="p-2">{(r.imageUrls||[]).slice(0,3).map((u,i)=> <a key={i} href={u} target="_blank" className="underline block">image {i+1}</a>)}</td><td className="p-2 text-right space-x-2"><button className={btn(dark,"ghost")} onClick={()=>{setEditing(r); setModal(true);}}>Edit</button><button className={btn(dark,"danger")} onClick={()=>del(r.id)}>Delete</button></td></tr>))}{rows.length===0 && <tr><td className="p-6 text-center opacity-70" colSpan={10}>No reports yet.</td></tr>}</tbody></table></div></div>{modal && <Modal dark={dark} onClose={()=>{setModal(false); setEditing(null);}}><DailyForm dark={dark} initial={editing || { date: new Date().toISOString().slice(0,10), shift:"Day", tasksCompleted:"", issues:"", partsUsed:"", hours:8, nextDayNotes:"", imageUrls:[] }} onSave={save} /></Modal>}</div>);
}
function DailyForm({ dark, initial, onSave }){ const [form, setForm] = useState(initial); function set(k,v){ setForm(p=>({...p,[k]:v})) } function addImg(){ const url = prompt("Paste image URL"); if(!url) return; set("imageUrls", [...(form.imageUrls||[]), url]); } function delImg(i){ const arr = [...(form.imageUrls||[])]; arr.splice(i,1); set("imageUrls", arr); } return (<form className="space-y-3" onSubmit={e=>{e.preventDefault(); onSave(form);}}><h3 className="text-lg font-semibold">{initial?.id? "Edit Report":"New Report"}</h3><div className="grid sm:grid-cols-2 gap-3"><label className="space-y-1"><span className="text-sm opacity-80">Date</span><input type="date" value={form.date} onChange={e=>set("date",e.target.value)} className={inputCls(dark)} /></label><label className="space-y-1"><span className="text-sm opacity-80">Shift</span><select value={form.shift} onChange={e=>set("shift",e.target.value)} className={inputCls(dark)}>{["Day","Swing","Night"].map(s=> <option key={s}>{s}</option>)}</select></label></div><label className="space-y-1 block"><span className="text-sm opacity-80">Tasks Completed</span><textarea rows={4} value={form.tasksCompleted} onChange={e=>set("tasksCompleted",e.target.value)} className={inputCls(dark)} placeholder="- Checked Conveyor B
- Replaced hose clamp"/></label><label className="space-y-1 block"><span className="text-sm opacity-80">Issues / Blockers</span><textarea rows={3} value={form.issues} onChange={e=>set("issues",e.target.value)} className={inputCls(dark)} placeholder="- Awaiting part XYZ
- Need lockout approval"/></label><div className="grid sm:grid-cols-3 gap-3"><label className="space-y-1"><span className="text-sm opacity-80">Parts Used</span><input value={form.partsUsed} onChange={e=>set("partsUsed",e.target.value)} className={inputCls(dark)} placeholder="HC-34 x2, MO-530 x1" /></label><label className="space-y-1"><span className="text-sm opacity-80">Hours</span><input type="number" min="0" step="0.5" value={form.hours} onChange={e=>set("hours",Number(e.target.value))} className={inputCls(dark)} /></label><label className="space-y-1"><span className="text-sm opacity-80">Next-Day Notes</span><input value={form.nextDayNotes} onChange={e=>set("nextDayNotes",e.target.value)} className={inputCls(dark)} placeholder="Finish pump seal, test at 10:00" /></label></div><div className="space-y-2"><div className="flex items-center gap-2"><div className="text-sm font-medium">Images</div><button type="button" className={btn(dark,"ghost")} onClick={addImg}>+ Add Image URL</button></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{(form.imageUrls||[]).map((u,i)=>(<div key={i} className="border rounded-xl p-2 text-xs break-words dark:border-zinc-800"><a className="underline" href={u} target="_blank">image {i+1}</a><button type="button" className={btn(dark,"danger")+" mt-2"} onClick={()=>delImg(i)}>Remove</button></div>))}{(form.imageUrls||[]).length===0 && <div className="text-xs opacity-70">No images added.</div>}</div></div><div className="flex items-center justify-end gap-2 pt-2"><button type="button" className={btn(dark,"ghost")} onClick={(e)=>{e.preventDefault(); window.dispatchEvent(new CustomEvent('modal:close'));}}>Cancel</button><button className={btn(dark)}>{initial?.id? "Save":"Submit"}</button></div></form>);}

// ======= Technicians =======
function TechsView({ dark }){
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [users, setUsers] = useState([]);
  async function load(){ setUsers(await api('/api/users')); } useEffect(()=>{ load(); }, []);
  async function addTech(){ if(!name.trim()||!email.trim()) return; await api('/api/auth/register', { method:'POST', body: JSON.stringify({ name, email, password:'changeme', role:'tech' }) }); setName(""); setEmail(""); await load(); alert('Tech created (temp password "changeme").'); }
  return (<div className="space-y-4"><h2 className="text-xl font-semibold">Technicians</h2><div className={panel(dark)}><div className="grid sm:grid-cols-3 gap-2"><input placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} className={inputCls(dark)} /><input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className={inputCls(dark)} /><button className={btn(dark)} onClick={addTech}>Add Technician</button></div></div><div className={panel(dark)}><table className="w-full text-sm"><thead className="text-left uppercase text-xs opacity-70"><tr><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Role</th></tr></thead><tbody>{users.map(u=> <tr key={u.id} className="border-t border-black/10 dark:border-white/10"><td className="p-2">{u.name}</td><td className="p-2">{u.email}</td><td className="p-2">{u.role}</td></tr>)}</tbody></table></div></div>);
}

// ======= Reports (KPIs + CSV export) =======
function ReportsView({ dark }){
  const [wos,setWos]=useState([]); const [inv,setInv]=useState([]); const [reps,setReps]=useState([]);
  useEffect(()=>{ (async()=>{ setWos(await api('/api/workorders')); setInv(await api('/api/inventory')); setReps(await api('/api/reports')); })(); }, []);
  const completed = wos.filter(w=>w.status==="Completed").length;
  const total = wos.length; const completionRate = total? Math.round((completed/total)*100):0;
  const lowStock = inv.filter(i=> i.qty <= i.min).length;
  const last30 = reps.filter(r=> (Date.now()-r.createdAt) < 1000*60*60*24*30).length;
  const overdue = wos.filter(w=> w.dueDate && new Date(w.dueDate) < new Date() && !["Completed","Canceled"].includes(w.status)).length;
  const cards = [
    { label: "Open WOs", value: wos.filter(w=>!["Completed","Canceled"].includes(w.status)).length },
    { label: "Overdue WOs", value: overdue },
    { label: "Completed WOs", value: completed },
    { label: "Completion Rate", value: completionRate + "%" },
    { label: "Low-Stock Items", value: lowStock },
    { label: "Daily Reports (30d)", value: last30 },
  ];
  return (<>
    <div className="flex justify-end gap-2 mb-2">
      <button className={btn(dark,'ghost')} onClick={()=> download('work_orders.csv', toCSV(wos, [
        { label:'ID', get:r=>r.id }, { label:'Title', get:r=>r.title }, { label:'Status', get:r=>r.status }, { label:'Priority', get:r=>r.priority }, { label:'AssignedTo', get:r=>r.assignedTo||'' }, { label:'Due', get:r=>r.dueDate||'' }, { label:'CreatedAt', get:r=> new Date(r.createdAt).toISOString() }
      ]))}>Export WOs</button>
      <button className={btn(dark,'ghost')} onClick={()=> download('inventory.csv', toCSV(inv, [
        { label:'ID', get:r=>r.id }, { label:'Name', get:r=>r.name }, { label:'SKU', get:r=>r.sku }, { label:'Qty', get:r=>r.qty }, { label:'Min', get:r=>r.min }
      ]))}>Export Inventory</button>
      <button className={btn(dark,'ghost')} onClick={()=> download('daily_reports.csv', toCSV(reps, [
        { label:'ID', get:r=>r.id }, { label:'Date', get:r=>r.date }, { label:'User', get:r=>r.userName }, { label:'Shift', get:r=>r.shift||'' }, { label:'Tasks', get:r=>r.tasksCompleted||'' }, { label:'Issues', get:r=>r.issues||'' }, { label:'Parts', get:r=>r.partsUsed||'' }, { label:'Hours', get:r=>r.hours||'' }, { label:'NextDay', get:r=>r.nextDayNotes||'' }
      ]))}>Export Reports</button>
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((c,i)=> (<div key={i} className={panel(dark)}><div className="text-sm opacity-70">{c.label}</div><div className="text-3xl font-bold">{c.value}</div></div>))}
    </div>
  </>);
}

// ======= UI helpers =======
function NavItem({ label, icon, active, onClick }){ return (<button onClick={onClick} className={tw("w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left mb-1", active? "bg-sky-600 text-white shadow-sm":"hover:bg-sky-50 dark:hover:bg-zinc-800")}><span className="text-lg">{icon}</span><span className="font-medium">{label}</span></button>); }
function Modal({ dark, children, onClose }){ return (<div data-modal-root className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50"><div className={tw("w-full max-w-3xl rounded-2xl p-4", dark?"bg-zinc-900 border border-zinc-800":"bg-white border border-slate-200 shadow-xl")}><div className="flex items-center justify-between mb-2"><div className="font-semibold">Edit</div><button data-modal-close className={btn(dark,"ghost")} onClick={onClose}>Close</button></div>{children}</div></div>); }
function Badge({ color="slate", children }){ const map = {slate:"bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200", emerald:"bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100", amber:"bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100", red:"bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100", blue:"bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100", violet:"bg-violet-200 text-violet-900 dark:bg-violet-900 dark:text-violet-100"}; return <span className={tw("px-2 py-0.5 rounded-full text-xs font-semibold", map[color] || map.slate)}>{children}</span>; }
function Logo(){ return (<div className="flex items-center gap-2"><div className="w-8 h-8 rounded-2xl bg-sky-600 grid place-items-center text-white font-black">M</div></div>); }
function prioColor(p){ return p==="Critical"? "red" : p==="High"? "violet" : p==="Medium" ? "blue" : "slate"; }
function shortId(id){ return String(id).slice(0,6); }
function inputCls(dark){ return tw("px-3 py-2 rounded-xl border w-full", dark?"bg-zinc-900 border-zinc-800 placeholder:text-zinc-400":"bg-white border-slate-300 placeholder:text-slate-400"); }
function panel(dark){ return tw("rounded-2xl p-3", dark?"bg-zinc-900 border border-zinc-800":"bg-white border border-slate-200 shadow-sm"); }
function btn(dark, variant="solid"){ if(variant==="danger") return tw("px-3 py-1.5 rounded-xl border", dark?"bg-rose-600 text-white border-rose-700 hover:bg-rose-700":"bg-rose-600 text-white border-rose-700 hover:bg-rose-700"); if(variant==="ghost") return tw("px-3 py-1.5 rounded-xl", dark?"hover:bg-zinc-800":"hover:bg-slate-100"); return tw("px-3 py-1.5 rounded-xl border font-medium", dark?"bg-sky-600 text-white border-sky-700 hover:bg-sky-700":"bg-sky-600 text-white border-sky-700 hover:bg-sky-700"); }
function tw(...cls){ return cls.filter(Boolean).join(" "); }
function setLS(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
function getLS(k, fallback){ try{ const v = localStorage.getItem(k); return v? JSON.parse(v) : fallback; }catch{ return fallback; } }
function highlightMentions(t){ return String(t).replace(/@([A-Za-z][\w.-]*)/g, '<span class="mention">@$1</span>'); }