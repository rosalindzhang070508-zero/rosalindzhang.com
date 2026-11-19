import {createRemoteJWKSet,jwtVerify} from 'jose';
import {XMLParser} from 'fast-xml-parser';
const keysets=new Map();
export const feeds=[
 {id:'bbc-zh',name:'BBC 中文',category:'新闻',kind:'刊物',url:'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml',home:'https://www.bbc.com/zhongwen/simp',hosts:['bbc.com','bbc.co.uk']},
 {id:'bbc-world',name:'BBC World',category:'新闻',kind:'刊物',url:'https://feeds.bbci.co.uk/news/world/rss.xml',home:'https://www.bbc.com/news/world',hosts:['bbc.com','bbc.co.uk']},
 {id:'bbc-science',name:'BBC Science',category:'科研',kind:'刊物',url:'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',home:'https://www.bbc.com/news/science_and_environment',hosts:['bbc.com','bbc.co.uk']},
 {id:'solidot',name:'Solidot',category:'科技',kind:'刊物',url:'https://www.solidot.org/index.rss',home:'https://www.solidot.org/',hosts:['solidot.org']},
 {id:'hacker-news',name:'Hacker News',category:'科技',kind:'社区',url:'https://news.ycombinator.com/rss',home:'https://news.ycombinator.com/',hosts:['news.ycombinator.com']},
 {id:'sciencedaily',name:'ScienceDaily',category:'医学',kind:'刊物',url:'https://www.sciencedaily.com/rss/health_medicine.xml',home:'https://www.sciencedaily.com/news/health_medicine/',hosts:['sciencedaily.com']},
 {id:'guardian-world',name:'The Guardian',category:'新闻',kind:'刊物',url:'https://www.theguardian.com/world/rss',home:'https://www.theguardian.com/world',hosts:['theguardian.com']},
 {id:'guardian-science',name:'The Guardian Science',category:'科研',kind:'刊物',url:'https://www.theguardian.com/science/rss',home:'https://www.theguardian.com/science',hosts:['theguardian.com']},
 {id:'bbc-youtube',name:'BBC News · YouTube',category:'视频',kind:'视频',url:'https://www.youtube.com/feeds/videos.xml?channel_id=UC16niRr50-MSBwiO3YDb3RA',home:'https://www.youtube.com/@BBCNews',hosts:['youtube.com','youtu.be']},
 {id:'kurzgesagt',name:'Kurzgesagt · YouTube',category:'视频',kind:'视频',url:'https://www.youtube.com/feeds/videos.xml?channel_id=UCsXVk37bltHxD1rDPwtNM8Q',home:'https://www.youtube.com/@kurzgesagt',hosts:['youtube.com','youtu.be']}
];
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',removeNSPrefix:true,trimValues:true,parseTagValue:false});
const asArray=value=>value==null?[]:Array.isArray(value)?value:[value];
const valueOf=value=>typeof value==='string'?value.trim():value&&typeof value==='object'?String(value['#text']??value.__cdata??'').trim():'';
const validLink=(value,hosts)=>{try{const url=new URL(value);return url.protocol==='https:'&&hosts.some(host=>url.hostname===host||url.hostname.endsWith('.'+host))?url.href:null;}catch{return null;}};
const feedLink=(value,hosts)=>{for(const link of asArray(value)){const href=typeof link==='string'?link:link?.href||link?.['#text'];const safe=validLink(href,hosts);if(safe&&(!link?.rel||link.rel==='alternate'))return safe;}return null;};
export function parseFeedEntries(xml,feed){
 const doc=parser.parse(xml);const raw=doc?.rss?.channel?.item??doc?.feed?.entry??[];
 return asArray(raw).map(item=>{
  const title=valueOf(item?.title).slice(0,240);const url=feedLink(item?.link,feed.hosts);
  const publishedAt=valueOf(item?.pubDate||item?.published||item?.updated);
  const date=publishedAt&&!Number.isNaN(Date.parse(publishedAt))?new Date(publishedAt).toISOString():null;
  return title&&url?{title,url,publishedAt:date,source:feed.name,sourceId:feed.id,category:feed.category,kind:feed.kind}:null;
 }).filter(Boolean).slice(0,24);
}
function configuredX(env){
 const token=env.X_BEARER_TOKEN?.trim();
 const handles=(env.X_ACCOUNTS||'').split(',').map(value=>value.trim().replace(/^@/,'')).filter(value=>/^[A-Za-z0-9_]{1,15}$/.test(value)).slice(0,8);
 return token&&handles.length?{token,handles}:null;
}
async function xEntries(env){
 const config=configuredX(env);if(!config)return {source:{id:'x',name:'X 动态',category:'社交',kind:'社交',home:'https://x.com',state:'optional'},items:[]};
 const endpoint=new URL('https://api.x.com/2/tweets/search/recent');
 endpoint.searchParams.set('query',`(${config.handles.map(handle=>`from:${handle}`).join(' OR ')}) -is:retweet`);
 endpoint.searchParams.set('max_results','20');endpoint.searchParams.set('tweet.fields','created_at');
 try{
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${config.token}`}});if(!response.ok)throw new Error('X unavailable');
  const payload=await response.json();const source={id:'x',name:'X 动态',category:'社交',kind:'社交',home:'https://x.com',state:'active'};
  return {source,items:asArray(payload.data).map(post=>{const title=String(post?.text||'').replace(/\s+/g,' ').trim().slice(0,240);const url=validLink(`https://x.com/i/web/status/${post?.id||''}`,['x.com']);const date=post?.created_at&&!Number.isNaN(Date.parse(post.created_at))?new Date(post.created_at).toISOString():null;return title&&url?{title,url,publishedAt:date,source:source.name,sourceId:source.id,category:source.category,kind:source.kind}:null;}).filter(Boolean)};
 }catch{return {source:{id:'x',name:'X 动态',category:'社交',kind:'社交',home:'https://x.com',state:'unavailable'},items:[]};}
}
export function settings(env){
 const domain=env.ACCESS_TEAM_DOMAIN?.trim();
 const aud=env.ACCESS_AUD?.trim();
 if(!domain || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain) || !aud) return null;
 return {issuer:`https://${domain}`,audience:aud};
}
export async function verifyAccess(token,cfg,key){
 if(!token || token.length>16384) throw new Error('Invalid token');
 let resolver=key;
 if(!resolver){
  if(!keysets.has(cfg.issuer)) keysets.set(cfg.issuer,createRemoteJWKSet(new URL(cfg.issuer+'/cdn-cgi/access/certs'),{timeoutDuration:5000,cacheMaxAge:600000}));
  resolver=keysets.get(cfg.issuer);
 }
 const {payload}=await jwtVerify(token,resolver,{issuer:cfg.issuer,audience:cfg.audience,algorithms:['RS256'],requiredClaims:['exp','iat','sub'],clockTolerance:5});
 return payload;
}
function secure(response,privatePage=false){
 const h=new Headers(response.headers);
 h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
 h.set('X-Content-Type-Options','nosniff');
 h.set('X-Frame-Options','DENY');
 h.set('Referrer-Policy','no-referrer');
 h.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
 h.set('Strict-Transport-Security','max-age=31536000');
 h.set('Cross-Origin-Resource-Policy','same-origin');
 h.delete('Access-Control-Allow-Origin');
 if(privatePage){h.set('Cache-Control','private, no-store');h.set('X-Robots-Tag','noindex, nofollow, noarchive');}
 return new Response(response.body,{status:response.status,headers:h});
}
async function limitedText(response){
 if(!response.ok || !response.body) throw new Error('Feed unavailable');
 const reader=response.body.getReader();const chunks=[];let size=0;
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>500000){await reader.cancel();throw new Error('Feed too large');}chunks.push(value);}}finally{reader.releaseLock();}
 const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}return new TextDecoder().decode(all);
}
const sourceView=({id,name,category,kind,home,state='active'})=>({id,name,category,kind,home,state});
async function news(request,ctx,env){
 const cache=globalThis.caches?.default;
 const cacheKey=new Request(new URL('/api/news',request.url));
 const refresh=new URL(request.url).searchParams.get('refresh')==='1';
 const hit=!refresh&&cache?await cache.match(cacheKey):null;if(hit)return hit;
 const results=await Promise.all(feeds.map(async feed=>{
  try {const r=await fetch(feed.url,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/rss+xml, application/atom+xml, text/xml'}});const items=parseFeedEntries(await limitedText(r),feed);return {source:{...sourceView(feed),state:items.length?'active':'unavailable'},items};}
  catch{return {source:{...sourceView(feed),state:'unavailable'},items:[]};}
 }));
 const x=await xEntries(env);
 const sources=[...results.map(result=>result.source),x.source];
 const seen=new Set();const items=[...results.flatMap(result=>result.items),...x.items].filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true;}).sort((a,b)=>Date.parse(b.publishedAt||0)-Date.parse(a.publishedAt||0)).slice(0,160);
 const ok=items.length>0;
 const r=Response.json({updatedAt:new Date().toISOString(),cacheMinutes:30,items,sources},{status:ok?200:503,headers:{'Cache-Control':ok?'public, max-age=1800':'no-store'}});
 if(ok&&cache)ctx.waitUntil?.(cache.put(cacheKey,r.clone()));return r;
}
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);let path;
 try {path=decodeURIComponent(url.pathname);}catch{return secure(new Response('Bad request',{status:400}));}
 if(path.includes('%')||path.includes('\\'))return secure(new Response('Bad request',{status:400}));
 path=path.replace(/\/{2,}/g,'/');
 const isPrivate=/^\/private(?:\/|$)/.test(path);
 if(!['GET','HEAD'].includes(request.method))return secure(new Response('Method not allowed',{status:405}),isPrivate);
 if(isPrivate){
  const cfg=settings(env);
  if(!cfg)return secure(new Response('私人工作台尚未启用：请先完成 Cloudflare Access 配置。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}),true);
  try {await verifyAccess(request.headers.get('Cf-Access-Jwt-Assertion'),cfg);}catch{return secure(new Response('请通过此域名的 Cloudflare Access 登录后访问。',{status:401,headers:{'Content-Type':'text/plain; charset=utf-8'}}),true);}
 }
 try {
  if(path==='/api/news')return secure(await news(request,ctx,env));
  url.pathname=path==='/private'||path==='/private/'?'/private/index.html':path;
  return secure(await env.ASSETS.fetch(new Request(url,request)),isPrivate);
 }catch{return secure(new Response('Service temporarily unavailable',{status:503}),isPrivate);}
}};
