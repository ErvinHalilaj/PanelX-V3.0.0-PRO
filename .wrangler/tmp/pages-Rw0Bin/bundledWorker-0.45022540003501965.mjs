var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// _worker.js
var L = /* @__PURE__ */ __name((e, t, s) => (r, n) => {
  let i = -1;
  return a(0);
  async function a(d) {
    if (d <= i) throw new Error("next() called multiple times");
    i = d;
    let o, c = false, l;
    if (e[d] ? (l = e[d][0][0], r.req.routeIndex = d) : l = d === e.length && n || void 0, l) try {
      o = await l(r, () => a(d + 1));
    } catch (h) {
      if (h instanceof Error && t) r.error = h, o = await t(h, r), c = true;
      else throw h;
    }
    else r.finalized === false && s && (o = await s(r));
    return o && (r.finalized === false || c) && (r.res = o), r;
  }
  __name(a, "a");
}, "L");
var ue = Symbol();
var de = /* @__PURE__ */ __name(async (e, t = /* @__PURE__ */ Object.create(null)) => {
  const { all: s = false, dot: r = false } = t, i = (e instanceof Q ? e.raw.headers : e.headers).get("Content-Type");
  return i?.startsWith("multipart/form-data") || i?.startsWith("application/x-www-form-urlencoded") ? le(e, { all: s, dot: r }) : {};
}, "de");
async function le(e, t) {
  const s = await e.formData();
  return s ? he(s, t) : {};
}
__name(le, "le");
function he(e, t) {
  const s = /* @__PURE__ */ Object.create(null);
  return e.forEach((r, n) => {
    t.all || n.endsWith("[]") ? pe(s, n, r) : s[n] = r;
  }), t.dot && Object.entries(s).forEach(([r, n]) => {
    r.includes(".") && (fe(s, r, n), delete s[r]);
  }), s;
}
__name(he, "he");
var pe = /* @__PURE__ */ __name((e, t, s) => {
  e[t] !== void 0 ? Array.isArray(e[t]) ? e[t].push(s) : e[t] = [e[t], s] : t.endsWith("[]") ? e[t] = [s] : e[t] = s;
}, "pe");
var fe = /* @__PURE__ */ __name((e, t, s) => {
  let r = e;
  const n = t.split(".");
  n.forEach((i, a) => {
    a === n.length - 1 ? r[i] = s : ((!r[i] || typeof r[i] != "object" || Array.isArray(r[i]) || r[i] instanceof File) && (r[i] = /* @__PURE__ */ Object.create(null)), r = r[i]);
  });
}, "fe");
var K = /* @__PURE__ */ __name((e) => {
  const t = e.split("/");
  return t[0] === "" && t.shift(), t;
}, "K");
var ge = /* @__PURE__ */ __name((e) => {
  const { groups: t, path: s } = me(e), r = K(s);
  return ye(r, t);
}, "ge");
var me = /* @__PURE__ */ __name((e) => {
  const t = [];
  return e = e.replace(/\{[^}]+\}/g, (s, r) => {
    const n = `@${r}`;
    return t.push([n, s]), n;
  }), { groups: t, path: e };
}, "me");
var ye = /* @__PURE__ */ __name((e, t) => {
  for (let s = t.length - 1; s >= 0; s--) {
    const [r] = t[s];
    for (let n = e.length - 1; n >= 0; n--) if (e[n].includes(r)) {
      e[n] = e[n].replace(r, t[s][1]);
      break;
    }
  }
  return e;
}, "ye");
var H = {};
var je = /* @__PURE__ */ __name((e, t) => {
  if (e === "*") return "*";
  const s = e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (s) {
    const r = `${e}#${t}`;
    return H[r] || (s[2] ? H[r] = t && t[0] !== ":" && t[0] !== "*" ? [r, s[1], new RegExp(`^${s[2]}(?=/${t})`)] : [e, s[1], new RegExp(`^${s[2]}$`)] : H[r] = [e, s[1], true]), H[r];
  }
  return null;
}, "je");
var N = /* @__PURE__ */ __name((e, t) => {
  try {
    return t(e);
  } catch {
    return e.replace(/(?:%[0-9A-Fa-f]{2})+/g, (s) => {
      try {
        return t(s);
      } catch {
        return s;
      }
    });
  }
}, "N");
var we = /* @__PURE__ */ __name((e) => N(e, decodeURI), "we");
var W = /* @__PURE__ */ __name((e) => {
  const t = e.url, s = t.indexOf("/", t.indexOf(":") + 4);
  let r = s;
  for (; r < t.length; r++) {
    const n = t.charCodeAt(r);
    if (n === 37) {
      const i = t.indexOf("?", r), a = t.slice(s, i === -1 ? void 0 : i);
      return we(a.includes("%25") ? a.replace(/%25/g, "%2525") : a);
    } else if (n === 63) break;
  }
  return t.slice(s, r);
}, "W");
var be = /* @__PURE__ */ __name((e) => {
  const t = W(e);
  return t.length > 1 && t.at(-1) === "/" ? t.slice(0, -1) : t;
}, "be");
var q = /* @__PURE__ */ __name((e, t, ...s) => (s.length && (t = q(t, ...s)), `${e?.[0] === "/" ? "" : "/"}${e}${t === "/" ? "" : `${e?.at(-1) === "/" ? "" : "/"}${t?.[0] === "/" ? t.slice(1) : t}`}`), "q");
var V = /* @__PURE__ */ __name((e) => {
  if (e.charCodeAt(e.length - 1) !== 63 || !e.includes(":")) return null;
  const t = e.split("/"), s = [];
  let r = "";
  return t.forEach((n) => {
    if (n !== "" && !/\:/.test(n)) r += "/" + n;
    else if (/\:/.test(n)) if (/\?/.test(n)) {
      s.length === 0 && r === "" ? s.push("/") : s.push(r);
      const i = n.replace("?", "");
      r += "/" + i, s.push(r);
    } else r += "/" + n;
  }), s.filter((n, i, a) => a.indexOf(n) === i);
}, "V");
var k = /* @__PURE__ */ __name((e) => /[%+]/.test(e) ? (e.indexOf("+") !== -1 && (e = e.replace(/\+/g, " ")), e.indexOf("%") !== -1 ? N(e, G) : e) : e, "k");
var z = /* @__PURE__ */ __name((e, t, s) => {
  let r;
  if (!s && t && !/[%+]/.test(t)) {
    let a = e.indexOf("?", 8);
    if (a === -1) return;
    for (e.startsWith(t, a + 1) || (a = e.indexOf(`&${t}`, a + 1)); a !== -1; ) {
      const d = e.charCodeAt(a + t.length + 1);
      if (d === 61) {
        const o = a + t.length + 2, c = e.indexOf("&", o);
        return k(e.slice(o, c === -1 ? void 0 : c));
      } else if (d == 38 || isNaN(d)) return "";
      a = e.indexOf(`&${t}`, a + 1);
    }
    if (r = /[%+]/.test(e), !r) return;
  }
  const n = {};
  r ??= /[%+]/.test(e);
  let i = e.indexOf("?", 8);
  for (; i !== -1; ) {
    const a = e.indexOf("&", i + 1);
    let d = e.indexOf("=", i);
    d > a && a !== -1 && (d = -1);
    let o = e.slice(i + 1, d === -1 ? a === -1 ? void 0 : a : d);
    if (r && (o = k(o)), i = a, o === "") continue;
    let c;
    d === -1 ? c = "" : (c = e.slice(d + 1, a === -1 ? void 0 : a), r && (c = k(c))), s ? (n[o] && Array.isArray(n[o]) || (n[o] = []), n[o].push(c)) : n[o] ??= c;
  }
  return t ? n[t] : n;
}, "z");
var ve = z;
var Re = /* @__PURE__ */ __name((e, t) => z(e, t, true), "Re");
var G = decodeURIComponent;
var M = /* @__PURE__ */ __name((e) => N(e, G), "M");
var Q = class {
  static {
    __name(this, "Q");
  }
  raw;
  #t;
  #e;
  routeIndex = 0;
  path;
  bodyCache = {};
  constructor(e, t = "/", s = [[]]) {
    this.raw = e, this.path = t, this.#e = s, this.#t = {};
  }
  param(e) {
    return e ? this.#s(e) : this.#i();
  }
  #s(e) {
    const t = this.#e[0][this.routeIndex][1][e], s = this.#n(t);
    return s && /\%/.test(s) ? M(s) : s;
  }
  #i() {
    const e = {}, t = Object.keys(this.#e[0][this.routeIndex][1]);
    for (const s of t) {
      const r = this.#n(this.#e[0][this.routeIndex][1][s]);
      r !== void 0 && (e[s] = /\%/.test(r) ? M(r) : r);
    }
    return e;
  }
  #n(e) {
    return this.#e[1] ? this.#e[1][e] : e;
  }
  query(e) {
    return ve(this.url, e);
  }
  queries(e) {
    return Re(this.url, e);
  }
  header(e) {
    if (e) return this.raw.headers.get(e) ?? void 0;
    const t = {};
    return this.raw.headers.forEach((s, r) => {
      t[r] = s;
    }), t;
  }
  async parseBody(e) {
    return this.bodyCache.parsedBody ??= await de(this, e);
  }
  #r = /* @__PURE__ */ __name((e) => {
    const { bodyCache: t, raw: s } = this, r = t[e];
    if (r) return r;
    const n = Object.keys(t)[0];
    return n ? t[n].then((i) => (n === "json" && (i = JSON.stringify(i)), new Response(i)[e]())) : t[e] = s[e]();
  }, "#r");
  json() {
    return this.#r("text").then((e) => JSON.parse(e));
  }
  text() {
    return this.#r("text");
  }
  arrayBuffer() {
    return this.#r("arrayBuffer");
  }
  blob() {
    return this.#r("blob");
  }
  formData() {
    return this.#r("formData");
  }
  addValidatedData(e, t) {
    this.#t[e] = t;
  }
  valid(e) {
    return this.#t[e];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [ue]() {
    return this.#e;
  }
  get matchedRoutes() {
    return this.#e[0].map(([[, e]]) => e);
  }
  get routePath() {
    return this.#e[0].map(([[, e]]) => e)[this.routeIndex].path;
  }
};
var Ee = { Stringify: 1 };
var X = /* @__PURE__ */ __name(async (e, t, s, r, n) => {
  typeof e == "object" && !(e instanceof String) && (e instanceof Promise || (e = e.toString()), e instanceof Promise && (e = await e));
  const i = e.callbacks;
  return i?.length ? (n ? n[0] += e : n = [e], Promise.all(i.map((d) => d({ phase: t, buffer: n, context: r }))).then((d) => Promise.all(d.filter(Boolean).map((o) => X(o, t, false, r, n))).then(() => n[0]))) : Promise.resolve(e);
}, "X");
var qe = "text/plain; charset=UTF-8";
var D = /* @__PURE__ */ __name((e, t) => ({ "Content-Type": e, ...t }), "D");
var xe = class {
  static {
    __name(this, "xe");
  }
  #t;
  #e;
  env = {};
  #s;
  finalized = false;
  error;
  #i;
  #n;
  #r;
  #d;
  #c;
  #u;
  #o;
  #l;
  #h;
  constructor(e, t) {
    this.#t = e, t && (this.#n = t.executionCtx, this.env = t.env, this.#u = t.notFoundHandler, this.#h = t.path, this.#l = t.matchResult);
  }
  get req() {
    return this.#e ??= new Q(this.#t, this.#h, this.#l), this.#e;
  }
  get event() {
    if (this.#n && "respondWith" in this.#n) return this.#n;
    throw Error("This context has no FetchEvent");
  }
  get executionCtx() {
    if (this.#n) return this.#n;
    throw Error("This context has no ExecutionContext");
  }
  get res() {
    return this.#r ||= new Response(null, { headers: this.#o ??= new Headers() });
  }
  set res(e) {
    if (this.#r && e) {
      e = new Response(e.body, e);
      for (const [t, s] of this.#r.headers.entries()) if (t !== "content-type") if (t === "set-cookie") {
        const r = this.#r.headers.getSetCookie();
        e.headers.delete("set-cookie");
        for (const n of r) e.headers.append("set-cookie", n);
      } else e.headers.set(t, s);
    }
    this.#r = e, this.finalized = true;
  }
  render = /* @__PURE__ */ __name((...e) => (this.#c ??= (t) => this.html(t), this.#c(...e)), "render");
  setLayout = /* @__PURE__ */ __name((e) => this.#d = e, "setLayout");
  getLayout = /* @__PURE__ */ __name(() => this.#d, "getLayout");
  setRenderer = /* @__PURE__ */ __name((e) => {
    this.#c = e;
  }, "setRenderer");
  header = /* @__PURE__ */ __name((e, t, s) => {
    this.finalized && (this.#r = new Response(this.#r.body, this.#r));
    const r = this.#r ? this.#r.headers : this.#o ??= new Headers();
    t === void 0 ? r.delete(e) : s?.append ? r.append(e, t) : r.set(e, t);
  }, "header");
  status = /* @__PURE__ */ __name((e) => {
    this.#i = e;
  }, "status");
  set = /* @__PURE__ */ __name((e, t) => {
    this.#s ??= /* @__PURE__ */ new Map(), this.#s.set(e, t);
  }, "set");
  get = /* @__PURE__ */ __name((e) => this.#s ? this.#s.get(e) : void 0, "get");
  get var() {
    return this.#s ? Object.fromEntries(this.#s) : {};
  }
  #a(e, t, s) {
    const r = this.#r ? new Headers(this.#r.headers) : this.#o ?? new Headers();
    if (typeof t == "object" && "headers" in t) {
      const i = t.headers instanceof Headers ? t.headers : new Headers(t.headers);
      for (const [a, d] of i) a.toLowerCase() === "set-cookie" ? r.append(a, d) : r.set(a, d);
    }
    if (s) for (const [i, a] of Object.entries(s)) if (typeof a == "string") r.set(i, a);
    else {
      r.delete(i);
      for (const d of a) r.append(i, d);
    }
    const n = typeof t == "number" ? t : t?.status ?? this.#i;
    return new Response(e, { status: n, headers: r });
  }
  newResponse = /* @__PURE__ */ __name((...e) => this.#a(...e), "newResponse");
  body = /* @__PURE__ */ __name((e, t, s) => this.#a(e, t, s), "body");
  text = /* @__PURE__ */ __name((e, t, s) => !this.#o && !this.#i && !t && !s && !this.finalized ? new Response(e) : this.#a(e, t, D(qe, s)), "text");
  json = /* @__PURE__ */ __name((e, t, s) => this.#a(JSON.stringify(e), t, D("application/json", s)), "json");
  html = /* @__PURE__ */ __name((e, t, s) => {
    const r = /* @__PURE__ */ __name((n) => this.#a(n, t, D("text/html; charset=UTF-8", s)), "r");
    return typeof e == "object" ? X(e, Ee.Stringify, false, {}).then(r) : r(e);
  }, "html");
  redirect = /* @__PURE__ */ __name((e, t) => {
    const s = String(e);
    return this.header("Location", /[^\x00-\xFF]/.test(s) ? encodeURI(s) : s), this.newResponse(null, t ?? 302);
  }, "redirect");
  notFound = /* @__PURE__ */ __name(() => (this.#u ??= () => new Response(), this.#u(this)), "notFound");
};
var g = "ALL";
var Oe = "all";
var Pe = ["get", "post", "put", "delete", "options", "patch"];
var J = "Can not add a route since the matcher is already built.";
var Y = class extends Error {
  static {
    __name(this, "Y");
  }
};
var Ae = "__COMPOSED_HANDLER";
var Ce = /* @__PURE__ */ __name((e) => e.text("404 Not Found", 404), "Ce");
var F = /* @__PURE__ */ __name((e, t) => {
  if ("getResponse" in e) {
    const s = e.getResponse();
    return t.newResponse(s.body, s);
  }
  return console.error(e), t.text("Internal Server Error", 500);
}, "F");
var Ie = class Z {
  static {
    __name(this, "Z");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #t = "/";
  routes = [];
  constructor(t = {}) {
    [...Pe, Oe].forEach((i) => {
      this[i] = (a, ...d) => (typeof a == "string" ? this.#t = a : this.#i(i, this.#t, a), d.forEach((o) => {
        this.#i(i, this.#t, o);
      }), this);
    }), this.on = (i, a, ...d) => {
      for (const o of [a].flat()) {
        this.#t = o;
        for (const c of [i].flat()) d.map((l) => {
          this.#i(c.toUpperCase(), this.#t, l);
        });
      }
      return this;
    }, this.use = (i, ...a) => (typeof i == "string" ? this.#t = i : (this.#t = "*", a.unshift(i)), a.forEach((d) => {
      this.#i(g, this.#t, d);
    }), this);
    const { strict: r, ...n } = t;
    Object.assign(this, n), this.getPath = r ?? true ? t.getPath ?? W : be;
  }
  #e() {
    const t = new Z({ router: this.router, getPath: this.getPath });
    return t.errorHandler = this.errorHandler, t.#s = this.#s, t.routes = this.routes, t;
  }
  #s = Ce;
  errorHandler = F;
  route(t, s) {
    const r = this.basePath(t);
    return s.routes.map((n) => {
      let i;
      s.errorHandler === F ? i = n.handler : (i = /* @__PURE__ */ __name(async (a, d) => (await L([], s.errorHandler)(a, () => n.handler(a, d))).res, "i"), i[Ae] = n.handler), r.#i(n.method, n.path, i);
    }), this;
  }
  basePath(t) {
    const s = this.#e();
    return s._basePath = q(this._basePath, t), s;
  }
  onError = /* @__PURE__ */ __name((t) => (this.errorHandler = t, this), "onError");
  notFound = /* @__PURE__ */ __name((t) => (this.#s = t, this), "notFound");
  mount(t, s, r) {
    let n, i;
    r && (typeof r == "function" ? i = r : (i = r.optionHandler, r.replaceRequest === false ? n = /* @__PURE__ */ __name((o) => o, "n") : n = r.replaceRequest));
    const a = i ? (o) => {
      const c = i(o);
      return Array.isArray(c) ? c : [c];
    } : (o) => {
      let c;
      try {
        c = o.executionCtx;
      } catch {
      }
      return [o.env, c];
    };
    n ||= (() => {
      const o = q(this._basePath, t), c = o === "/" ? 0 : o.length;
      return (l) => {
        const h = new URL(l.url);
        return h.pathname = h.pathname.slice(c) || "/", new Request(h, l);
      };
    })();
    const d = /* @__PURE__ */ __name(async (o, c) => {
      const l = await s(n(o.req.raw), ...a(o));
      if (l) return l;
      await c();
    }, "d");
    return this.#i(g, q(t, "*"), d), this;
  }
  #i(t, s, r) {
    t = t.toUpperCase(), s = q(this._basePath, s);
    const n = { basePath: this._basePath, path: s, method: t, handler: r };
    this.router.add(t, s, [r, n]), this.routes.push(n);
  }
  #n(t, s) {
    if (t instanceof Error) return this.errorHandler(t, s);
    throw t;
  }
  #r(t, s, r, n) {
    if (n === "HEAD") return (async () => new Response(null, await this.#r(t, s, r, "GET")))();
    const i = this.getPath(t, { env: r }), a = this.router.match(n, i), d = new xe(t, { path: i, matchResult: a, env: r, executionCtx: s, notFoundHandler: this.#s });
    if (a[0].length === 1) {
      let c;
      try {
        c = a[0][0][0][0](d, async () => {
          d.res = await this.#s(d);
        });
      } catch (l) {
        return this.#n(l, d);
      }
      return c instanceof Promise ? c.then((l) => l || (d.finalized ? d.res : this.#s(d))).catch((l) => this.#n(l, d)) : c ?? this.#s(d);
    }
    const o = L(a[0], this.errorHandler, this.#s);
    return (async () => {
      try {
        const c = await o(d);
        if (!c.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
        return c.res;
      } catch (c) {
        return this.#n(c, d);
      }
    })();
  }
  fetch = /* @__PURE__ */ __name((t, ...s) => this.#r(t, s[1], s[0], t.method), "fetch");
  request = /* @__PURE__ */ __name((t, s, r, n) => t instanceof Request ? this.fetch(s ? new Request(t, s) : t, r, n) : (t = t.toString(), this.fetch(new Request(/^https?:\/\//.test(t) ? t : `http://localhost${q("/", t)}`, s), r, n)), "request");
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (t) => {
      t.respondWith(this.#r(t.request, t, void 0, t.request.method));
    });
  }, "fire");
};
var ee = [];
function Se(e, t) {
  const s = this.buildAllMatchers(), r = /* @__PURE__ */ __name(((n, i) => {
    const a = s[n] || s[g], d = a[2][i];
    if (d) return d;
    const o = i.match(a[0]);
    if (!o) return [[], ee];
    const c = o.indexOf("", 1);
    return [a[1][c], o];
  }), "r");
  return this.match = r, r(e, t);
}
__name(Se, "Se");
var $ = "[^/]+";
var A = ".*";
var C = "(?:|/.*)";
var x = Symbol();
var He = new Set(".\\+*[^]$()");
function $e(e, t) {
  return e.length === 1 ? t.length === 1 ? e < t ? -1 : 1 : -1 : t.length === 1 || e === A || e === C ? 1 : t === A || t === C ? -1 : e === $ ? 1 : t === $ ? -1 : e.length === t.length ? e < t ? -1 : 1 : t.length - e.length;
}
__name($e, "$e");
var ke = class T {
  static {
    __name(this, "T");
  }
  #t;
  #e;
  #s = /* @__PURE__ */ Object.create(null);
  insert(t, s, r, n, i) {
    if (t.length === 0) {
      if (this.#t !== void 0) throw x;
      if (i) return;
      this.#t = s;
      return;
    }
    const [a, ...d] = t, o = a === "*" ? d.length === 0 ? ["", "", A] : ["", "", $] : a === "/*" ? ["", "", C] : a.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let c;
    if (o) {
      const l = o[1];
      let h = o[2] || $;
      if (l && o[2] && (h === ".*" || (h = h.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:"), /\((?!\?:)/.test(h)))) throw x;
      if (c = this.#s[h], !c) {
        if (Object.keys(this.#s).some((p) => p !== A && p !== C)) throw x;
        if (i) return;
        c = this.#s[h] = new T(), l !== "" && (c.#e = n.varIndex++);
      }
      !i && l !== "" && r.push([l, c.#e]);
    } else if (c = this.#s[a], !c) {
      if (Object.keys(this.#s).some((l) => l.length > 1 && l !== A && l !== C)) throw x;
      if (i) return;
      c = this.#s[a] = new T();
    }
    c.insert(d, s, r, n, i);
  }
  buildRegExpStr() {
    const s = Object.keys(this.#s).sort($e).map((r) => {
      const n = this.#s[r];
      return (typeof n.#e == "number" ? `(${r})@${n.#e}` : He.has(r) ? `\\${r}` : r) + n.buildRegExpStr();
    });
    return typeof this.#t == "number" && s.unshift(`#${this.#t}`), s.length === 0 ? "" : s.length === 1 ? s[0] : "(?:" + s.join("|") + ")";
  }
};
var De = class {
  static {
    __name(this, "De");
  }
  #t = { varIndex: 0 };
  #e = new ke();
  insert(e, t, s) {
    const r = [], n = [];
    for (let a = 0; ; ) {
      let d = false;
      if (e = e.replace(/\{[^}]+\}/g, (o) => {
        const c = `@\\${a}`;
        return n[a] = [c, o], a++, d = true, c;
      }), !d) break;
    }
    const i = e.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let a = n.length - 1; a >= 0; a--) {
      const [d] = n[a];
      for (let o = i.length - 1; o >= 0; o--) if (i[o].indexOf(d) !== -1) {
        i[o] = i[o].replace(d, n[a][1]);
        break;
      }
    }
    return this.#e.insert(i, t, r, this.#t, s), r;
  }
  buildRegExp() {
    let e = this.#e.buildRegExpStr();
    if (e === "") return [/^$/, [], []];
    let t = 0;
    const s = [], r = [];
    return e = e.replace(/#(\d+)|@(\d+)|\.\*\$/g, (n, i, a) => i !== void 0 ? (s[++t] = Number(i), "$()") : (a !== void 0 && (r[Number(a)] = ++t), "")), [new RegExp(`^${e}`), s, r];
  }
};
var Te = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var te = /* @__PURE__ */ Object.create(null);
function se(e) {
  return te[e] ??= new RegExp(e === "*" ? "" : `^${e.replace(/\/\*$|([.\\+*[^\]$()])/g, (t, s) => s ? `\\${s}` : "(?:|/.*)")}$`);
}
__name(se, "se");
function Ne() {
  te = /* @__PURE__ */ Object.create(null);
}
__name(Ne, "Ne");
function _e(e) {
  const t = new De(), s = [];
  if (e.length === 0) return Te;
  const r = e.map((c) => [!/\*|\/:/.test(c[0]), ...c]).sort(([c, l], [h, p]) => c ? 1 : h ? -1 : l.length - p.length), n = /* @__PURE__ */ Object.create(null);
  for (let c = 0, l = -1, h = r.length; c < h; c++) {
    const [p, m, j] = r[c];
    p ? n[m] = [j.map(([y]) => [y, /* @__PURE__ */ Object.create(null)]), ee] : l++;
    let f;
    try {
      f = t.insert(m, l, p);
    } catch (y) {
      throw y === x ? new Y(m) : y;
    }
    p || (s[l] = j.map(([y, v]) => {
      const I = /* @__PURE__ */ Object.create(null);
      for (v -= 1; v >= 0; v--) {
        const [S, w] = f[v];
        I[S] = w;
      }
      return [y, I];
    }));
  }
  const [i, a, d] = t.buildRegExp();
  for (let c = 0, l = s.length; c < l; c++) for (let h = 0, p = s[c].length; h < p; h++) {
    const m = s[c][h]?.[1];
    if (!m) continue;
    const j = Object.keys(m);
    for (let f = 0, y = j.length; f < y; f++) m[j[f]] = d[m[j[f]]];
  }
  const o = [];
  for (const c in a) o[c] = s[a[c]];
  return [i, o, n];
}
__name(_e, "_e");
function E(e, t) {
  if (e) {
    for (const s of Object.keys(e).sort((r, n) => n.length - r.length)) if (se(s).test(t)) return [...e[s]];
  }
}
__name(E, "E");
var Le = class {
  static {
    __name(this, "Le");
  }
  name = "RegExpRouter";
  #t;
  #e;
  constructor() {
    this.#t = { [g]: /* @__PURE__ */ Object.create(null) }, this.#e = { [g]: /* @__PURE__ */ Object.create(null) };
  }
  add(e, t, s) {
    const r = this.#t, n = this.#e;
    if (!r || !n) throw new Error(J);
    r[e] || [r, n].forEach((d) => {
      d[e] = /* @__PURE__ */ Object.create(null), Object.keys(d[g]).forEach((o) => {
        d[e][o] = [...d[g][o]];
      });
    }), t === "/*" && (t = "*");
    const i = (t.match(/\/:/g) || []).length;
    if (/\*$/.test(t)) {
      const d = se(t);
      e === g ? Object.keys(r).forEach((o) => {
        r[o][t] ||= E(r[o], t) || E(r[g], t) || [];
      }) : r[e][t] ||= E(r[e], t) || E(r[g], t) || [], Object.keys(r).forEach((o) => {
        (e === g || e === o) && Object.keys(r[o]).forEach((c) => {
          d.test(c) && r[o][c].push([s, i]);
        });
      }), Object.keys(n).forEach((o) => {
        (e === g || e === o) && Object.keys(n[o]).forEach((c) => d.test(c) && n[o][c].push([s, i]));
      });
      return;
    }
    const a = V(t) || [t];
    for (let d = 0, o = a.length; d < o; d++) {
      const c = a[d];
      Object.keys(n).forEach((l) => {
        (e === g || e === l) && (n[l][c] ||= [...E(r[l], c) || E(r[g], c) || []], n[l][c].push([s, i - o + d + 1]));
      });
    }
  }
  match = Se;
  buildAllMatchers() {
    const e = /* @__PURE__ */ Object.create(null);
    return Object.keys(this.#e).concat(Object.keys(this.#t)).forEach((t) => {
      e[t] ||= this.#s(t);
    }), this.#t = this.#e = void 0, Ne(), e;
  }
  #s(e) {
    const t = [];
    let s = e === g;
    return [this.#t, this.#e].forEach((r) => {
      const n = r[e] ? Object.keys(r[e]).map((i) => [i, r[e][i]]) : [];
      n.length !== 0 ? (s ||= true, t.push(...n)) : e !== g && t.push(...Object.keys(r[g]).map((i) => [i, r[g][i]]));
    }), s ? _e(t) : null;
  }
};
var Me = class {
  static {
    __name(this, "Me");
  }
  name = "SmartRouter";
  #t = [];
  #e = [];
  constructor(e) {
    this.#t = e.routers;
  }
  add(e, t, s) {
    if (!this.#e) throw new Error(J);
    this.#e.push([e, t, s]);
  }
  match(e, t) {
    if (!this.#e) throw new Error("Fatal error");
    const s = this.#t, r = this.#e, n = s.length;
    let i = 0, a;
    for (; i < n; i++) {
      const d = s[i];
      try {
        for (let o = 0, c = r.length; o < c; o++) d.add(...r[o]);
        a = d.match(e, t);
      } catch (o) {
        if (o instanceof Y) continue;
        throw o;
      }
      this.match = d.match.bind(d), this.#t = [d], this.#e = void 0;
      break;
    }
    if (i === n) throw new Error("Fatal error");
    return this.name = `SmartRouter + ${this.activeRouter.name}`, a;
  }
  get activeRouter() {
    if (this.#e || this.#t.length !== 1) throw new Error("No active router has been determined yet.");
    return this.#t[0];
  }
};
var P = /* @__PURE__ */ Object.create(null);
var Fe = class re {
  static {
    __name(this, "re");
  }
  #t;
  #e;
  #s;
  #i = 0;
  #n = P;
  constructor(t, s, r) {
    if (this.#e = r || /* @__PURE__ */ Object.create(null), this.#t = [], t && s) {
      const n = /* @__PURE__ */ Object.create(null);
      n[t] = { handler: s, possibleKeys: [], score: 0 }, this.#t = [n];
    }
    this.#s = [];
  }
  insert(t, s, r) {
    this.#i = ++this.#i;
    let n = this;
    const i = ge(s), a = [];
    for (let d = 0, o = i.length; d < o; d++) {
      const c = i[d], l = i[d + 1], h = je(c, l), p = Array.isArray(h) ? h[0] : c;
      if (p in n.#e) {
        n = n.#e[p], h && a.push(h[1]);
        continue;
      }
      n.#e[p] = new re(), h && (n.#s.push(h), a.push(h[1])), n = n.#e[p];
    }
    return n.#t.push({ [t]: { handler: r, possibleKeys: a.filter((d, o, c) => c.indexOf(d) === o), score: this.#i } }), n;
  }
  #r(t, s, r, n) {
    const i = [];
    for (let a = 0, d = t.#t.length; a < d; a++) {
      const o = t.#t[a], c = o[s] || o[g], l = {};
      if (c !== void 0 && (c.params = /* @__PURE__ */ Object.create(null), i.push(c), r !== P || n && n !== P)) for (let h = 0, p = c.possibleKeys.length; h < p; h++) {
        const m = c.possibleKeys[h], j = l[c.score];
        c.params[m] = n?.[m] && !j ? n[m] : r[m] ?? n?.[m], l[c.score] = true;
      }
    }
    return i;
  }
  search(t, s) {
    const r = [];
    this.#n = P;
    let i = [this];
    const a = K(s), d = [];
    for (let o = 0, c = a.length; o < c; o++) {
      const l = a[o], h = o === c - 1, p = [];
      for (let m = 0, j = i.length; m < j; m++) {
        const f = i[m], y = f.#e[l];
        y && (y.#n = f.#n, h ? (y.#e["*"] && r.push(...this.#r(y.#e["*"], t, f.#n)), r.push(...this.#r(y, t, f.#n))) : p.push(y));
        for (let v = 0, I = f.#s.length; v < I; v++) {
          const S = f.#s[v], w = f.#n === P ? {} : { ...f.#n };
          if (S === "*") {
            const R = f.#e["*"];
            R && (r.push(...this.#r(R, t, f.#n)), R.#n = w, p.push(R));
            continue;
          }
          const [ae, _, O] = S;
          if (!l && !(O instanceof RegExp)) continue;
          const b = f.#e[ae], oe = a.slice(o).join("/");
          if (O instanceof RegExp) {
            const R = O.exec(oe);
            if (R) {
              if (w[_] = R[0], r.push(...this.#r(b, t, f.#n, w)), Object.keys(b.#e).length) {
                b.#n = w;
                const ce = R[0].match(/\//)?.length ?? 0;
                (d[ce] ||= []).push(b);
              }
              continue;
            }
          }
          (O === true || O.test(l)) && (w[_] = l, h ? (r.push(...this.#r(b, t, w, f.#n)), b.#e["*"] && r.push(...this.#r(b.#e["*"], t, w, f.#n))) : (b.#n = w, p.push(b)));
        }
      }
      i = p.concat(d.shift() ?? []);
    }
    return r.length > 1 && r.sort((o, c) => o.score - c.score), [r.map(({ handler: o, params: c }) => [o, c])];
  }
};
var Ue = class {
  static {
    __name(this, "Ue");
  }
  name = "TrieRouter";
  #t;
  constructor() {
    this.#t = new Fe();
  }
  add(e, t, s) {
    const r = V(t);
    if (r) {
      for (let n = 0, i = r.length; n < i; n++) this.#t.insert(e, r[n], s);
      return;
    }
    this.#t.insert(e, t, s);
  }
  match(e, t) {
    return this.#t.search(e, t);
  }
};
var ne = class extends Ie {
  static {
    __name(this, "ne");
  }
  constructor(e = {}) {
    super(e), this.router = e.router ?? new Me({ routers: [new Le(), new Ue()] });
  }
};
var Be = /* @__PURE__ */ __name((e) => {
  const s = { ...{ origin: "*", allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"], allowHeaders: [], exposeHeaders: [] }, ...e }, r = /* @__PURE__ */ ((i) => typeof i == "string" ? i === "*" ? () => i : (a) => i === a ? a : null : typeof i == "function" ? i : (a) => i.includes(a) ? a : null)(s.origin), n = ((i) => typeof i == "function" ? i : Array.isArray(i) ? () => i : () => [])(s.allowMethods);
  return async function(a, d) {
    function o(l, h) {
      a.res.headers.set(l, h);
    }
    __name(o, "o");
    const c = await r(a.req.header("origin") || "", a);
    if (c && o("Access-Control-Allow-Origin", c), s.credentials && o("Access-Control-Allow-Credentials", "true"), s.exposeHeaders?.length && o("Access-Control-Expose-Headers", s.exposeHeaders.join(",")), a.req.method === "OPTIONS") {
      s.origin !== "*" && o("Vary", "Origin"), s.maxAge != null && o("Access-Control-Max-Age", s.maxAge.toString());
      const l = await n(a.req.header("origin") || "", a);
      l.length && o("Access-Control-Allow-Methods", l.join(","));
      let h = s.allowHeaders;
      if (!h?.length) {
        const p = a.req.header("Access-Control-Request-Headers");
        p && (h = p.split(/\s*,\s*/));
      }
      return h?.length && (o("Access-Control-Allow-Headers", h.join(",")), a.res.headers.append("Vary", "Access-Control-Request-Headers")), a.res.headers.delete("Content-Length"), a.res.headers.delete("Content-Type"), new Response(null, { headers: a.res.headers, status: 204, statusText: "No Content" });
    }
    await d(), s.origin !== "*" && a.header("Vary", "Origin", { append: true });
  };
}, "Be");
function Ke() {
  const { process: e, Deno: t } = globalThis;
  return !(typeof t?.noColor == "boolean" ? t.noColor : e !== void 0 ? "NO_COLOR" in e?.env : false);
}
__name(Ke, "Ke");
async function We() {
  const { navigator: e } = globalThis, t = "cloudflare:workers";
  return !(e !== void 0 && e.userAgent === "Cloudflare-Workers" ? await (async () => {
    try {
      return "NO_COLOR" in ((await import(t)).env ?? {});
    } catch {
      return false;
    }
  })() : !Ke());
}
__name(We, "We");
var Ve = /* @__PURE__ */ __name((e) => {
  const [t, s] = [",", "."];
  return e.map((n) => n.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1" + t)).join(s);
}, "Ve");
var ze = /* @__PURE__ */ __name((e) => {
  const t = Date.now() - e;
  return Ve([t < 1e3 ? t + "ms" : Math.round(t / 1e3) + "s"]);
}, "ze");
var Ge = /* @__PURE__ */ __name(async (e) => {
  if (await We()) switch (e / 100 | 0) {
    case 5:
      return `\x1B[31m${e}\x1B[0m`;
    case 4:
      return `\x1B[33m${e}\x1B[0m`;
    case 3:
      return `\x1B[36m${e}\x1B[0m`;
    case 2:
      return `\x1B[32m${e}\x1B[0m`;
  }
  return `${e}`;
}, "Ge");
async function U(e, t, s, r, n = 0, i) {
  const a = t === "<--" ? `${t} ${s} ${r}` : `${t} ${s} ${r} ${await Ge(n)} ${i}`;
  e(a);
}
__name(U, "U");
var Qe = /* @__PURE__ */ __name((e = console.log) => async function(s, r) {
  const { method: n, url: i } = s.req, a = i.slice(i.indexOf("/", 8));
  await U(e, "<--", n, a);
  const d = Date.now();
  await r(), await U(e, "-->", n, a, s.res.status, ze(d));
}, "Qe");
var u = new ne();
u.use("*", Qe());
u.use("/api/*", Be());
u.get("/", (e) => e.json({ status: "ok", version: "3.0.0", message: "PanelX V3.0.0 PRO", timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
u.get("/api", (e) => e.json({ status: "operational", version: "3.0.0", endpoints: { security: "/api/users, /api/2fa, /api/audit-logs", monitoring: "/api/bandwidth, /api/geo, /api/servers", business: "/api/invoices, /api/api-keys, /api/commissions", advanced: "/api/recommendations, /api/analytics, /api/cdn, /api/epg" } }));
u.get("/api/users", (e) => e.json({ users: [], message: "Users list" }));
u.post("/api/users", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, user: t }, 201);
});
u.get("/api/users/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ id: t, message: "User details" });
});
u.patch("/api/users/:id", async (e) => {
  const t = e.req.param("id"), s = await e.req.json();
  return e.json({ success: true, id: t, updated: s });
});
u.delete("/api/users/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t, message: "User deleted" });
});
u.get("/api/2fa/activities", (e) => e.json({ activities: [] }));
u.post("/api/2fa/setup", async (e) => (await e.req.json(), e.json({ success: true, secret: "SECRET", qrCode: "QR_URL" })));
u.post("/api/2fa/verify", async (e) => (await e.req.json(), e.json({ success: true, verified: true })));
u.get("/api/audit-logs", (e) => e.json({ logs: [], total: 0 }));
u.get("/api/ip-whitelist", (e) => e.json({ whitelist: [] }));
u.post("/api/ip-whitelist", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, entry: t }, 201);
});
u.delete("/api/ip-whitelist/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t });
});
u.get("/api/login-attempts", (e) => e.json({ attempts: [] }));
u.get("/api/backups", (e) => e.json({ backups: [] }));
u.post("/api/backups", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, backup: t }, 201);
});
u.post("/api/backups/:id/restore", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t, message: "Backup restored" });
});
u.get("/api/bandwidth/overview", (e) => e.json({ totalBandwidth: 0, activeStreams: 0, peakBandwidth: 0, timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
u.get("/api/bandwidth/stats", (e) => e.json({ stats: [] }));
u.post("/api/bandwidth/snapshot", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, snapshot: t }, 201);
});
u.get("/api/bandwidth/alerts", (e) => e.json({ alerts: [] }));
u.post("/api/bandwidth/alerts", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, alert: t }, 201);
});
u.patch("/api/bandwidth/alerts/:id", async (e) => {
  const t = e.req.param("id"), s = await e.req.json();
  return e.json({ success: true, id: t, updated: s });
});
u.delete("/api/bandwidth/alerts/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t });
});
u.post("/api/bandwidth/cleanup", (e) => e.json({ success: true, deleted: 0 }));
u.get("/api/geo/map", (e) => e.json({ connections: [] }));
u.get("/api/geo/analytics", (e) => e.json({ countries: {}, cities: {} }));
u.get("/api/geo/top-countries", (e) => e.json({ countries: [] }));
u.get("/api/geo/top-cities", (e) => e.json({ cities: [] }));
u.get("/api/geo/heatmap", (e) => e.json({ heatmap: [] }));
u.post("/api/geo/refresh-cache", (e) => e.json({ success: true, refreshed: 0 }));
u.get("/api/servers", (e) => e.json({ servers: [] }));
u.post("/api/servers", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, server: t }, 201);
});
u.get("/api/servers/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ id: t, status: "online" });
});
u.patch("/api/servers/:id", async (e) => {
  const t = e.req.param("id"), s = await e.req.json();
  return e.json({ success: true, id: t, updated: s });
});
u.delete("/api/servers/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t });
});
u.get("/api/servers/health", (e) => e.json({ health: [] }));
u.post("/api/servers/:id/sync", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t, synced: true });
});
u.post("/api/servers/:id/failover", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t, failedOver: true });
});
u.get("/api/tmdb/sync-queue", (e) => e.json({ queue: [] }));
u.post("/api/tmdb/sync", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, queued: t }, 201);
});
u.post("/api/tmdb/batch-sync", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, queued: t.length }, 201);
});
u.get("/api/tmdb/metadata/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ id: t, metadata: {} });
});
u.post("/api/tmdb/process-queue", (e) => e.json({ success: true, processed: 0 }));
u.get("/api/tmdb/sync-logs", (e) => e.json({ logs: [] }));
u.get("/api/subtitles", (e) => e.json({ subtitles: [] }));
u.post("/api/subtitles", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, subtitle: t }, 201);
});
u.get("/api/subtitles/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ id: t, subtitle: {} });
});
u.patch("/api/subtitles/:id", async (e) => {
  const t = e.req.param("id"), s = await e.req.json();
  return e.json({ success: true, id: t, updated: s });
});
u.delete("/api/subtitles/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t });
});
u.get("/api/subtitles/languages", (e) => e.json({ languages: ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Russian", "Chinese", "Japanese", "Korean", "Arabic", "Hindi", "Turkish", "Polish", "Dutch", "Swedish", "Norwegian", "Danish", "Finnish"] }));
u.post("/api/subtitles/batch-import", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, imported: t.length }, 201);
});
u.get("/api/subtitles/analytics", (e) => e.json({ analytics: {} }));
u.get("/api/subtitles/popular-languages", (e) => e.json({ languages: [] }));
u.get("/api/invoices", (e) => e.json({ invoices: [] }));
u.post("/api/invoices", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, invoice: t }, 201);
});
u.get("/api/invoices/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ id: t, invoice: {} });
});
u.patch("/api/invoices/:id", async (e) => {
  const t = e.req.param("id"), s = await e.req.json();
  return e.json({ success: true, id: t, updated: s });
});
u.delete("/api/invoices/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t });
});
u.get("/api/invoices/:id/pdf", (e) => {
  const t = e.req.param("id");
  return e.json({ id: t, pdf: "PDF_URL" });
});
u.get("/api/payments", (e) => e.json({ payments: [] }));
u.post("/api/payments", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, payment: t }, 201);
});
u.get("/api/api-keys", (e) => e.json({ apiKeys: [] }));
u.post("/api/api-keys", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, apiKey: t, key: "GENERATED_KEY" }, 201);
});
u.patch("/api/api-keys/:id", async (e) => {
  const t = e.req.param("id"), s = await e.req.json();
  return e.json({ success: true, id: t, updated: s });
});
u.delete("/api/api-keys/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t });
});
u.post("/api/api-keys/:id/rotate", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t, newKey: "NEW_KEY" });
});
u.get("/api/commissions/rules", (e) => e.json({ rules: [] }));
u.post("/api/commissions/rules", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, rule: t }, 201);
});
u.patch("/api/commissions/rules/:id", async (e) => {
  const t = e.req.param("id"), s = await e.req.json();
  return e.json({ success: true, id: t, updated: s });
});
u.delete("/api/commissions/rules/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t });
});
u.get("/api/commissions/payments", (e) => e.json({ payments: [] }));
u.get("/api/recommendations/:userId", (e) => {
  const t = e.req.param("userId");
  return e.json({ userId: t, recommendations: [] });
});
u.get("/api/recommendations/similar/:contentId", (e) => {
  const t = e.req.param("contentId");
  return e.json({ contentId: t, similar: [] });
});
u.get("/api/recommendations/trending", (e) => e.json({ trending: [] }));
u.post("/api/recommendations/preferences/:userId", async (e) => {
  const t = e.req.param("userId"), s = await e.req.json();
  return e.json({ success: true, userId: t, preferences: s });
});
u.get("/api/analytics/dashboard", (e) => e.json({ totalUsers: 0, activeUsers: 0, revenue: 0, churnRate: 0 }));
u.get("/api/analytics/churn/:userId", (e) => {
  const t = e.req.param("userId");
  return e.json({ userId: t, churnRisk: 0, prediction: "low" });
});
u.get("/api/analytics/content/:contentId", (e) => {
  const t = e.req.param("contentId");
  return e.json({ contentId: t, views: 0, engagement: 0 });
});
u.get("/api/analytics/segments", (e) => e.json({ segments: [] }));
u.get("/api/cdn/providers", (e) => e.json({ providers: [] }));
u.post("/api/cdn/providers", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, provider: t }, 201);
});
u.patch("/api/cdn/providers/:id", async (e) => {
  const t = e.req.param("id"), s = await e.req.json();
  return e.json({ success: true, id: t, updated: s });
});
u.delete("/api/cdn/providers/:id", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t });
});
u.get("/api/cdn/analytics", (e) => e.json({ analytics: {} }));
u.get("/api/cdn/cost-optimization", (e) => e.json({ totalCost: 0, recommendations: [] }));
u.post("/api/cdn/track", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, tracked: t });
});
u.post("/api/cdn/purge/:providerId", async (e) => {
  const t = e.req.param("providerId"), s = await e.req.json();
  return e.json({ success: true, providerId: t, purged: s.paths });
});
u.get("/api/epg/search", (e) => {
  const t = e.req.query("q");
  return e.json({ query: t, programs: [] });
});
u.get("/api/epg/channel/:channelId", (e) => {
  const t = e.req.param("channelId");
  return e.json({ channelId: t, schedule: [] });
});
u.post("/api/epg/reminders", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, reminder: t }, 201);
});
u.get("/api/epg/reminders/:userId", (e) => {
  const t = e.req.param("userId");
  return e.json({ userId: t, reminders: [] });
});
u.post("/api/epg/recordings", async (e) => {
  const t = await e.req.json();
  return e.json({ success: true, recording: t }, 201);
});
u.get("/api/epg/recordings/:userId", (e) => {
  const t = e.req.param("userId");
  return e.json({ userId: t, recordings: [] });
});
u.patch("/api/epg/recordings/:id", async (e) => {
  const t = e.req.param("id"), s = await e.req.json();
  return e.json({ success: true, id: t, updated: s });
});
u.get("/api/epg/catchup/:channelId", (e) => {
  const t = e.req.param("channelId");
  return e.json({ channelId: t, catchup: [] });
});
u.post("/api/epg/catchup/:id/view", (e) => {
  const t = e.req.param("id");
  return e.json({ success: true, id: t, viewed: true });
});
var B = new ne();
var Xe = Object.assign({ "/src/index.tsx": u });
var ie = false;
for (const [, e] of Object.entries(Xe)) e && (B.route("/", e), B.notFound(e.notFoundHandler), ie = true);
if (!ie) throw new Error("Can't import modules from ['/src/index.tsx','/app/server.ts']");

// ../../../../usr/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../usr/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-rxhUdu/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = B;

// ../../../../usr/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-rxhUdu/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=bundledWorker-0.45022540003501965.mjs.map
