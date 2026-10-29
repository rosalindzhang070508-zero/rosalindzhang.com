import {createRemoteJWKSet,jwtVerify} from 'jose';
const keysets=new Map();
export const feeds=[
 {name:'BBC 中文',category:'综合',url:'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml'},
 {name:'Solidot',category:'科技',url:'https://www.solidot.org/index.rss'},
 {name:'ScienceDaily',category:'医学',url:'https://www.sciencedaily.com/rss/health_medicine.xml'}
];
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
async function news(request,ctx){
 const cache=globalThis.caches?.default;
 const cacheKey=new Request(new URL('/api/news',request.url));
 const hit=cache?await cache.match(cacheKey):null;if(hit)return hit;
 const results=await Promise.all(feeds.map(async feed=>{
  try {const r=await fetch(feed.url,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/rss+xml, application/atom+xml, text/xml'}});return {...feed,xml:await limitedText(r)};}
  catch{return {name:feed.name,category:feed.category,error:'暂时无法更新此来源'};}
 }));
 const ok=results.some(x=>x.xml);
 const r=Response.json({updatedAt:new Date().toISOString(),feeds:results},{status:ok?200:503,headers:{'Cache-Control':ok?'public, max-age=1800':'no-store'}});
 if(ok&&cache)ctx.waitUntil(cache.put(cacheKey,r.clone()));return r;
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
  if(path==='/api/news')return secure(await news(request,ctx));
  url.pathname=path==='/private'||path==='/private/'?'/private/index.html':path;
  return secure(await env.ASSETS.fetch(new Request(url,request)),isPrivate);
 }catch{return secure(new Response('Service temporarily unavailable',{status:503}),isPrivate);}
}};
