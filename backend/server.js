import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

// ===== Data (in-memory) =====
let users = [ { id: "u1", name: "Admin", email: "admin@motherlode.local", passwordHash: bcrypt.hashSync("admin123", 10), role: "admin" } ];
let assets = [];
let inventory = [
  { id: "i1", name: '3/4" Hose Clamp', sku: "HC-34", qty: 14, min: 10 },
  { id: "i2", name: "Motor Oil 5W-30", sku: "MO-530", qty: 6, min: 8 }
];
let workOrders = [
  { id: "w1", createdAt: Date.now()-7200000, title: "Conveyor B - belt tracking", description: "Belt drifting to the right near the head pulley.", asset: "Conveyor B", location: "Line 2", priority: "High", assignedTo: "", status: "In Progress", createdBy: "u1", dueDate:"" },
  { id: "w2", createdAt: Date.now()-86400000, title: "Mixer PM - monthly", description: "Standard PM checklist.", asset: "Mixer 1", location: "Room A", priority: "Medium", assignedTo: "", status: "Open", createdBy: "u1", dueDate:"" }
];
let pms = [];
let dailyReports = [];
let handoffs = [];
let woTemplates = []; // {id, name, payload, createdBy, createdAt}
let woComments = [];

// ===== Helpers =====
function auth(req,res,next){
  const h = req.headers['authorization'] || "";
  const token = h.startsWith("Bearer ")? h.slice(7): null;
  if(!token) return res.status(401).json({ error: "No token" });
  try{ req.user = jwt.verify(token, JWT_SECRET); next(); }catch{ return res.status(401).json({ error: "Invalid token" }); }
}
function adminOnly(req,res,next){ if(req.user.role !== 'admin') return res.status(403).json({ error: "Admin only" }); next(); }
function canModify(ownerId, user){ return user.role === 'admin' || ownerId === user.id; }

// ===== Auth =====
app.post("/api/auth/login", (req,res)=>{
  const { email, password } = req.body || {};
  const u = users.find(x=> x.email.toLowerCase()===String(email||'').toLowerCase());
  if(!u || !bcrypt.compareSync(password || "", u.passwordHash)) return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign({ id:u.id, name:u.name, role:u.role, email:u.email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { id:u.id, name:u.name, email:u.email, role:u.role } });
});
app.post("/api/auth/register", auth, adminOnly, (req,res)=>{
  const { name, email, password='changeme', role='tech' } = req.body || {};
  if(users.find(u=> u.email.toLowerCase() === String(email||'').toLowerCase())) return res.status(400).json({ error: "Email exists" });
  const id = "u" + Math.random().toString(36).slice(2,8);
  const user = { id, name, email, passwordHash: bcrypt.hashSync(password,10), role };
  users.push(user);
  res.json({ id, name, email, role });
});
app.get("/api/users", auth, adminOnly, (req,res)=> res.json(users.map(({passwordHash, ...u})=>u)));
app.get("/api/techs", auth, (req,res)=> res.json(users.filter(u=>u.role==="tech").map(({passwordHash, ...u})=>u)));

// ===== Work Orders (ownership enforced) =====
app.get("/api/workorders", auth, (req,res)=> res.json(workOrders));
app.post("/api/workorders", auth, (req,res)=>{
  const id = "w" + Math.random().toString(36).slice(2,8);
  const wo = { id, createdAt: Date.now(), createdBy: req.user.id, checklist:[], ...req.body };
  workOrders.unshift(wo);
  res.json(wo);
});
app.put("/api/workorders/:id", auth, (req,res)=>{
  const { id } = req.params;
  const wo = workOrders.find(w=> w.id===id);
  if(!wo) return res.status(404).json({ error:"Not found" });
  if(!canModify(wo.createdBy, req.user)) return res.status(403).json({ error: "Forbidden" });
  Object.assign(wo, req.body);
  res.json({ ok:true });
});
app.delete("/api/workorders/:id", auth, (req,res)=>{
  const { id } = req.params;
  const wo = workOrders.find(w=> w.id===id);
  if(!wo) return res.json({ ok:true });
  if(!canModify(wo.createdBy, req.user)) return res.status(403).json({ error: "Forbidden" });
  workOrders = workOrders.filter(w=> w.id!==id);
  res.json({ ok:true });
});

// WO comments
app.get("/api/workorders/:id/comments", auth, (req,res)=>{
  const { id } = req.params;
  const list = woComments.filter(c=> c.woId === id).sort((a,b)=> b.createdAt - a.createdAt);
  res.json(list);
});
app.post("/api/workorders/:id/comments", auth, (req,res)=>{
  const { id } = req.params;
  const { text } = req.body || {};
  const c = { id: "c"+Math.random().toString(36).slice(2,8), woId:id, userId:req.user.id, userName:req.user.name, text, createdAt: Date.now() };
  woComments.unshift(c);
  res.json(c);
});
app.delete("/api/workorders/:woId/comments/:cid", auth, (req,res)=>{
  const { woId, cid } = req.params;
  const c = woComments.find(x=> x.id===cid && x.woId===woId);
  if(!c) return res.json({ ok:true });
  if(!(req.user.role==='admin' || req.user.id===c.userId)) return res.status(403).json({ error:"Forbidden" });
  woComments = woComments.filter(x=> !(x.id===cid && x.woId===woId));
  res.json({ ok:true });
});

// ===== Inventory =====
app.get("/api/inventory", auth, (req,res)=> res.json(inventory));
app.post("/api/inventory", auth, adminOnly, (req,res)=>{ const i={ id:"i"+Math.random().toString(36).slice(2,8), ...req.body }; inventory.push(i); res.json(i); });
app.put("/api/inventory/:id", auth, (req,res)=>{ const { id } = req.params; inventory = inventory.map(i=> i.id===id? { ...i, ...req.body }: i); res.json({ ok:true }); });
app.delete("/api/inventory/:id", auth, adminOnly, (req,res)=>{ const { id } = req.params; inventory = inventory.filter(i=> i.id!==id); res.json({ ok:true }); });

// ===== PM (admin) =====
app.get("/api/pms", auth, (req,res)=> res.json(pms));
app.post("/api/pms", auth, adminOnly, (req,res)=>{ const pm={ id:"pm"+Math.random().toString(36).slice(2,8), ...req.body }; pms.unshift(pm); res.json(pm); });
app.put("/api/pms/:id", auth, adminOnly, (req,res)=>{ const { id } = req.params; pms = pms.map(p=> p.id===id? { ...p, ...req.body }: p); res.json({ ok:true }); });
app.delete("/api/pms/:id", auth, adminOnly, (req,res)=>{ const { id } = req.params; pms = pms.filter(p=> p.id!==id); res.json({ ok:true }); });

// ===== Daily Reports (owner or admin) =====
app.get("/api/reports", auth, (req,res)=>{
  const q = String(req.query.date || "");
  const data = req.user.role==='admin' ? dailyReports : dailyReports.filter(r=> r.userId===req.user.id);
  return res.json(q? data.filter(r=> r.date===q) : data);
});
app.post("/api/reports", auth, (req,res)=>{
  const { date, shift, tasksCompleted, issues, partsUsed, hours, nextDayNotes, imageUrls=[] } = req.body || {};
  const r = { id: "r"+Math.random().toString(36).slice(2,8), userId: req.user.id, userName: req.user.name, date, shift, tasksCompleted, issues, partsUsed, hours, nextDayNotes, imageUrls, createdAt: Date.now() };
  dailyReports.unshift(r);
  res.json(r);
});
app.put("/api/reports/:id", auth, (req,res)=>{
  const { id } = req.params;
  const r = dailyReports.find(x=> x.id===id);
  if(!r) return res.status(404).json({ error:"Not found" });
  if(!canModify(r.userId, req.user)) return res.status(403).json({ error:"Forbidden" });
  Object.assign(r, req.body);
  res.json({ ok:true });
});
app.delete("/api/reports/:id", auth, (req,res)=>{
  const { id } = req.params;
  const r = dailyReports.find(x=> x.id===id);
  if(!r) return res.json({ ok:true });
  if(!canModify(r.userId, req.user)) return res.status(403).json({ error: "Forbidden" });
  dailyReports = dailyReports.filter(x=> x.id!==id);
  res.json({ ok:true });
});

// ===== Handoffs =====
app.get("/api/handoffs", auth, (req,res)=>{
  const data = req.user.role==='admin' ? handoffs : handoffs.filter(h=> h.createdBy===req.user.id || h.assignedTo===req.user.name);
  res.json(data);
});
app.post("/api/handoffs", auth, (req,res)=>{
  const { title, notes, priority='Medium', dueDate, assignedTo='' } = req.body || {};
  const h = { id: "h"+Math.random().toString(36).slice(2,8), title, notes, priority, dueDate, status: "Open", createdBy: req.user.id, assignedTo };
  handoffs.unshift(h);
  res.json(h);
});
app.put("/api/handoffs/:id", auth, (req,res)=>{
  const { id } = req.params;
  const h = handoffs.find(x=> x.id===id);
  if(!h) return res.status(404).json({ error:"Not found" });
  if(!canModify(h.createdBy, req.user)) return res.status(403).json({ error:"Forbidden" });
  Object.assign(h, req.body);
  res.json({ ok:true });
});
app.delete("/api/handoffs/:id", auth, (req,res)=>{
  const { id } = req.params;
  const h = handoffs.find(x=> x.id===id);
  if(!h) return res.json({ ok:true });
  if(!canModify(h.createdBy, req.user)) return res.status(403).json({ error:"Forbidden" });
  handoffs = handoffs.filter(x=> x.id!==id);
  res.json({ ok:true });
});

// ===== Assets =====
app.get("/api/assets", auth, (req,res)=> res.json(assets));
app.post("/api/assets", auth, adminOnly, (req,res)=>{
  const a = { id: "a"+Math.random().toString(36).slice(2,8), createdAt: Date.now(), ...req.body };
  assets.unshift(a);
  res.json(a);
});
app.put("/api/assets/:id", auth, adminOnly, (req,res)=>{
  const { id } = req.params;
  assets = assets.map(a=> a.id===id ? { ...a, ...req.body } : a);
  res.json({ ok:true });
});
app.delete("/api/assets/:id", auth, adminOnly, (req,res)=>{
  const { id } = req.params;
  assets = assets.filter(a=> a.id!==id);
  res.json({ ok:true });
});

// ===== Work Order Templates (admin CRUD) =====
app.get("/api/wo-templates", auth, (req,res)=>{
  const data = req.user.role==='admin' ? woTemplates : woTemplates; // everyone can read
  res.json(data);
});
app.post("/api/wo-templates", auth, adminOnly, (req,res)=>{
  const { name, payload } = req.body || {};
  const t = { id: "t"+Math.random().toString(36).slice(2,8), name, payload, createdBy: req.user.id, createdAt: Date.now() };
  woTemplates.unshift(t); res.json(t);
});
app.put("/api/wo-templates/:id", auth, adminOnly, (req,res)=>{
  const { id } = req.params;
  woTemplates = woTemplates.map(t=> t.id===id ? { ...t, ...req.body } : t);
  res.json({ ok:true });
});
app.delete("/api/wo-templates/:id", auth, adminOnly, (req,res)=>{
  const { id } = req.params;
  woTemplates = woTemplates.filter(t=> t.id!==id);
  res.json({ ok:true });
});

// Change own password
app.put("/api/users/me/password", auth, (req,res)=>{
  const { currentPassword, newPassword } = req.body || {};
  const u = users.find(x=> x.id===req.user.id);
  if(!u) return res.status(404).json({ error:"User not found" });
  if(!bcrypt.compareSync(currentPassword || "", u.passwordHash)) return res.status(400).json({ error:"Current password incorrect" });
  u.passwordHash = bcrypt.hashSync(String(newPassword||""), 10);
  res.json({ ok:true });
});

app.get("/api/health", (_,res)=> res.json({ ok:true }));

app.listen(PORT, ()=> console.log("Motherlode CMMS API on", PORT));