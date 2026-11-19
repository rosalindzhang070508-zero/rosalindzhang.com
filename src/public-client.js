import autoAnimate from '/vendor/auto-animate.mjs';

const $=selector=>document.querySelector(selector);
function clock(){const now=new Date();const date=$('#liveDate'),time=$('#liveTime');if(date)date.textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Singapore',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(now);if(time){time.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);time.dateTime=now.toISOString();}}
clock();setInterval(clock,1000);

const hosts=['bbc.com','bbc.co.uk','solidot.org','sciencedaily.com','theguardian.com','ycombinator.com','youtube.com','youtu.be','x.com'];
function safeLink(text){try{const url=new URL(text);return url.protocol==='https:'&&hosts.some(host=>url.hostname===host||url.hostname.endsWith('.'+host))?url.href:null;}catch{return null;}}
const localTime=value=>{const date=value?new Date(value):null;return date&&!Number.isNaN(date)?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Singapore',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date):'日期未提供';};

let entries=[],sources=[],active='全部',activeSource='all',activeFolder='world',forceNewsRefresh=false;
const folderEntries=folder=>{const categories=(folder.dataset.newsFolderCategories||'').split(',').filter(Boolean);return entries.filter(item=>categories.includes(item.category));};
const folderPasses=item=>{if(!activeFolder)return true;const folder=document.querySelector(`[data-news-folder="${activeFolder}"]`);return !folder||folderEntries(folder).some(entry=>entry.url===item.url);};

function renderNewsFolders(){for(const folder of document.querySelectorAll('[data-news-folder]')){const items=folderEntries(folder);const categories=(folder.dataset.newsFolderCategories||'').split(',').filter(Boolean);folder.setAttribute('aria-pressed',String(folder.dataset.newsFolder===activeFolder));folder.querySelector('[data-news-folder-count]')?.replaceChildren(document.createTextNode(`${items.length} 条更新`));folder.querySelector('[data-news-folder-summary]')?.replaceChildren(document.createTextNode(categories.join(' / ')));folder.querySelectorAll('[data-news-folder-paper]').forEach((paper,index)=>{const item=items[index];paper.hidden=!item;paper.textContent=item?`${item.source} · ${item.title}`:'';});}}

function showNews(){const list=$('#dailyNews');if(!list)return;list.replaceChildren();const visible=entries.filter(item=>(active==='全部'||item.category===active)&&(activeSource==='all'||item.sourceId===activeSource)&&folderPasses(item)).slice(0,24);for(const item of visible){const article=document.createElement('a');article.className='news-item';article.href=safeLink(item.url)||'#';article.target='_blank';article.rel='noopener noreferrer';const meta=document.createElement('small');meta.textContent=`${item.kind} · ${item.category} · ${item.source} · ${localTime(item.publishedAt)}`;const title=document.createElement('h3');title.textContent=item.title;article.append(meta,title);list.append(article);}if(!visible.length){const message=document.createElement('p');message.className='news-empty';message.textContent='此筛选下暂时没有可显示的条目。';list.append(message);}}

function renderSourceControls(){const holder=$('#newsSources');if(!holder)return;holder.replaceChildren();for(const source of [{id:'all',name:'全部来源',state:'active'},...sources]){const button=document.createElement('button');button.type='button';button.className='news-source';button.textContent=source.state==='optional'?`${source.name} · 待连接`:source.state==='unavailable'?`${source.name} · 暂不可用`:source.name;button.dataset.newsSource=source.id;button.setAttribute('aria-pressed',String(activeSource===source.id));button.title=source.state==='active'?`只显示 ${source.name}`:`${source.name} 当前不可用`;if(source.state!=='active')button.disabled=true;holder.append(button);}}

function setTopicSelection(value){active=value;for(const button of document.querySelectorAll('[data-news-filter]'))button.setAttribute('aria-pressed',String(button.dataset.newsFilter===value));}
function setFolderSelection(value){activeFolder=value;renderNewsFolders();}
function folderStatus(){const folder=document.querySelector(`[data-news-folder="${activeFolder}"]`);if(!folder)return;const status=$('#newsStatus');if(status)status.textContent=`已打开“${folder.querySelector('strong')?.textContent||'新闻文件夹'}” · 可继续按来源或主题细筛。`;}

async function loadNews(){const status=$('#newsStatus');if(!status)return;status.textContent=forceNewsRefresh?'正在从各来源更新…':'正在读取来源…';try{const response=await fetch(`/api/news${forceNewsRefresh?'?refresh=1':''}`,{credentials:'omit'});forceNewsRefresh=false;if(!response.ok)throw Error();const data=await response.json();entries=Array.isArray(data.items)?data.items.filter(item=>safeLink(item.url)):[];sources=Array.isArray(data.sources)?data.sources:[];renderNewsFolders();renderSourceControls();showNews();const unavailable=sources.filter(source=>source.state==='unavailable').length;const optional=sources.filter(source=>source.state==='optional').length;status.textContent=`${entries.length} 条更新 · ${sources.filter(source=>source.state==='active').length} 个活跃来源 · ${new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(data.updatedAt))}（UTC+8）${unavailable?` · ${unavailable} 个来源暂不可用`:''}${optional?' · X 可在配置官方 API 后启用':''}`;}catch{forceNewsRefresh=false;entries=[];sources=[];renderNewsFolders();renderSourceControls();status.textContent='新闻服务暂不可用。请稍后重试，或直接访问来源网站。';const list=$('#dailyNews');if(list){list.replaceChildren();for(const [name,url] of [['BBC News','https://www.bbc.com/news'],['The Guardian','https://www.theguardian.com/'],['Solidot','https://www.solidot.org/'],['YouTube','https://www.youtube.com/']]){const item=document.createElement('a');item.href=url;item.textContent=name;item.target='_blank';item.rel='noopener noreferrer';item.className='news-item';list.append(item);}}}}

for(const list of [$('#dailyNews'),$('#newsSources')])if(list)autoAnimate(list,{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'});
document.querySelectorAll('[data-news-filter]').forEach(button=>button.addEventListener('click',()=>{setTopicSelection(button.dataset.newsFilter);setFolderSelection(null);showNews();}));
$('#newsFolders')?.addEventListener('click',event=>{const folder=event.target.closest('[data-news-folder]');if(!folder)return;setTopicSelection('全部');setFolderSelection(folder.dataset.newsFolder);showNews();folderStatus();});
$('#newsSources')?.addEventListener('click',event=>{const button=event.target.closest('[data-news-source]');if(!button)return;activeSource=button.dataset.newsSource;document.querySelectorAll('[data-news-source]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));showNews();});

const NEWS_REFRESH_MS=30*60*1000;
let newsPending=false,lastNewsAttempt=0;
async function refreshNews(){if(newsPending)return;newsPending=true;lastNewsAttempt=Date.now();try{await loadNews();}finally{newsPending=false;}}
function refreshVisibleNews(){if(!document.hidden&&Date.now()-lastNewsAttempt>=NEWS_REFRESH_MS)void refreshNews();}
$('#refreshNews')?.addEventListener('click',()=>{forceNewsRefresh=true;void refreshNews();});
void refreshNews();
setInterval(refreshVisibleNews,60*1000);
document.addEventListener('visibilitychange',refreshVisibleNews);
window.addEventListener('pageshow',refreshVisibleNews);
window.addEventListener('online',()=>{if(!document.hidden)void refreshNews();});
document.querySelectorAll('[data-work-filter]').forEach(button=>button.addEventListener('click',()=>{const value=button.dataset.workFilter;document.querySelectorAll('[data-work-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));document.querySelectorAll('[data-work-category]').forEach(card=>{card.hidden=value!=='全部'&&card.dataset.workCategory!==value;});}));
