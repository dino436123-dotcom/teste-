/* Serena — agenda pessoal. Dados guardados localmente no navegador. */
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const todayISO = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const dateISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d,12); };
const fmtDate = (s, opts={weekday:'long',day:'numeric',month:'long'}) => s ? parseDate(s).toLocaleDateString('pt-BR',opts) : '';
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const escapeHTML = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const priorityText = {high:'Urgente',medium:'Importante',low:'Tranquila'};
const weekStart = (date=new Date()) => { const d=new Date(date); d.setHours(12,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d; };
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };

const defaultState = () => ({
  events: [], tasks: [], habits: [
    {id:uid(),title:'Beber água',goal:7,checks:{}},
    {id:uid(),title:'Ler um pouco',goal:5,checks:{}},
    {id:uid(),title:'Movimentar o corpo',goal:3,checks:{}}
  ],
  settings:{}
});
let state = defaultState();
let currentView = 'today';
let calendarMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1);
let selectedDate = todayISO();
let taskFilter = 'all';
let toastTimer;

function openDB(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){resolve(null);return;}
    const req=indexedDB.open('serena-agenda',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('app',{keyPath:'id'});
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
let dbPromise = openDB().catch(()=>null);
async function loadState(){
  const db=await dbPromise;
  if(db){
    const saved=await new Promise(resolve=>{
      const req=db.transaction('app','readonly').objectStore('app').get('main');
      req.onsuccess=()=>resolve(req.result?.data||null);req.onerror=()=>resolve(null);
    });
    if(saved){state={...defaultState(),...saved};return;}
  }
  try{const raw=localStorage.getItem('serena-data');if(raw)state={...defaultState(),...JSON.parse(raw)};}catch(e){console.warn(e);}
}
async function saveState(){
  const db=await dbPromise;
  if(db){
    await new Promise(resolve=>{const tx=db.transaction('app','readwrite');tx.objectStore('app').put({id:'main',data:state});tx.oncomplete=resolve;tx.onerror=resolve;});
  }else{try{localStorage.setItem('serena-data',JSON.stringify(state));}catch(e){showToast('Não foi possível salvar. Exporte um backup.');}}
}
function showToast(message){
  const el=$('#toast');el.textContent=message;el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);
}
function setView(view){
  currentView=view;
  $$('.nav-item,[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  render();
}
function heading(kicker,title,subtitle,buttonText='',buttonAction=''){
  return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${subtitle}</p></div>${buttonText?`<button class="button button-primary" data-action="${buttonAction}">＋ ${buttonText}</button>`:''}</div>`;
}
function emptyState(icon,title,description,buttonText='',action=''){
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><strong>${title}</strong><p>${description}</p>${buttonText?`<button class="button button-ghost button-small" data-action="${action}">${buttonText}</button>`:''}</div>`;
}
function eventTime(ev){return ev.time||'Horário livre';}
function eventCard(ev){
  return `<div class="agenda-item"><div class="agenda-time">${escapeHTML(eventTime(ev))}</div><div class="agenda-line"></div><div><div class="agenda-title">${escapeHTML(ev.title)}</div><div class="agenda-meta">${escapeHTML(ev.category||'Pessoal')}${ev.shared?' · ♡ Compartilhado':''}${ev.notes?' · '+escapeHTML(ev.notes):''}</div></div><div class="task-actions"><button class="small-icon-btn" data-action="edit-event" data-id="${ev.id}" aria-label="Editar">✎</button><button class="small-icon-btn" data-action="delete-event" data-id="${ev.id}" aria-label="Excluir">×</button></div></div>`;
}
function taskRow(task){
  return `<div class="task-row ${task.done?'done':''}"><input class="task-check" type="checkbox" data-action="toggle-task" data-id="${task.id}" ${task.done?'checked':''} aria-label="Concluir tarefa"><div class="task-copy"><strong>${escapeHTML(task.title)}</strong><small><span class="priority ${task.priority}"></span>${priorityText[task.priority]||'Importante'}${task.date?' · '+escapeHTML(fmtDate(task.date,{day:'numeric',month:'short'})):''} · ${escapeHTML(task.category||'Pessoal')}</small></div><div class="task-actions"><button class="small-icon-btn" data-action="edit-task" data-id="${task.id}" aria-label="Editar tarefa">✎</button><button class="small-icon-btn" data-action="delete-task" data-id="${task.id}" aria-label="Excluir tarefa">×</button></div></div>`;
}
function eventsFor(date){return state.events.filter(e=>e.date===date).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));}
function tasksFor(date){return state.tasks.filter(t=>!t.done&&(!t.date||t.date===date));}
function habitDone(h,date=todayISO()){return Boolean(h.checks?.[date]);}
function weekDates(start=weekStart()){return Array.from({length:7},(_,i)=>dateISO(addDays(start,i)));}
function weekTasks(){const days=weekDates();return state.tasks.filter(t=>t.done&&t.completedAt&&days.includes(t.completedAt.slice(0,10)));}
function renderToday(){
  const today=todayISO(), events=eventsFor(today), tasks=tasksFor(today), done=state.tasks.filter(t=>t.done).length;
  const habits=state.habits;
  const progress=state.tasks.length?Math.round(done/state.tasks.length*100):0;
  return heading('SEU ESPAÇO, SEU RITMO','Olá, que bom ter você aqui.','Um dia de cada vez. Organize o que importa para você.','Novo compromisso','new-event')+
  `<div class="grid-main">
    <div class="panel"><div class="panel-head"><div><h2>Agenda de hoje</h2><div class="panel-subtitle">${fmtDate(today)}</div></div><span class="date-pill">${events.length} ${events.length===1?'compromisso':'compromissos'}</span></div>
    <div class="agenda-list">${events.length?events.map(eventCard).join(''):emptyState('✿','Seu dia está em aberto','Adicione um compromisso para dar forma ao seu dia.','Adicionar compromisso','new-event')}</div>
    <div class="section-gap"><button class="button button-ghost button-small" data-action="go-calendar">Ver calendário completo →</button></div></div>
    <div class="panel"><div class="panel-head"><div><h2>Pequenas prioridades</h2><div class="panel-subtitle">O que merece atenção hoje</div></div><button class="small-icon-btn" data-action="new-task">＋</button></div>
      <div class="task-list">${tasks.length?tasks.slice(0,5).map(taskRow).join(''):emptyState('✓','Tudo em dia','Sem tarefas pendentes para hoje. Que tal descansar um pouco?','Criar tarefa','new-task')}</div>
      <div class="progress-label"><span>Progresso das tarefas</span><strong>${progress}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
    </div>
    <div class="panel"><div class="panel-head"><div><h2>Um cuidado por vez</h2><div class="panel-subtitle">Seus hábitos de hoje</div></div><button class="small-icon-btn" data-action="go-habits">Ver todos →</button></div>
      ${habits.length?habits.slice(0,4).map(h=>`<div class="habit-mini"><div class="habit-icon">✳</div><div><strong>${escapeHTML(h.title)}</strong><small>Meta: ${h.goal} ${h.goal===1?'vez':'vezes'} por semana</small></div><button class="mini-check ${habitDone(h)?'checked':''}" data-action="toggle-habit" data-id="${h.id}" aria-label="Marcar hábito">${habitDone(h)?'✓':'○'}</button></div>`).join(''):emptyState('✳','Crie seu primeiro hábito','Pequenas ações se tornam grandes mudanças.','Novo hábito','new-habit')}
    </div>
    <div class="panel"><div class="panel-head"><div><h2>Uma pausa para você</h2><div class="panel-subtitle">Lembrete gentil</div></div><span>☼</span></div><p style="font:500 20px/1.45 'Playfair Display',serif;margin:4px 0 12px">“Não precisa fazer tudo hoje. Só o próximo passo.”</p><div class="panel-subtitle">Seu bem-estar também faz parte dos planos.</div></div>
  </div>`;
}
function renderCalendar(){
  const year=calendarMonth.getFullYear(),month=calendarMonth.getMonth();
  const first=new Date(year,month,1),offset=(first.getDay()+6)%7,daysIn=new Date(year,month+1,0).getDate();
  const cells=[];
  for(let i=0;i<offset;i++){const d=new Date(year,month,1-offset+i);cells.push({date:dateISO(d),day:d.getDate(),outside:true});}
  for(let d=1;d<=daysIn;d++)cells.push({date:dateISO(new Date(year,month,d)),day:d,outside:false});
  while(cells.length%7) {const last=parseDate(cells[cells.length-1].date);const d=addDays(last,1);cells.push({date:dateISO(d),day:d.getDate(),outside:true});}
  const days=['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
  const selected=eventsFor(selectedDate);
  return heading('VISÃO GERAL','Seu calendário','Todos os seus planos, com espaço para respirar.','Novo compromisso','new-event')+
  `<div class="panel calendar-panel"><div class="calendar-top"><h2>${calendarMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h2><div class="calendar-controls"><button class="circle-btn" data-action="prev-month" aria-label="Mês anterior">‹</button><button class="circle-btn" data-action="this-month" aria-label="Mês atual">•</button><button class="circle-btn" data-action="next-month" aria-label="Próximo mês">›</button></div></div>
  <div class="calendar-grid">${days.map(d=>`<div class="weekday">${d}</div>`).join('')}${cells.map(c=>{const ev=state.events.some(e=>e.date===c.date),task=state.tasks.some(t=>t.date===c.date&&!t.done);return `<button class="day-cell ${c.outside?'outside':''} ${c.date===todayISO()?'today':''} ${c.date===selectedDate?'selected':''}" data-action="select-date" data-date="${c.date}"><span class="day-number">${c.day}</span><span class="day-dots">${ev?'<i class="day-dot"></i>':''}${task?'<i class="day-dot task"></i>':''}</span></button>`;}).join('')}</div>
  <div class="selected-date-list"><div class="panel-head"><div><h3>${fmtDate(selectedDate,{weekday:'long',day:'numeric',month:'long'})}</h3><div class="panel-subtitle">${selected.length} compromisso(s) neste dia</div></div><button class="button button-primary button-small" data-action="new-event-selected">＋ Adicionar</button></div>
  <div class="agenda-list">${selected.length?selected.map(eventCard).join(''):emptyState('✿','Nada marcado por aqui','Este espaço está livre para o que você precisar.','','')}</div></div></div>`;
}
function renderTasks(){
  const tasks=[...state.tasks].sort((a,b)=>Number(a.done)-Number(b.done)||({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority]));
  const filtered=tasks.filter(t=>taskFilter==='all'||(taskFilter==='open'&&!t.done)||(taskFilter==='done'&&t.done));
  return heading('LISTA COM INTENÇÃO','Tarefas','Tire as ideias da cabeça e coloque-as no papel.','Nova tarefa','new-task')+
  `<div class="panel"><div class="panel-head"><div><h2>Minha lista</h2><div class="panel-subtitle">${state.tasks.filter(t=>!t.done).length} tarefas por concluir · ${state.tasks.filter(t=>t.done).length} concluídas</div></div></div>
  <div class="filters">${[['all','Todas'],['open','Pendentes'],['done','Concluídas']].map(([v,l])=>`<button class="filter-btn ${taskFilter===v?'active':''}" data-action="filter-tasks" data-filter="${v}">${l}</button>`).join('')}</div>
  <div class="task-list">${filtered.length?filtered.map(taskRow).join(''):emptyState('✓','Nenhuma tarefa nesta lista','Aproveite o espaço ou adicione uma nova tarefa.','Adicionar tarefa','new-task')}</div></div>`;
}
function renderHabits(){
  const days=weekDates(),labels=['S','T','Q','Q','S','S','D'];
  return heading('PEQUENOS PASSOS','Hábitos & metas','Consistência gentil, sem buscar perfeição.','Novo hábito','new-habit')+
  `<div class="grid-main"><div class="panel"><div class="panel-head"><div><h2>Seus hábitos</h2><div class="panel-subtitle">Marque cada dia em que você conseguiu</div></div><span class="date-pill">Esta semana</span></div>
  ${state.habits.length?state.habits.map(h=>{const count=days.filter(d=>h.checks?.[d]).length;return `<div class="share-card"><div class="habit-icon">✳</div><div class="share-content"><strong>${escapeHTML(h.title)}</strong><p>${count} de ${h.goal} vezes na semana · ${Math.min(100,Math.round(count/h.goal*100))}% da meta</p><div class="week-dots">${days.map((d,i)=>`<button class="week-dot ${h.checks?.[d]?'done':''}" data-action="toggle-habit-date" data-id="${h.id}" data-date="${d}" aria-label="${labels[i]} ${d}">${labels[i]}</button>`).join('')}</div></div><button class="small-icon-btn danger" data-action="delete-habit" data-id="${h.id}" aria-label="Excluir hábito">×</button></div>`;}).join(''):emptyState('✳','Comece com um hábito','Escolha uma pequena ação que faça bem a você.','Criar hábito','new-habit')}
  </div><div class="panel"><div class="panel-head"><div><h2>Metas com leveza</h2><div class="panel-subtitle">Uma semana de cada vez</div></div></div>
  <div class="notice">Uma meta realista vale mais do que uma rotina impossível de manter. Ajuste os dias e a frequência conforme sua vida muda.</div>
  <div class="section-gap"><h3 style="font:500 19px 'Playfair Display',serif">Seu progresso semanal</h3>${state.habits.map(h=>{const n=days.filter(d=>h.checks?.[d]).length;return `<div class="progress-label"><span>${escapeHTML(h.title)}</span><strong>${n}/${h.goal}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,n/h.goal*100)}%"></div></div>`}).join('')||'<p class="empty-compact">Seus hábitos aparecerão aqui.</p>'}</div></div></div>`;
}
function renderReports(){
  const days=weekDates(),completed=weekTasks(),due=state.tasks.filter(t=>t.date&&days.includes(t.date)),habitChecks=state.habits.reduce((n,h)=>n+days.filter(d=>h.checks?.[d]).length,0),possible=state.habits.reduce((n,h)=>n+Math.min(h.goal,7),0);
  const evCount=state.events.filter(e=>days.includes(e.date)).length;
  const bars=days.map((d,i)=>({date:d,label:['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i],count:state.tasks.filter(t=>t.done&&t.completedAt?.slice(0,10)===d).length}));
  const max=Math.max(1,...bars.map(b=>b.count));
  return heading('OLHAR PARA TRÁS','Seu resumo semanal','Reconheça o que você fez — cada passo conta.','Planejar a semana','go-calendar')+
  `<div class="metric-grid"><div class="metric-card"><div class="metric-label">Tarefas concluídas</div><div class="metric-number">${completed.length}</div><div class="metric-note">nesta semana</div></div><div class="metric-card"><div class="metric-label">Compromissos</div><div class="metric-number">${evCount}</div><div class="metric-note">na sua agenda</div></div><div class="metric-card"><div class="metric-label">Hábitos marcados</div><div class="metric-number">${habitChecks}</div><div class="metric-note">registros da semana</div></div></div>
  <div class="grid-main"><div class="panel"><div class="panel-head"><div><h2>Ritmo da semana</h2><div class="panel-subtitle">Tarefas concluídas por dia</div></div><span class="date-pill">${fmtDate(days[0],{day:'numeric',month:'short'})} – ${fmtDate(days[6],{day:'numeric',month:'short'})}</span></div>
  <div class="bar-chart">${bars.map((b,i)=>`<div class="bar-group"><div class="bar ${b.date===todayISO()?'today-bar':''}" style="height:${Math.max(3,b.count/max*100)}%" title="${b.count} tarefa(s)"></div><span class="bar-label">${b.label}</span></div>`).join('')}</div><div class="progress-label"><span>Tarefas com prazo nesta semana</span><strong>${due.filter(t=>t.done).length}/${due.length}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${due.length?due.filter(t=>t.done).length/due.length*100:0}%"></div></div></div>
  <div class="panel"><div class="panel-head"><div><h2>Um balanço gentil</h2><div class="panel-subtitle">O que seus registros contam</div></div><span>✿</span></div>
  <p style="font:500 19px/1.45 'Playfair Display',serif">Você está construindo sua própria maneira de viver bem.</p><p class="panel-subtitle" style="line-height:1.7">Você marcou ${habitChecks} realização(ões) de hábitos nesta semana. Use os números como referência, não como cobrança.</p><div class="notice section-gap">Dica: escolha até três prioridades para a próxima semana e deixe espaço para imprevistos.</div></div></div>`;
}
function renderShare(){
  const shared=state.events.filter(e=>e.shared).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  return heading('SÓ O QUE VOCÊ ESCOLHER','Compartilhar momentos','Sua agenda continua privada. Você decide o que dividir.','Novo compromisso','new-event')+
  `<div class="grid-main"><div class="panel"><div class="panel-head"><div><h2>Compromissos selecionados</h2><div class="panel-subtitle">${shared.length} compromisso(s) marcado(s) para compartilhar</div></div><span class="date-pill">♡ Compartilhamento</span></div>
  ${shared.length?shared.map(ev=>`<div class="share-card"><div class="share-icon">♡</div><div class="share-content"><strong>${escapeHTML(ev.title)}</strong><p>${fmtDate(ev.date,{day:'numeric',month:'long',year:'numeric'})}${ev.time?' · '+escapeHTML(ev.time):''} · ${escapeHTML(ev.category||'Pessoal')}</p><div class="share-actions"><button class="button button-ghost button-small" data-action="share-event" data-id="${ev.id}">Compartilhar</button><button class="inline-link" data-action="unshare-event" data-id="${ev.id}">Tornar privado</button></div></div></div>`).join(''):emptyState('♡','Nenhum compromisso compartilhado','Ao criar ou editar um compromisso, marque a opção de compartilhar. Só esses itens aparecerão aqui.','Criar compromisso','new-event')}
  </div><div class="panel"><div class="panel-head"><div><h2>Como funciona</h2><div class="panel-subtitle">Você no controle</div></div></div>
  <div class="notice">Esta versão não envia dados automaticamente para ninguém. O botão “Compartilhar” prepara o texto do compromisso para você enviar pelo menu de compartilhamento do celular ou copiar. O restante da agenda fica neste aparelho.</div>
  <div class="section-gap"><h3 style="font:500 18px 'Playfair Display',serif">Privacidade em primeiro lugar</h3><p class="panel-subtitle" style="line-height:1.8">O compartilhamento é manual. Não há uma conta compartilhada nem sincronização automática com outro celular. Para uma agenda conjunta ao vivo, seria necessário adicionar um serviço de sincronização e autenticação numa versão futura.</p></div></div></div>`;
}
function render(){
  $('#sidebarDate').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  const root=$('#viewRoot');
  root.innerHTML=({today:renderToday,calendar:renderCalendar,tasks:renderTasks,habits:renderHabits,reports:renderReports,share:renderShare}[currentView]||renderToday)();
  $$('.nav-item,[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
}
function showDialog(id){const d=$('#'+id);if(d.showModal)d.showModal();else d.setAttribute('open','');}
function closeDialog(id){const d=$('#'+id);if(d.close)d.close();else d.removeAttribute('open');}
function openEvent(date=todayISO(),event=null){
  $('#eventForm').reset();$('#eventId').value=event?.id||'';$('#eventTitle').value=event?.title||'';
  $('#eventDate').value=event?.date||date;$('#eventTime').value=event?.time||'';$('#eventCategory').value=event?.category||'Pessoal';
  $('#eventReminder').value=String(event?.reminder||0);$('#eventNotes').value=event?.notes||'';$('#eventShared').checked=!!event?.shared;
  $('#eventDialogTitle').textContent=event?'Editar compromisso':'Novo compromisso';showDialog('eventDialog');
}
function openTask(task=null){
  $('#taskForm').reset();$('#taskId').value=task?.id||'';$('#taskTitle').value=task?.title||'';$('#taskDate').value=task?.date||selectedDate||todayISO();
  $('#taskPriority').value=task?.priority||'medium';$('#taskCategory').value=task?.category||'Pessoal';showDialog('taskDialog');
}
function eventReminderSchedule(){
  // O agendamento local só pode avisar enquanto a página estiver aberta.
  // Para notificações confiáveis com o app fechado, é preciso push/backend ou recursos nativos.
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const now=Date.now();
  state.events.forEach(ev=>{
    if(!ev.reminder||!ev.time||ev.date<todayISO())return;
    const [hh,mm]=ev.time.split(':').map(Number),dt=parseDate(ev.date);dt.setHours(hh,mm,0,0);
    const target=dt.getTime()-Number(ev.reminder)*60000;
    if(target>now&&target-now<24*60*60*1000){
      const key=`reminded-${ev.id}-${ev.date}-${ev.time}`;
      if(sessionStorage.getItem(key))return;
      setTimeout(()=>{if(Date.now()>=target-1000){new Notification('Lembrete — Serena',{body:`${ev.title}${ev.time?' às '+ev.time:''}`});sessionStorage.setItem(key,'1');}},target-now);
    }
  });
}
async function requestNotifications(){
  if(!('Notification' in window)){showToast('Este navegador não oferece notificações.');return;}
  if(!window.isSecureContext){showToast('Notificações exigem HTTPS ou localhost.');return;}
  const permission=await Notification.requestPermission();
  showToast(permission==='granted'?'Notificações ativadas enquanto o app estiver aberto.': 'Permissão de notificação não concedida.');
  eventReminderSchedule();
}
function downloadJSON(obj,name){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
function exportBackup(){downloadJSON({format:'serena-backup',version:1,exportedAt:new Date().toISOString(),data:state},`serena-backup-${todayISO()}.json`);showToast('Backup exportado. Guarde o arquivo em local seguro.');}
async function importBackup(file){
  try{const parsed=JSON.parse(await file.text());const data=parsed.data||parsed;if(!Array.isArray(data.events)||!Array.isArray(data.tasks)||!Array.isArray(data.habits))throw new Error('Formato inválido');
    if(!confirm('Importar este backup substituirá os dados atuais desta agenda. Deseja continuar?'))return;
    state={...defaultState(),...data};await saveState();render();showToast('Backup importado com sucesso.');
  }catch(e){showToast('Não foi possível importar. Escolha um backup Serena válido.');}
}
function shareEvent(ev){
  const text=`♡ Vamos combinar?\n${ev.title}\n${fmtDate(ev.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}${ev.time?' às '+ev.time:''}${ev.category?'\nCategoria: '+ev.category:''}${ev.notes?'\n'+ev.notes:''}\n\nCompartilhado pelo Serena`;
  if(navigator.share){navigator.share({title:'Compromisso — Serena',text}).catch(()=>{});}
  else if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(()=>showToast('Detalhes copiados para compartilhar.')).catch(()=>downloadJSON({text},'compromisso-serena.json'));}
  else{downloadJSON({text},'compromisso-serena.json');showToast('Texto salvo em arquivo para compartilhar.');}
}
async function action(el){
  const a=el.dataset.action,id=el.dataset.id;
  if(a==='new-event'){openEvent(currentView==='calendar'?selectedDate:todayISO());return;}
  if(a==='new-event-selected'){openEvent(selectedDate);return;}
  if(a==='new-task'){openTask();return;}
  if(a==='new-habit'){showDialog('habitDialog');return;}
  if(a==='go-calendar'){setView('calendar');return;}
  if(a==='go-habits'){setView('habits');return;}
  if(a==='prev-month'){calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);render();return;}
  if(a==='next-month'){calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);render();return;}
  if(a==='this-month'){calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);selectedDate=todayISO();render();return;}
  if(a==='select-date'){selectedDate=el.dataset.date;render();return;}
  if(a==='filter-tasks'){taskFilter=el.dataset.filter;render();return;}
  if(a==='edit-event'){const ev=state.events.find(x=>x.id===id);if(ev)openEvent(ev.date,ev);return;}
  if(a==='delete-event'){if(confirm('Excluir este compromisso?')){state.events=state.events.filter(x=>x.id!==id);await saveState();render();showToast('Compromisso excluído.');}return;}
  if(a==='edit-task'){const t=state.tasks.find(x=>x.id===id);if(t)openTask(t);return;}
  if(a==='delete-task'){if(confirm('Excluir esta tarefa?')){state.tasks=state.tasks.filter(x=>x.id!==id);await saveState();render();showToast('Tarefa excluída.');}return;}
  if(a==='toggle-task'){const t=state.tasks.find(x=>x.id===id);if(t){t.done=el.checked;t.completedAt=el.checked?new Date().toISOString():null;await saveState();render();}return;}
  if(a==='toggle-habit'||a==='toggle-habit-date'){const h=state.habits.find(x=>x.id===id);if(h){const d=a==='toggle-habit-date'?el.dataset.date:todayISO();h.checks=h.checks||{};if(h.checks[d])delete h.checks[d];else h.checks[d]=true;await saveState();render();}return;}
  if(a==='delete-habit'){if(confirm('Excluir este hábito e seu histórico?')){state.habits=state.habits.filter(x=>x.id!==id);await saveState();render();}return;}
  if(a==='share-event'){const ev=state.events.find(x=>x.id===id);if(ev)shareEvent(ev);return;}
  if(a==='unshare-event'){const ev=state.events.find(x=>x.id===id);if(ev){ev.shared=false;await saveState();render();showToast('Compromisso voltou a ser privado.');}return;}
}
document.addEventListener('click',e=>{
  const close=e.target.closest('[data-close]');if(close){closeDialog(close.dataset.close);return;}
  const nav=e.target.closest('[data-view]');if(nav){setView(nav.dataset.view);return;}
  const act=e.target.closest('[data-action]');if(act){action(act);}
});
$('#eventForm').addEventListener('submit',async e=>{
  e.preventDefault();const id=$('#eventId').value;
  const ev={id:id||uid(),title:$('#eventTitle').value.trim(),date:$('#eventDate').value,time:$('#eventTime').value,category:$('#eventCategory').value,reminder:Number($('#eventReminder').value),notes:$('#eventNotes').value.trim(),shared:$('#eventShared').checked};
  if(!ev.title||!ev.date)return;
  if(id)state.events=state.events.map(x=>x.id===id?ev:x);else state.events.push(ev);
  await saveState();closeDialog('eventDialog');selectedDate=ev.date;calendarMonth=new Date(parseDate(ev.date).getFullYear(),parseDate(ev.date).getMonth(),1);render();eventReminderSchedule();showToast('Compromisso salvo.');
});
$('#taskForm').addEventListener('submit',async e=>{
  e.preventDefault();const id=$('#taskId').value,old=state.tasks.find(x=>x.id===id);
  const t={id:id||uid(),title:$('#taskTitle').value.trim(),date:$('#taskDate').value,priority:$('#taskPriority').value,category:$('#taskCategory').value,done:old?.done||false,completedAt:old?.completedAt||null};
  if(!t.title)return;if(id)state.tasks=state.tasks.map(x=>x.id===id?t:x);else state.tasks.push(t);
  await saveState();closeDialog('taskDialog');render();showToast('Tarefa salva.');
});
$('#habitForm').addEventListener('submit',async e=>{
  e.preventDefault();const title=$('#habitTitle').value.trim();if(!title)return;
  state.habits.push({id:uid(),title,goal:Number($('#habitGoal').value),checks:{}});await saveState();closeDialog('habitDialog');render();showToast('Hábito criado.');
});
$('#notificationBtn').addEventListener('click',requestNotifications);
$('#exportBtn').addEventListener('click',exportBackup);
$('#importInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importBackup(f);e.target.value='';});
if('serviceWorker' in navigator && location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
(async()=>{await loadState();render();eventReminderSchedule();})();
