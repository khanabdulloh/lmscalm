/* boot.js — dimuat paling awal di <head>.
 * Isi: (1) frame-guard, (2) pencatat pelanggaran CSP, (3) mode hemat data, (4) aktivasi CSS font,
 * (5) dispatcher handler: menjalankan atribut data-on* TANPA eval/new Function, sehingga CSP
 *     dapat memakai script-src 'self' saja (tanpa 'unsafe-inline'). */

/*GUARD-START*/
var __blocked=(function(){try{
if(window.top===window)return false;
/* Untuk menambah situs yang diizinkan menanam portal ini, edit daftar OK. Firefox tidak
 * menyediakan ancestorOrigins, sehingga dilewati (tidak bisa diverifikasi). */
var OK=["https://smkciledugalmusaddadiyah.sch.id","https://www.smkciledugalmusaddadiyah.sch.id"];
var ao=window.location.ancestorOrigins;
if(!ao||!ao.length)return false;
for(var i=0;i<ao.length;i++){if(OK.indexOf(ao[i])<0){
try{window.stop()}catch(_){}
document.documentElement.innerHTML='<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portal LMS SMK CALM</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.6 system-ui,sans-serif;background:#f6f8fb;color:#17233a;text-align:center;padding:1.5rem"><div><h1 style="font-size:1.3rem;margin:0 0 .6rem">Halaman ini tidak dapat ditampilkan di sini</h1><p style="margin:0 0 1rem;color:#53627a">Demi keamanan, Portal LMS hanya dapat dibuka dari situs resmi sekolah.</p><a id="gx" rel="noopener" target="_blank" style="display:inline-block;padding:.7rem 1.2rem;border-radius:.7rem;background:#0b3d91;color:#fff;text-decoration:none;font-weight:700">Buka Portal LMS</a></div></body>';
var a=document.getElementById("gx");if(a)a.href=String(window.location.href).split("#")[0];
return true}}
}catch(e){}return false})();
/*GUARD-END*/

if(!__blocked){
/* (2) Pencatat pelanggaran CSP */
document.addEventListener("securitypolicyviolation",function(e){try{(window.__csp=window.__csp||[]).push(e.violatedDirective+" | "+e.blockedURI);console.warn("[CSP] diblokir:",e.violatedDirective,e.blockedURI)}catch(_){}});

/* (3) Mode hemat data */
try{var c=navigator.connection;if(c&&(c.saveData||/(^|slow-)2g|3g/.test(c.effectiveType||"")))document.documentElement.className+=" lite"}catch(e){}

/* (4) Aktifkan CSS font setelah termuat (pengganti onload="this.media='all'") */
(function(){var f=document.getElementById("gfonts");if(!f)return;var on=function(){f.media="all"};if(f.sheet)on();else f.addEventListener("load",on)})();

/* (5) Dispatcher handler data-on* */
(function(){
var H=window.__LMS_H={};
var BASE={};Object.getOwnPropertyNames(window).forEach(function(n){BASE[n]=1});
var TABLE=null,DATA={};
var DENY={constructor:1,__proto__:1,prototype:1,__defineGetter__:1,__defineSetter__:1,__lookupGetter__:1,__lookupSetter__:1};
var EVENTS=["click","change","keydown","input","toggle","submit"];
var SEL=EVENTS.map(function(e){return "[data-on"+e+"]"}).join(",");

function bad(m){var e=new Error("[handler] "+m);e.lmsHandler=1;return e}

/* ---- lexer ---- */
function lex(s){
  var t=[],i=0,n=s.length,c,j;
  while(i<n){
    c=s.charAt(i);
    if(/\s/.test(c)){i++;continue}
    if(/[A-Za-z_$]/.test(c)){j=i+1;while(j<n&&/[\w$]/.test(s.charAt(j)))j++;t.push({k:"id",v:s.slice(i,j)});i=j;continue}
    if(/[0-9]/.test(c)){j=i+1;while(j<n&&/[0-9.]/.test(s.charAt(j)))j++;t.push({k:"num",v:parseFloat(s.slice(i,j))});i=j;continue}
    if(c==="'"||c==='"'){
      var q=c,o="";i++;
      for(;;){
        if(i>=n)throw bad("string tidak ditutup");
        c=s.charAt(i++);
        if(c===q)break;
        if(c==="\\"){
          c=s.charAt(i++);
          if(c==="n")o+="\n";else if(c==="t")o+="\t";else if(c==="r")o+="\r";else if(c==="b")o+="\b";else if(c==="f")o+="\f";else if(c==="v")o+="\v";else if(c==="0")o+="\0";
          else if(c==="u"){var h=s.substr(i,4);if(!/^[0-9a-fA-F]{4}$/.test(h))throw bad("escape \\u");o+=String.fromCharCode(parseInt(h,16));i+=4}
          else if(c==="x"){var h2=s.substr(i,2);if(!/^[0-9a-fA-F]{2}$/.test(h2))throw bad("escape \\x");o+=String.fromCharCode(parseInt(h2,16));i+=2}
          else o+=c;
        }else o+=c;
      }
      t.push({k:"str",v:o});continue;
    }
    var p3=s.substr(i,3),p2=s.substr(i,2);
    if(p3==="==="||p3==="!=="){t.push({k:"p",v:p3});i+=3;continue}
    if(p2==="=="||p2==="!="||p2==="&&"||p2==="||"){t.push({k:"p",v:p2});i+=2;continue}
    if("(){}[].,;!-=".indexOf(c)>=0){t.push({k:"p",v:c});i++;continue}
    throw bad("karakter tidak didukung: "+c);
  }
  return t;
}

/* ---- parser ---- */
function parse(src){
  var T=lex(src),p=0;
  function pk(){return T[p]}
  function is(v){var x=T[p];return x&&x.k==="p"&&x.v===v}
  function eat(v){if(!is(v))throw bad("diharapkan "+v);p++}
  function prog(end){var L=[];while(p<T.length&&!(end&&is(end))){if(is(";")){p++;continue}L.push(stmt());if(is(";"))p++}return L}
  function stmt(){
    var x=pk();
    if(x.k==="p"&&x.v==="{"){p++;var b=prog("}");eat("}");return{t:"blk",b:b}}
    if(x.k==="id"&&x.v==="if"&&T[p+1]&&T[p+1].v==="("){p+=2;var c=expr();eat(")");var a=stmt(),e=null;if(is(";"))p++;if(pk()&&pk().k==="id"&&pk().v==="else"){p++;e=stmt()}return{t:"if",c:c,a:a,e:e}}
    return expr();
  }
  function expr(){
    var l=or();
    if(is("=")){p++;if(l.t!=="mem"&&l.t!=="idx")throw bad("target assignment tidak valid");return{t:"asg",l:l,r:expr()}}
    return l;
  }
  function or(){var l=and();while(is("||")){p++;l={t:"or",l:l,r:and()}}return l}
  function and(){var l=eq();while(is("&&")){p++;l={t:"and",l:l,r:eq()}}return l}
  function eq(){var l=un();while(is("===")||is("!==")||is("==")||is("!=")){var o=T[p++].v;l={t:"eq",o:o,l:l,r:un()}}return l}
  function un(){if(is("!")){p++;return{t:"not",a:un()}}if(is("-")){p++;return{t:"neg",a:un()}}return post()}
  function post(){
    var n=prim();
    for(;;){
      if(is(".")){p++;var x=T[p++];if(!x||x.k!=="id")throw bad("nama properti");n={t:"mem",o:n,p:x.v}}
      else if(is("[")){p++;var k=expr();eat("]");n={t:"idx",o:n,k:k}}
      else if(is("(")){p++;var a=[];if(!is(")")){a.push(expr());while(is(",")){p++;a.push(expr())}}eat(")");n={t:"call",f:n,a:a}}
      else break;
    }
    return n;
  }
  function prim(){
    var x=T[p++];
    if(!x)throw bad("ekspresi terpotong");
    if(x.k==="num"||x.k==="str")return{t:"lit",v:x.v};
    if(x.k==="id"){
      if(x.v==="true")return{t:"lit",v:true};
      if(x.v==="false")return{t:"lit",v:false};
      if(x.v==="null")return{t:"lit",v:null};
      if(x.v==="undefined")return{t:"lit",v:undefined};
      if(x.v==="this")return{t:"this"};
      return{t:"id",n:x.v};
    }
    if(x.v==="("){var e=expr();eat(")");return e}
    throw bad("token tidak terduga: "+x.v);
  }
  var out=prog(null);
  if(p<T.length)throw bad("sisa token");
  return out;
}

/* ---- evaluator ---- */
function root(n){while(n.t==="mem"||n.t==="idx")n=n.o;return n}
function look(n,cx){
  if(n==="event")return cx.ev;
  if(n==="window")return window;
  if(TABLE){var v;try{v=TABLE(n)}catch(_){v=undefined}
    if(DATA[n]||typeof v==="function")return v}
  if(!BASE[n]&&typeof window[n]==="function")return window[n];
  throw bad("nama tidak dikenal: "+n);
}
function nz(o){if(o==null)throw bad("objek kosong")}
function dn(k){if(DENY[String(k)])throw bad("properti dilarang: "+k)}
function ev(n,cx){
  switch(n.t){
    case "lit":return n.v;
    case "this":return cx.el;
    case "id":return look(n.n,cx);
    case "mem":{var o=ev(n.o,cx);nz(o);dn(n.p);return o[n.p]}
    case "idx":{var o2=ev(n.o,cx),k=ev(n.k,cx);nz(o2);dn(k);return o2[k]}
    case "not":return !ev(n.a,cx);
    case "neg":return -ev(n.a,cx);
    case "and":{var a=ev(n.l,cx);return a?ev(n.r,cx):a}
    case "or":{var b=ev(n.l,cx);return b?b:ev(n.r,cx)}
    case "eq":{var l=ev(n.l,cx),r=ev(n.r,cx);return n.o==="==="?l===r:n.o==="!=="?l!==r:n.o==="=="?l==r:l!=r}
    case "asg":{
      var tg=n.l,rt=root(tg);
      if(!(rt.t==="this"||(rt.t==="id"&&DATA[rt.n])))throw bad("assignment ditolak");
      var ob=ev(tg.o,cx);nz(ob);var key=tg.t==="mem"?tg.p:ev(tg.k,cx);dn(key);
      var v2=ev(n.r,cx);ob[key]=v2;return v2;
    }
    case "call":{
      var args=n.a.map(function(x){return ev(x,cx)}),f=n.f;
      if(f.t==="id"){var fn=look(f.n,cx);if(typeof fn!=="function")throw bad("bukan fungsi: "+f.n);return fn.apply(window,args)}
      if(f.t==="mem"||f.t==="idx"){
        var rr=root(f);if(!(rr.t==="this"||(rr.t==="id"&&rr.n==="event")))throw bad("pemanggilan ditolak");
        var self=ev(f.o,cx);nz(self);var nm=f.t==="mem"?f.p:ev(f.k,cx);dn(nm);
        var m=self[nm];if(typeof m!=="function")throw bad("bukan fungsi: "+nm);return m.apply(self,args);
      }
      throw bad("pemanggilan tidak didukung");
    }
  }
  throw bad("node tidak didukung");
}
function exec(s,cx){
  if(s.t==="blk"){for(var i=0;i<s.b.length;i++)exec(s.b[i],cx);return}
  if(s.t==="if"){if(ev(s.c,cx))exec(s.a,cx);else if(s.e)exec(s.e,cx);return}
  ev(s,cx);
}
var CACHE=Object.create(null);
function run(code,el,event){
  var ast=CACHE[code];
  if(!ast){
    try{ast=CACHE[code]=parse(code)}
    catch(e){console.error("[LMS] handler tidak didukung:",code,e&&e.message);ast=CACHE[code]=[]}
  }
  var cx={el:el,ev:event};
  for(var i=0;i<ast.length;i++)exec(ast[i],cx);
}
H.run=run;H.parse=parse;

/* ---- pengikat event ---- */
var BOUND=typeof WeakMap==="function"?new WeakMap():null;
function bindOne(el){
  var st=BOUND.get(el);if(!st){st={};BOUND.set(el,st)}
  EVENTS.forEach(function(type){
    var attr="data-on"+type;
    if(st[type]||!el.hasAttribute(attr))return;
    st[type]=1;
    el.addEventListener(type,function(event){
      var code=el.getAttribute(attr);
      if(code!=null)run(code,el,event);
    });
  });
}
function bind(root){
  if(!root)return;
  if(root.nodeType===1)bindOne(root);
  if(root.querySelectorAll){var L=root.querySelectorAll(SEL);for(var i=0;i<L.length;i++)bindOne(L[i])}
}
H.bind=bind;

/* Pengikatan sinkron saat HTML disisipkan (menjaga urutan seperti atribut inline asli) */
(function(){
  var d=Object.getOwnPropertyDescriptor(Element.prototype,"innerHTML");
  if(d&&d.set)Object.defineProperty(Element.prototype,"innerHTML",{configurable:true,enumerable:d.enumerable,get:d.get,set:function(v){d.set.call(this,v);if(typeof v!=="string"||v.indexOf("data-on")>=0)bind(this)}});
  var od=Object.getOwnPropertyDescriptor(Element.prototype,"outerHTML");
  if(od&&od.set)Object.defineProperty(Element.prototype,"outerHTML",{configurable:true,enumerable:od.enumerable,get:od.get,set:function(v){var par=this.parentNode;od.set.call(this,v);if(par&&(typeof v!=="string"||v.indexOf("data-on")>=0))bind(par)}});
  var ia=Element.prototype.insertAdjacentHTML;
  Element.prototype.insertAdjacentHTML=function(pos,html){ia.call(this,pos,html);if(typeof html!=="string"||html.indexOf("data-on")>=0)bind(/^(before|after)/i.test(pos)?(this.parentNode||this):this)};
})();

/* Jaring pengaman: elemen yang masuk lewat jalur lain (parser, createElement, appendChild) */
if(typeof MutationObserver==="function"){
  new MutationObserver(function(ms){
    for(var i=0;i<ms.length;i++){var a=ms[i].addedNodes;for(var j=0;j<a.length;j++)if(a[j].nodeType===1)bind(a[j])}
  }).observe(document.documentElement,{childList:true,subtree:true});
}

/* Dipanggil dari akhir app.js: table(name) membaca binding const/let; dataNames = objek state yang boleh dibaca/diubah */
H.setEnv=function(table,dataNames){
  TABLE=table;DATA={};(dataNames||[]).forEach(function(n){DATA[n]=1});
  bind(document);
};

/* Tombol "lupa sandi" statis (dulu memakai handler inline panjang) */
document.addEventListener("DOMContentLoaded",function(){
  var b=document.getElementById("fgb");
  if(b)b.addEventListener("click",function(){var t=document.getElementById("fgt");if(!t)return;var h=t.classList.toggle("hide");this.setAttribute("aria-expanded",String(!h))});
});
})();
}
