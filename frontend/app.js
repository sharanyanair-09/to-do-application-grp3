/* Daymark: lightweight, local-first task manager. Optional REST sync uses the existing backend API. */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORE_KEY = 'daymark.tasks.v1';
const META_KEY = 'daymark.meta.v1';
const API_DEFAULT = 'https://to-do-application-backend-kgul.onrender.com/api';
const CATEGORIES = [
  { name: 'Work', color: '#8bac43', bg: '#edf2df' },
  { name: 'Personal', color: '#cb835f', bg: '#f7ebe4' },
  { name: 'University', color: '#718fd0', bg: '#eaf0fa' },
  { name: 'Health', color: '#4e9c86', bg: '#e5f2ed' },
  { name: 'Shopping', color: '#c58c39', bg: '#f7efdf' },
  { name: 'Projects', color: '#a076b6', bg: '#f1eaf5' }
];
const DAY = 86400000;
const localDate = (offset = 0) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const uid = () => `local-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const seed = [
  { id: uid(), title: 'Send the revised proposal to Alex', description: 'Add the updated timeline and confirm the project scope.', dueDate: localDate(), time: '10:30 AM', priority: 'high', category: 'Work', completed: false, important: true, createdAt: Date.now()-500000 },
  { id: uid(), title: 'Pick up a few things for dinner', description: '', dueDate: localDate(), time: '5:30 PM', priority: 'low', category: 'Shopping', completed: false, important: false, createdAt: Date.now()-400000 },
  { id: uid(), title: 'Read chapter 4 and make notes', description: 'Focus on the case study at the end.', dueDate: localDate(), time: '7:00 PM', priority: 'medium', category: 'University', completed: false, important: false, createdAt: Date.now()-300000 },
  { id: uid(), title: 'Book a dentist appointment', description: '', dueDate: localDate(), time: '', priority: 'medium', category: 'Health', completed: false, important: true, createdAt: Date.now()-200000 },
  { id: uid(), title: 'Water the plants', description: '', dueDate: localDate(), time: '', priority: 'low', category: 'Personal', completed: false, important: false, createdAt: Date.now()-100000 },
  { id: uid(), title: 'Review the sprint board', description: '', dueDate: localDate(), time: '9:15 AM', priority: 'medium', category: 'Work', completed: true, important: false, createdAt: Date.now()-80000 },
  { id: uid(), title: 'Share first project sketches', description: '', dueDate: localDate(1), time: '11:00 AM', priority: 'high', category: 'Projects', completed: false, important: true, createdAt: Date.now()-70000 },
  { id: uid(), title: 'Take a proper lunch break', description: '', dueDate: localDate(1), time: '', priority: 'low', category: 'Health', completed: false, important: false, createdAt: Date.now()-60000 },
  { id: uid(), title: 'Plan next week’s priorities', description: '', dueDate: localDate(3), time: '', priority: 'medium', category: 'Work', completed: false, important: false, createdAt: Date.now()-50000 },
  { id: uid(), title: 'Return library books', description: '', dueDate: localDate(5), time: '', priority: 'low', category: 'University', completed: false, important: false, createdAt: Date.now()-40000 }
];
let tasks = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || seed;
let meta = JSON.parse(localStorage.getItem(META_KEY) || '{}');
if(meta.darkMode)document.body.classList.add('dark-mode');
let session = JSON.parse(localStorage.getItem('daymark.session.v1') || 'null');
let authMode = 'user';
let authView = 'login';
let adminData = null;
let adminView = 'overview';
let selectedAdminUser = null;
let adminUserTasks = [];
let currentPage = 'today';
let currentFilter = 'all';
let statusFilter = 'all';
let editingId = null;
let sortByPriority = false;
let toastTimer;
const save = () => { localStorage.setItem(session?.user?.id ? `daymark.tasks.${session.user.id}` : STORE_KEY, JSON.stringify(tasks)); localStorage.setItem(META_KEY, JSON.stringify(meta)); };
function setDarkMode(enabled){meta.darkMode=Boolean(enabled);document.body.classList.toggle('dark-mode',meta.darkMode);const icon=$('.theme-toggle-icon');if(icon)icon.textContent=meta.darkMode?'☾':'☼';localStorage.setItem(META_KEY,JSON.stringify(meta));}
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const category = name => CATEGORIES.find(c => c.name === name) || CATEGORIES[1];
const todayTasks = () => tasks.filter(t => t.dueDate === localDate());
const openToday = () => todayTasks().filter(t => !t.completed).length;
const dateLabel = value => {
  if (!value) return 'No date';
  const d = new Date(`${value}T12:00:00`); const delta = Math.round((d - new Date(`${localDate()}T12:00:00`))/DAY);
  if (delta === 0) return 'Today'; if (delta === 1) return 'Tomorrow'; if (delta === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
};
const timeLabel = value => { if (!value) return ''; const [h,m] = value.split(':').map(Number); const d = new Date(); d.setHours(h,m); return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}); };
const fullDate = () => new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2300); }
function priorityMarkup(level) { const p={high:['↑','High','#dc765b'],medium:['◆','Medium','#d39b45'],low:['↓','Low','#7092a7']}[level]||['◆','Medium','#d39b45']; return `<span class="priority-chip" style="--priority-color:${p[2]}"><span class="priority-mark">${p[0]}</span>${p[1]}</span>`; }
function taskMeta(t) { const cat=category(t.category); const when=t.dueDate||''; const overdue=when&&when<localDate()&&!t.completed; const today=when===localDate(); return `<div class="task-meta"><span class="task-date ${overdue?'overdue':''} ${today?'today-date':''}">◷ ${esc(dateLabel(when))}${t.time?` · ${esc(timeLabel(t.time))}`:''}</span><span class="meta-dot">·</span><span class="category-chip" style="--chip-bg:${cat.bg};--chip-text:${cat.color}">${esc(t.category||'Personal')}</span>${priorityMarkup(t.priority)}${t.status==='In Progress'?'<span class="task-status-inline">In progress</span>':''}</div>`; }
function taskRow(t) { return `<div class="task-row ${t.completed?'completed':''}" data-id="${esc(t.id)}"><input class="task-check" type="checkbox" aria-label="Mark ${esc(t.title)} complete" ${t.completed?'checked':''}/><div class="task-main" data-open-task="${esc(t.id)}"><div class="task-title">${esc(t.title)}</div>${taskMeta(t)}</div><div class="task-actions"><button class="task-action ${t.important?'starred':''}" data-action="important" aria-label="${t.important?'Remove from':'Mark as'} important">${t.important?'★':'☆'}</button><button class="task-action" data-action="edit" aria-label="Edit task">✎</button><button class="task-action delete-action" data-action="delete" aria-label="Delete task">×</button></div></div>`; }
function setPage(page) { currentPage=page; currentFilter='all'; statusFilter='all'; $$('.primary-nav a,.mobile-nav a').forEach(a=>a.classList.toggle('active',a.dataset.page===page)); $('#crumb-title').textContent=page==='all'?'All tasks':page[0].toUpperCase()+page.slice(1); render(); $('#sidebar').classList.remove('open'); }
function pageTasks() { let list=[...tasks]; if(currentPage==='today'||currentPage==='inbox') list=list.filter(t=>t.dueDate===localDate()||(!t.dueDate&&currentPage==='inbox')); if(currentPage==='pending') list=list.filter(t=>!t.completed&&(t.status||'Pending')==='Pending'); if(currentPage==='upcoming') list=list.filter(t=>t.dueDate>localDate()); if(currentPage==='completed') list=list.filter(t=>t.completed); if(currentPage==='important') list=list.filter(t=>t.important&&!t.completed); if(currentPage.startsWith('list:')) list=list.filter(t=>t.category===currentPage.slice(5)); if(currentFilter==='today') list=list.filter(t=>t.dueDate===localDate()); if(currentFilter==='upcoming') list=list.filter(t=>t.dueDate>localDate()); if(currentFilter==='completed') list=list.filter(t=>t.completed); else if(currentPage!=='completed'&&statusFilter!=='Completed') list=list.filter(t=>!t.completed); if(statusFilter!=='all')list=list.filter(t=>(t.status||(t.completed?'Completed':'Pending'))===statusFilter); if(sortByPriority) list.sort((a,b)=>({high:0,medium:1,low:2}[a.priority]??1)-({high:0,medium:1,low:2}[b.priority]??1)); else list.sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||Number(a.completed)-Number(b.completed)||b.createdAt-a.createdAt); return list; }
function groupTasks(list) { if(currentPage==='all'||currentPage==='upcoming'||currentPage==='completed'||currentPage==='important'||currentPage.startsWith('list:')) { const groups=new Map(); list.forEach(t=>{const key=dateLabel(t.dueDate);groups.set(key,[...(groups.get(key)||[]),t]);}); return [...groups.entries()].map(([label,items])=>`<section class="task-group"><h3 class="group-heading">${esc(label.toUpperCase())} <span>${items.length}</span></h3>${items.map(taskRow).join('')}</section>`).join(''); } return list.length?list.map(taskRow).join(''):''; }
function renderAuth(message='') {
  $('.app-shell').hidden=true; $('#admin-screen').hidden=true; const root=$('#auth-screen'); root.hidden=false;
  root.innerHTML=`<div class="auth-brand"><span class="brand-mark"><i></i><i></i><i></i></span><span>daymark<span class="brand-period">.</span></span></div><div class="auth-wrap"><div class="auth-art"><div class="auth-art-mark">✳</div><span class="rail-kicker">A LITTLE MORE ROOM TO THINK</span><h1>Make space for<br/>what matters<span>.</span></h1><p>Your day, your pace. A thoughtful home for all the little things you want to get done.</p><div class="auth-art-footer"><span class="made-dot"></span> A calmer way to get things done</div></div><section class="auth-card"><div class="auth-role-tabs"><button class="${authMode==='user'?'active':''}" data-auth-role="user">User login</button><button class="${authMode==='admin'?'active':''}" data-auth-role="admin">Admin login</button></div><div class="auth-heading"><div class="modal-kicker">${authMode==='admin'?'ADMINISTRATION':'WELCOME BACK'}</div><h2>${authView==='register'?'Create your account':authMode==='admin'?'Admin sign in':'Sign in to Daymark'}<span>.</span></h2><p>${authMode==='admin'?'Sign in with your administrator account to view team activity.':authView==='register'?'Start making room for what matters.':'Pick up right where you left off.'}</p></div><form id="auth-form">${authView==='register'?`<label class="field-label" for="auth-name">YOUR NAME</label><input class="title-input" id="auth-name" name="name" required autocomplete="name" placeholder="Your name"/>`:''}<label class="field-label" for="auth-email">EMAIL ADDRESS</label><input class="title-input" id="auth-email" name="email" type="email" required autocomplete="username" placeholder="you@example.com"/><label class="field-label" for="auth-password">PASSWORD</label><input class="title-input" id="auth-password" name="password" type="password" required autocomplete="${authView==='register'?'new-password':'current-password'}" minlength="8" placeholder="At least 8 characters"/><p class="auth-error" id="auth-error">${esc(message)}</p><button class="auth-submit" type="submit">${authView==='register'?'Create account':authMode==='admin'?'Sign in as admin':'Sign in'} <span>→</span></button></form><div class="auth-switch">${authMode==='user'?(authView==='login'?`New to Daymark? <button data-auth-view="register">Create an account</button>`:`Already have an account? <button data-auth-view="login">Sign in</button>`):`Admin accounts are provisioned by your administrator.`}</div></section></div>`;
}
function adminUserRow(user){const name=user.name||'Unnamed user',pct=user.completionPercentage||0,id=esc(user.id||user._id);return `<tr class="clickable-user-row" data-user-tasks="${id}" tabindex="0" role="button" aria-label="View tasks for ${esc(name)}"><td><div class="admin-person"><span class="admin-person-avatar">${esc(name[0]?.toUpperCase()||'U')}</span><span><b>${esc(name)}</b><small>${esc(user.email)}</small></span></div></td><td><b>${user.totalTasks||0}</b><small class="table-secondary"> tasks</small></td><td><div class="user-progress"><span><i style="width:${pct}%"></i></span><small>${pct}%</small></div></td><td><button class="view-user-button" aria-label="View user tasks">→</button></td></tr>`;}
function renderAdminUsers(d){return `<div class="admin-section-head"><div><span class="rail-kicker">ALL ACCOUNTS</span><h2>Registered users <span class="heading-count">${d.totalUsers||0}</span></h2></div></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>USER</th><th>TASKS</th><th>PROGRESS</th><th></th></tr></thead><tbody>${(Array.isArray(d.users)?d.users.filter(Boolean):[]).map(adminUserRow).join('')||`<tr><td colspan="4" class="admin-empty">No registered users yet.</td></tr>`}</tbody></table></div>${selectedAdminUser?`<section class="user-task-panel"><div class="admin-section-head"><div><span class="rail-kicker">CURRENT WORK</span><h2>${esc(selectedAdminUser.name)}’s tasks</h2></div><button data-clear-user class="quiet-icon" aria-label="Close user tasks">×</button></div>${adminUserTasks.length?`<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>TASK</th><th>STATUS</th><th>CREATED</th></tr></thead><tbody>${adminUserTasks.map(t=>`<tr><td><b>${esc(t.title)}</b><small class="task-description-cell">${esc(t.description||'')}</small></td><td><span class="status-pill ${statusClass(t.status)}">${esc(t.status|| (t.completed?'Completed':'Pending'))}</span></td><td class="table-secondary">${t.createdAt?new Date(t.createdAt).toLocaleDateString():'—'}</td></tr>`).join('')}</tbody></table></div>`:`<p class="admin-empty">This user has not added any tasks yet.</p>`}</section>`:''}`;}
function statusClass(status){return status==='Completed'?'status-completed':status==='In Progress'?'status-working':'status-pending';}
function taskFromApi(item,cached={}){return {...cached,id:item._id||item.id,title:item.title,description:item.description||'',dueDate:item.dueDate||cached.dueDate||'',priority:item.priority||cached.priority||'medium',category:item.category||cached.category||'Personal',important:item.important??cached.important??false,status:item.status||'Pending',completed:item.status==='Completed'||item.completed,createdAt:Date.parse(item.createdAt)||cached.createdAt||Date.now()};}
function renderAdminOverview(d){const users=Array.isArray(d?.users)?d.users.filter(Boolean):[];return `<div class="admin-section-head"><div><span class="rail-kicker">PEOPLE & PROGRESS</span><h2>Your users</h2></div><button class="text-link" data-admin-view="users">View all users →</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>USER</th><th>TASKS</th><th>PROGRESS</th><th></th></tr></thead><tbody>${users.map(adminUserRow).join('')||`<tr><td colspan="4" class="admin-empty">No registered users yet.</td></tr>`}</tbody></table></div>`;}
function renderAdminProfile(){const user=session?.user||{},joined=user.createdAt?new Date(user.createdAt).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}):'—';return `<section class="utility-card profile-card-large"><div class="profile-intro"><div class="profile-big-avatar">${esc((user.name||'A')[0].toUpperCase())}</div><div><span class="rail-kicker">ADMIN ACCOUNT</span><h2>${esc(user.name||'Admin')}</h2><span class="profile-role">ADMINISTRATOR</span></div></div><div class="profile-information"><div><span>FULL NAME</span><b>${esc(user.name||'—')}</b></div><div><span>EMAIL</span><b>${esc(user.email||'—')}</b></div><div><span>ROLE</span><b>Administrator</b></div><div><span>MEMBER SINCE</span><b>${esc(joined)}</b></div><div class="profile-id"><span>ACCOUNT ID</span><b>${esc(user.id||'—')}</b></div></div><div class="profile-actions"><button class="logout-utility" data-signout><span>↪</span> Log out</button></div></section>`;}function renderAdmin(){ $('.app-shell').hidden=true;$('#auth-screen').hidden=true;const root=$('#admin-screen');root.hidden=false;if(!session?.user){adminData=null;renderAuth('Your sign-in session is incomplete. Please sign in again.');return;}if(!adminData){root.innerHTML='<div class="admin-loading">Loading your workspace…</div>';return;}const d=adminData;root.innerHTML=`<header class="admin-topbar"><a class="brand" href="#overview" data-admin-home aria-label="Daymark home"><span class="brand-mark"><i></i><i></i><i></i></span><span>daymark<span class="brand-period">.</span></span></a><div class="admin-top-right"><span class="admin-role-pill">ADMINISTRATOR</span><button class="top-avatar admin-avatar-button" data-admin-profile aria-label="Open admin profile">${esc((session.user.name||'A')[0].toUpperCase())}</button><span class="admin-name">${esc(session.user.name||'Admin')}</span></div></header><main class="admin-main"><div class="admin-title-row"><div><div class="eyebrow">WORKSPACE OVERVIEW</div><h1>${adminView==='profile'?'Your profile':'Team progress'}<span class="title-period">.</span></h1><p class="page-subtitle">${adminView==='profile'?'Your administrator account details.':'A clear picture of what everyone is working on.'}</p></div>${adminView==='profile'?'<button class="text-link" data-admin-view="overview">← Back to overview</button>':'<button class="add-task-button admin-refresh" data-admin-refresh>↻ &nbsp; Refresh</button>'}</div>${adminView==='profile'?renderAdminProfile():`<nav class="admin-tabs"><button data-admin-view="overview" class="${adminView==='overview'?'active':''}">Overview</button><button data-admin-view="users" class="${adminView==='users'?'active':''}">Users <span>${d.totalUsers||0}</span></button></nav><section class="admin-stats"><div class="admin-stat"><span>REGISTERED USERS</span><b>${d.totalUsers||0}</b><small>Active accounts</small></div><div class="admin-stat"><span>PENDING</span><b>${d.pendingTasks||0}</b><small>Tasks not started</small></div><div class="admin-stat"><span>IN PROGRESS</span><b>${d.inProgressTasks||0}</b><small>Being worked on now</small></div><div class="admin-stat"><span>COMPLETED</span><b>${d.completedTasks||0}</b><small>${d.completionPercentage||0}% overall completion</small></div></section>${adminView==='overview'?renderAdminOverview(d):renderAdminUsers(d)}`}</main>`;}
async function loadAdmin(){const result=await api('/admin/dashboard');if(!result||!Array.isArray(result.users))throw new Error('The dashboard response did not include a users list.');adminData=result;renderAdmin();}function renderAdminError(message){renderAuth(`Could not load admin workspace: ${message}`);}
function render() {
  if(!session){renderAuth();return;}
  meta.apiBase=meta.apiBase||API_DEFAULT;meta.token=session.token;
  if(session.user?.role==='admin'){renderAdmin();return;}
  $('.app-shell').hidden=false;$('#auth-screen').hidden=true;$('#admin-screen').hidden=true;
  $('#utility-page')?.remove();
  $('#date-label').textContent=fullDate();
  const name=meta.name||'Tanvi Sharma'; const first=name.trim().split(/\s+/)[0];
  $('#sidebar-name').textContent=name; $('#sidebar-avatar').textContent=(first[0]||'T').toUpperCase(); $('#top-avatar').textContent=(first[0]||'T').toUpperCase();
  const titles={today:`Good morning, ${first}`,inbox:'Your inbox',pending:'Pending tasks',upcoming:'A little further ahead',all:'Everything, in one place',completed:'Look how far you’ve come',important:'The things that matter',settings:'Make it yours',profile:'Your space'};
  $('#page-title').innerHTML=`${esc(titles[currentPage]||currentPage.slice(5))}<span class="title-period">.</span>`;
  $('#page-subtitle').textContent=currentPage==='today'?`You have ${openToday()} ${openToday()===1?'task':'tasks'} to focus on today.`:({upcoming:'A calmer view of what’s coming next.',all:'Every little thing you’ve got on your list.',completed:'A little progress is still progress.',important:'Your most meaningful next steps.',inbox:'A place to catch anything on your mind.'}[currentPage]||'Make a little room for what matters.');
  $('#inbox-count').textContent=tasks.filter(t=>!t.completed&&!t.dueDate).length||''; $('#today-count').textContent=openToday()||''; $('#pending-count').textContent=tasks.filter(t=>!t.completed&&(t.status||'Pending')==='Pending').length||''; const allFilterCount=$('#filter-all-count'); if(allFilterCount)allFilterCount.textContent=pageTasks().filter(t=>!t.completed).length;
  $('#list-nav').innerHTML=CATEGORIES.map(c=>`<a href="#list:${c.name}" data-page="list:${c.name}" class="${currentPage===`list:${c.name}`?'active':''}"><span class="list-dot" style="--dot:${c.color}"></span>${c.name}<span class="nav-count">${tasks.filter(t=>t.category===c.name&&!t.completed).length||''}</span></a>`).join('');
  $('#task-category').innerHTML=CATEGORIES.map(c=>`<option>${c.name}</option>`).join('');
  const dashboard=['today','inbox','upcoming','all','completed','important'].includes(currentPage)||currentPage.startsWith('list:');
  if(!dashboard){ renderUtilityPage(); return; }
  showDashboard();
  const list=pageTasks();
  $('#task-list').innerHTML=list.length?groupTasks(list):`<div class="empty-state"><div class="empty-art">✳</div><h3>${currentPage==='today'?'You’re all caught up.':'Nothing on this list yet.'}</h3><p>${currentPage==='today'?'Nothing left on your list today. Enjoy the breathing room.':'A fresh start. Add a task whenever you’re ready.'}</p><button data-add-task>Add a task</button></div>`;
  $('#inline-add').style.display=list.length?'block':'none';
  const done=todayTasks().filter(t=>t.completed); $('#completed-preview').innerHTML=done.length?`<div class="completed-heading"><span>COMPLETED</span><span>${done.length} ${done.length===1?'task':'tasks'}</span><button data-page="completed">View all →</button></div>${done.slice(0,2).map(t=>`<div class="completed-row"><input type="checkbox" class="task-check" checked data-completed-id="${esc(t.id)}" aria-label="Mark ${esc(t.title)} incomplete"/><div class="task-title">${esc(t.title)}</div></div>`).join('')}`:'';
  renderProgress(); renderUpcoming();
}
function showDashboard(){ $$('.dashboard-grid').forEach(el=>el.style.display=''); $('.greeting-row').style.display=''; $('.filter-tabs').style.display=''; $('#completed-preview').style.display=currentPage==='today'?'':'none'; $('#filter-tabs').innerHTML=`<button class="filter-tab ${currentFilter==='all'?'active':''}" data-filter="all">All <span class="filter-num" id="filter-all-count">${pageTasks().filter(t=>!t.completed).length}</span></button><button class="filter-tab ${currentFilter==='today'?'active':''}" data-filter="today">Today</button><button class="filter-tab ${currentFilter==='upcoming'?'active':''}" data-filter="upcoming">Upcoming</button><button class="filter-tab ${currentFilter==='completed'?'active':''}" data-filter="completed">Completed</button>`;$('#status-filter').value=statusFilter; }
function renderUtilityPage(){ $('.dashboard-grid').style.display='none'; $('.greeting-row').style.display=''; $('#utility-page')?.remove(); $('#content-wrap').insertAdjacentHTML('beforeend',`<section class="utility-page" id="utility-page"></section>`); const panel=$('#utility-page');
  if(currentPage==='settings') panel.innerHTML=`<div class="utility-card"><span class="rail-kicker">PREFERENCES</span><h2>Settings</h2><label class="field-label" for="setting-name">Your name</label><input id="setting-name" class="title-input" value="${esc(meta.name||'Tanvi Sharma')}"/><div class="utility-actions"><button id="sync-button" class="save-task">Save & refresh tasks <span>→</span></button></div><p class="setting-note">Your account syncs tasks securely with the workspace.</p></div><div class="utility-card"><span class="rail-kicker">ABOUT DAYMARK</span><h2>Make room for what matters.</h2><p class="setting-note">A thoughtful little space for your everyday plans.</p></div>`;
  else {const user=session?.user||{},joined=user.createdAt?new Date(user.createdAt).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}):'—';panel.innerHTML=`<div class="profile-layout"><section class="utility-card profile-card-large"><div class="profile-intro"><div class="profile-big-avatar">${esc((user.name||meta.name||'U')[0].toUpperCase())}</div><div><span class="rail-kicker">YOUR ACCOUNT</span><h2>${esc(user.name||meta.name||'User')}</h2><span class="profile-role">${esc((user.role||'user').toUpperCase())} ACCOUNT</span></div></div><div class="profile-information"><div><span>FULL NAME</span><b>${esc(user.name||meta.name||'—')}</b></div><div><span>EMAIL</span><b>${esc(user.email||'—')}</b></div><div><span>ACCOUNT TYPE</span><b>${esc((user.role||'user').replace(/^./,c=>c.toUpperCase()))}</b></div><div><span>MEMBER SINCE</span><b>${esc(joined)}</b></div><div class="profile-id"><span>ACCOUNT ID</span><b>${esc(user.id||user._id||'—')}</b></div></div><div class="profile-actions"><label class="theme-toggle"><span class="theme-toggle-icon">${meta.darkMode?'☾':'☼'}</span><span><b>Dark mode</b><small>Use a darker color palette</small></span><input type="checkbox" data-theme-toggle ${meta.darkMode?'checked':''}/><i></i></label><button class="logout-utility" data-signout><span>↪</span> Log out</button></div></section><aside class="utility-card profile-side-note"><span class="rail-kicker">YOUR SPACE</span><h3>Made for a little more room to think.</h3><p>Your account details are connected to your Daymark login.</p></aside></div>`;}
}
function renderProgress(){ const list=todayTasks(),done=list.filter(t=>t.completed).length,pct=list.length?Math.round(done/list.length*100):0; $('#progress-percent').innerHTML=`${pct}<span>%</span>`; $('#progress-count').textContent=`${done} of ${list.length}`; $('#progress-foot-count').textContent=`${done} / ${list.length}`; $('#progress-bar').style.width=`${pct}%`; $('#progress-ring').style.setProperty('--progress',`${pct*3.6}deg`); }
function renderUpcoming(){ const items=tasks.filter(t=>!t.completed&&t.dueDate>localDate()).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,3); $('#up-next-list').innerHTML=items.length?items.map(t=>{const d=new Date(`${t.dueDate}T12:00:00`);return `<div class="up-next-item"><div class="up-next-date"><b>${d.getDate()}</b><span>${d.toLocaleDateString('en-US',{month:'short'})}</span></div><div class="up-next-copy"><b>${esc(t.title)}</b><span>${esc(t.category)}</span></div></div>`}).join(''):`<div class="up-next-item"><div class="up-next-copy"><b>Nothing coming up yet</b><span>Enjoy the open space.</span></div></div>`; }
function modal(open){ const el=$('#task-modal'); el.classList.toggle('open',open); el.setAttribute('aria-hidden',String(!open)); if(open)setTimeout(()=>$('#task-title').focus(),80); }
function openEditor(id){ editingId=id||null; const task=tasks.find(t=>t.id===id); $('#modal-title').innerHTML=`${task?'Edit':'A new'} task<span>.</span>`; $('#task-form').elements.title.value=task?.title||''; $('#task-form').elements.description.value=task?.description||''; $('#task-form').elements.dueDate.value=task?.dueDate||localDate(); $('#task-form').elements.priority.value=task?.priority||'medium'; $('#task-form').elements.status.value=task?.status||(task?.completed?'Completed':'Pending'); $('#task-form').elements.category.value=task?.category||'Work'; $('#task-form').querySelector('.save-task').innerHTML=`${task?'Save changes':'Create task'} <span>→</span>`; modal(true); }
function toggleComplete(id,completed){const t=tasks.find(x=>x.id===id); if(!t)return;t.completed=completed;t.status=completed?'Completed':'Pending';save();render();toast(completed?'Nicely done.':'Back on your list.');syncTask(t);}
function openDetails(id){const t=tasks.find(x=>x.id===id);if(!t)return;const c=category(t.category);$('#detail-content').innerHTML=`<div class="detail-top"><span class="category-chip" style="--chip-bg:${c.bg};--chip-text:${c.color}">${esc(t.category)}</span><button class="detail-close" data-close-detail>×</button></div><h2 class="detail-title" id="detail-title">${esc(t.title)}</h2><p class="detail-description">${esc(t.description||'No extra details. Add a note while editing if you need one.')}</p><div class="detail-meta"><div><small>WHEN</small><b>${esc(dateLabel(t.dueDate))}${t.time?` · ${esc(timeLabel(t.time))}`:''}</b></div><div><small>PRIORITY</small><b>${priorityMarkup(t.priority)}</b></div><div><small>STATUS</small><b>${t.completed?'Completed':'In progress'}</b></div><div><small>IMPORTANT</small><b>${t.important?'Yes':'No'}</b></div></div><div class="detail-actions"><button class="danger" data-detail-delete="${esc(id)}">Delete task</button><button data-detail-edit="${esc(id)}">Edit task</button><button data-detail-done="${esc(id)}">${t.completed?'Reopen':'Mark complete'}</button></div>`; $('#detail-modal').classList.add('open');$('#detail-modal').setAttribute('aria-hidden','false'); }
async function api(path,options={}){const base=(meta.apiBase||API_DEFAULT).replace(/\/$/,'');const headers={'Content-Type':'application/json',...options.headers};if(meta.token)headers.Authorization=`Bearer ${meta.token}`;const response=await fetch(`${base}${path}`,{...options,headers});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.message||`Request failed (${response.status})`);return body.data;}
async function syncTask(task){if(!meta.apiBase||!session?.token||String(task.id).startsWith('local-'))return;try{await api(`/tasks/${encodeURIComponent(task.id)}`,{method:'PUT',body:JSON.stringify({title:task.title,description:task.description,dueDate:task.dueDate||'',priority:task.priority,category:task.category,important:task.important,status:task.status||(task.completed?'Completed':'Pending')})});}catch(e){toast(`Saved here. Sync issue: ${e.message}`);}}
async function syncAll(){meta.name=$('#setting-name').value.trim()||session.user.name;meta.apiBase=API_DEFAULT;meta.token=session.token;save();try{const remote=await api('/tasks');const cached=new Map(tasks.map(t=>[String(t.id),t]));tasks=(remote||[]).map(item=>({...cached.get(String(item._id)),id:item._id,title:item.title,description:item.description||'',dueDate:item.dueDate||'',priority:item.priority||'medium',category:item.category||'Personal',important:Boolean(item.important),status:item.status||'Pending',completed:item.status==='Completed'||item.completed,createdAt:Date.parse(item.createdAt)||Date.now()}));save();render();toast('Settings saved and tasks refreshed.');}catch(e){toast(`Couldn’t refresh tasks: ${e.message}`);}}
function search(query=''){const results=tasks.filter(t=>t.title.toLowerCase().includes(query.toLowerCase())||t.category.toLowerCase().includes(query.toLowerCase())).slice(0,8);$('#search-results').innerHTML=results.length?results.map(t=>`<div class="search-result" data-search-id="${esc(t.id)}"><b>${esc(t.title)}</b><span>${esc(dateLabel(t.dueDate))}</span></div>`).join(''):`<div class="search-result"><b>No matching tasks</b></div>`;}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-auth-role]')){authMode=e.target.closest('[data-auth-role]').dataset.authRole;authView='login';renderAuth();return;}
 if(e.target.closest('[data-auth-view]')){authView=e.target.closest('[data-auth-view]').dataset.authView;renderAuth();return;}
 if(e.target.closest('[data-signout]')){localStorage.removeItem('daymark.session.v1');session=null;meta.token='';adminData=null;tasks=[];renderAuth('You have been signed out.');return;}
 if(e.target.closest('[data-admin-home]')){e.preventDefault();adminView='overview';selectedAdminUser=null;adminUserTasks=[];renderAdmin();return;}
 if(e.target.closest('[data-admin-profile]')){adminView='profile';renderAdmin();return;}
 const adminTab=e.target.closest('[data-admin-view]');if(adminTab){adminView=adminTab.dataset.adminView;selectedAdminUser=null;adminUserTasks=[];loadAdmin().catch(err=>{adminData=null;renderAdminError(err.message);});return;}
 if(e.target.closest('[data-admin-refresh]')){loadAdmin().catch(err=>renderAdminError(err.message));return;}
 if(e.target.closest('[data-clear-user]')){selectedAdminUser=null;adminUserTasks=[];renderAdmin();return;}
 const userTasksButton=e.target.closest('[data-user-tasks]');if(userTasksButton){const id=userTasksButton.dataset.userTasks;selectedAdminUser=adminData.users.find(u=>String(u.id||u._id)===id);api(`/admin/users/${encodeURIComponent(id)}/tasks`).then(data=>{adminUserTasks=data||[];renderAdmin();}).catch(err=>renderAdminError(err.message));return;}
 const page=e.target.closest('[data-page]'); if(page){e.preventDefault();setPage(page.dataset.page);return;}
 if(e.target.closest('#add-task,#inline-add,#mobile-add,[data-add-task]')){openEditor();return;}
 if(e.target.closest('[data-close-modal]')){modal(false);return;}
 if(e.target.closest('[data-close-detail]')){$('#detail-modal').classList.remove('open');return;}
 if(e.target.id==='task-modal'){modal(false);return;}
 if(e.target.id==='detail-modal'){$('#detail-modal').classList.remove('open');return;}
 if(e.target.closest('#search-trigger')){$('#search-modal').classList.add('open');$('#search-modal').setAttribute('aria-hidden','false');$('#search-input').focus();search();return;}
 if(e.target.id==='search-modal'){$('#search-modal').classList.remove('open');return;}
 const filter=e.target.closest('[data-filter]');if(filter){currentFilter=filter.dataset.filter;render();return;}
 if(e.target.closest('#sort-button')){sortByPriority=!sortByPriority;render();toast(sortByPriority?'Sorted by priority':'Sorted by date');return;}
 if(e.target.closest('#mobile-menu')){$('#sidebar').classList.toggle('open');return;}
 if(e.target.closest('#add-list')){const name=prompt('Name your list');if(name?.trim()){const fresh={name:name.trim(),color:'#8bac43',bg:'#edf2df'};if(!CATEGORIES.some(c=>c.name===fresh.name))CATEGORIES.push(fresh);render();}return;}
 const action=e.target.closest('[data-action]');if(action){const row=action.closest('.task-row'),id=row.dataset.id,t=tasks.find(x=>x.id===id);if(action.dataset.action==='important'){t.important=!t.important;save();render();syncTask(t);toast(t.important?'Added to Important':'Removed from Important');}if(action.dataset.action==='edit')openEditor(id);if(action.dataset.action==='delete'){tasks=tasks.filter(x=>x.id!==id);save();render();api(`/tasks/${encodeURIComponent(id)}`,{method:'DELETE'}).catch(err=>toast(`Couldn’t delete task: ${err.message}`));toast('Task deleted');}return;}
 const done=e.target.closest('[data-detail-done]');if(done){const t=tasks.find(x=>x.id===done.dataset.detailDone);toggleComplete(t.id,!t.completed);$('#detail-modal').classList.remove('open');return;}
 const edit=e.target.closest('[data-detail-edit]');if(edit){const id=edit.dataset.detailEdit;$('#detail-modal').classList.remove('open');openEditor(id);return;}
 const del=e.target.closest('[data-detail-delete]');if(del){const id=del.dataset.detailDelete;tasks=tasks.filter(x=>x.id!==id);save();$('#detail-modal').classList.remove('open');render();api(`/tasks/${encodeURIComponent(id)}`,{method:'DELETE'}).catch(err=>toast(`Couldn’t delete task: ${err.message}`));toast('Task deleted');return;}
 const result=e.target.closest('[data-search-id]');if(result){$('#search-modal').classList.remove('open');openDetails(result.dataset.searchId);return;}
 const task=e.target.closest('[data-open-task]');if(task)openDetails(task.dataset.openTask);
});
document.addEventListener('change',e=>{if(e.target.matches('.task-check')){const row=e.target.closest('.task-row');if(row)toggleComplete(row.dataset.id,e.target.checked);else if(e.target.dataset.completedId)toggleComplete(e.target.dataset.completedId,e.target.checked);}if(e.target.id==='status-filter'){statusFilter=e.target.value;render();}if(e.target.matches('[data-theme-toggle]'))setDarkMode(e.target.checked);});
$('#auth-screen').addEventListener('submit',async e=>{if(e.target.id!=='auth-form')return;e.preventDefault();const form=e.target,values=Object.fromEntries(new FormData(form));meta.apiBase=(values.api||API_DEFAULT).replace(/\/$/,'');meta.token='';const button=form.querySelector('.auth-submit');button.disabled=true;button.innerHTML='One moment…';try{if(authView==='register'){await api('/auth/register',{method:'POST',body:JSON.stringify({name:values.name,email:values.email,password:values.password})});authView='login';renderAuth('Account created. Sign in with your new details.');return;}const data=await api('/auth/login',{method:'POST',body:JSON.stringify({email:values.email,password:values.password})});if(data.user.role!==authMode){renderAuth(`This account is registered as ${data.user.role}. Choose the matching login above.`);return;}session={token:data.token,user:data.user};localStorage.setItem('daymark.session.v1',JSON.stringify(session));meta.token=data.token;meta.name=data.user.name;tasks=JSON.parse(localStorage.getItem(`daymark.tasks.${data.user.id}`)||'[]');if(data.user.role==='admin'){adminData=null;adminView='overview';renderAdmin();await loadAdmin();}else{const remote=await api('/tasks');const saved=new Map(tasks.map(t=>[String(t.id),t]));tasks=(remote||[]).map(item=>taskFromApi(item,saved.get(String(item._id))));save();currentPage='today';render();}}catch(error){renderAuth(error.message==='Failed to fetch'?'Could not reach the backend. Check that the API is running and the address is correct.':error.message);}finally{const next=$('#auth-form .auth-submit');if(next){next.disabled=false;next.innerHTML=`${authView==='register'?'Create account':authMode==='admin'?'Sign in as admin':'Sign in'} <span>→</span>`;}}});
$('#task-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;const data=new FormData(form);const old=tasks.find(t=>t.id===editingId);const task={id:editingId||uid(),title:data.get('title').trim(),description:data.get('description').trim(),dueDate:data.get('dueDate')||'',time:old?.time||'',priority:data.get('priority'),status:data.get('status'),category:data.get('category'),completed:data.get('status')==='Completed',important:old?.important||false,createdAt:old?.createdAt||Date.now()};try{if(editingId){await syncTask(task);tasks=tasks.map(t=>t.id===editingId?task:t);}else{const remote=await api('/tasks',{method:'POST',body:JSON.stringify({title:task.title,description:task.description,status:task.status,dueDate:task.dueDate,priority:task.priority,category:task.category,important:task.important})});task.id=remote._id;tasks.unshift({...task,...remote,id:remote._id,completed:remote.status==='Completed'});}save();modal(false);render();form.reset();toast(editingId?'Changes saved':'Task assigned to you');}catch(error){toast(`Couldn’t save task: ${error.message}`);}});
$('#search-input').addEventListener('input',e=>search(e.target.value));$('#search-input').addEventListener('keydown',e=>{if(e.key==='Enter'){const first=$('[data-search-id]');if(first){$('#search-modal').classList.remove('open');openDetails(first.dataset.searchId);}}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){modal(false);$('#search-modal').classList.remove('open');$('#detail-modal').classList.remove('open');$('#sidebar').classList.remove('open');}if((e.key==='n'||e.key==='N')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!e.metaKey&&!e.ctrlKey){e.preventDefault();openEditor();}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search-modal').classList.add('open');$('#search-input').focus();search();}});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('.clickable-user-row')){e.preventDefault();e.target.closest('.clickable-user-row').click();}});
document.addEventListener('click',e=>{if(e.target.closest('#sync-button'))syncAll();if(e.target.closest('#save-profile')){meta.name=$('#profile-name').value.trim()||'Tanvi Sharma';save();render();toast('Profile updated');}});
if(session){meta.apiBase=meta.apiBase||API_DEFAULT;meta.token=session.token;meta.name=session.user?.name||meta.name;if(session.user?.role==='admin'){loadAdmin().catch(error=>renderAdminError(error.message));}else{tasks=JSON.parse(localStorage.getItem(`daymark.tasks.${session.user.id}`)||'[]');render();api('/tasks').then(remote=>{const cached=new Map(tasks.map(t=>[String(t.id),t]));tasks=(remote||[]).map(item=>taskFromApi(item,cached.get(String(item._id))));save();render();}).catch(error=>{if(error.message.includes('token')||error.message.includes('Authentication')){localStorage.removeItem('daymark.session.v1');session=null;renderAuth('Your session has expired. Please sign in again.');}else toast(`Could not refresh tasks: ${error.message}`);});}}else render();
// AI Task Planner - Generate plan with Gemini
$('#ai-planner-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const goal = $('#ai-goal').value.trim();
  const button = $('#ai-generate-button');
  const message = $('#ai-planner-message');
  const results = $('#ai-planner-results');

  if (!goal) return;

  button.disabled = true;
  button.textContent = 'Generating your plan...';
  message.textContent = 'Gemini is creating your task plan...';
  results.replaceChildren();

  try {
    const base = (meta.apiBase || API_DEFAULT).replace(/\/$/, '');

    const response = await fetch(`${base}/ai/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.token || meta.token || ''}`
      },
      body: JSON.stringify({ goal })
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.message || 'Unable to generate plan.');
    }

    let plan = body.plan;

    if (typeof plan === 'string') {
      plan = JSON.parse(plan.replace(/```json|```/g, '').trim());
    }

    if (!Array.isArray(plan.tasks) || !plan.tasks.length) {
      throw new Error('Gemini returned no tasks.');
    }

    window.aiGeneratedTasks = plan.tasks;

    const list = document.createElement('div');
    list.className = 'ai-plan-list';

    plan.tasks.forEach((task, index) => {
      const item = document.createElement('article');
      item.className = 'ai-plan-item';

      const heading = document.createElement('strong');
      heading.textContent = `${index + 1}. ${task.title}`;

      const priority = document.createElement('span');
      priority.className = 'ai-plan-priority';
      priority.textContent = `Priority: ${task.priority || 'Medium'}`;

      const description = document.createElement('p');
      description.textContent = task.description || '';

      item.append(heading, priority, description);
      list.appendChild(item);
    });

    results.appendChild(list);
    const addButton = document.createElement('button');
addButton.type = 'button';
addButton.id = 'ai-add-tasks-button';
addButton.textContent = 'Add all tasks to my list';
results.appendChild(addButton);
    message.textContent = `Your plan is ready! ${plan.tasks.length} tasks generated.`;

  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = '✦ Generate my plan';
  }
  // Add AI-generated tasks to the user's task list
document.addEventListener('click', async (e) => {
  if (e.target.id !== 'ai-add-tasks-button') return;

  const button = e.target;
  const generated = window.aiGeneratedTasks || [];

  if (!generated.length) return;

  button.disabled = true;
  button.textContent = 'Adding tasks...';

  let added = 0;

  try {
    for (const item of generated) {
      const priority = ['high', 'medium', 'low'].includes(
        String(item.priority).toLowerCase()
      ) ? String(item.priority).toLowerCase() : 'medium';

      const remote = await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: item.title,
          description: item.description || '',
          status: 'Pending',
          priority,
          category: 'Personal',
          important: false
        })
      });

      tasks.unshift({
        id: remote._id || remote.id,
        title: remote.title || item.title,
        description: remote.description || item.description || '',
        dueDate: remote.dueDate || '',
        time: '',
        priority,
        status: remote.status || 'Pending',
        category: remote.category || 'Personal',
        completed: false,
        important: false,
        createdAt: Date.now()
      });

      added++;
    }

    save();
    render();
    toast(`${added} AI-generated tasks added to your list.`);
    window.aiGeneratedTasks = [];

  } catch (error) {
    toast(`${added} tasks added. Error: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Add all tasks to my list';
  }
});
});