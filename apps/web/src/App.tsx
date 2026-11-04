import {useEffect,useState,type FormEvent} from 'react';
import {api,moneda,type Categoria,type Periodo,type Resumen,type Usuario} from './lib/api';
import {MovimientoPanel} from './components/MovimientoPanel';
import {CategoriaPanel} from './components/CategoriaPanel';
import {PresupuestoPanel} from './components/PresupuestoPanel';
import {AdminPanel} from './components/AdminPanel';
type Tab='inicio'|'movimientos'|'categorias'|'presupuestos'|'admin';
export default function App(){
 const [usuario,setUsuario]=useState<Usuario|null>(null),[cargando,setCargando]=useState(true);
 const [registro,setRegistro]=useState(false),[error,setError]=useState(''),[tab,setTab]=useState<Tab>('inicio');
 const [resumen,setResumen]=useState<Resumen|null>(null),[periodo,setPeriodo]=useState<Periodo|null>(null),[categorias,setCategorias]=useState<Categoria[]>([]);
 useEffect(()=>{api<{usuario:Usuario}>('/auth/me').then(d=>setUsuario(d.usuario)).catch(()=>setUsuario(null)).finally(()=>setCargando(false));},[]);
 useEffect(()=>{if(usuario?.rol==='USUARIO')void refresh().catch(e=>setError((e as Error).message));
  if(usuario?.rol==='ADMIN')setTab('admin');},[usuario]);
 async function refresh(){const [r,c]=await Promise.all([api<{resumen:Resumen;periodo:Periodo}>('/dashboard'),api<{categorias:Categoria[]}>('/categorias')]);
 setResumen(r.resumen);setPeriodo(r.periodo);setCategorias(c.categorias);}
 async function submitAuth(e:FormEvent<HTMLFormElement>){e.preventDefault();setError('');const d=new FormData(e.currentTarget);
 try{const result=await api<{usuario:Usuario}>(registro?'/auth/register':'/auth/login',{method:'POST',body:JSON.stringify({
  nombre:String(d.get('nombre')??''),correo:String(d.get('correo')??''),password:String(d.get('password')??'')
 })});setUsuario(result.usuario);setTab(result.usuario.rol==='ADMIN'?'admin':'inicio');}
 catch(e){setError((e as Error).message);}}
 async function logout(){try{await api('/auth/logout',{method:'POST'});setUsuario(null);setResumen(null);setPeriodo(null);setTab('inicio');setError('');}
 catch(e){setError((e as Error).message);}}
 if(cargando)return <main className="container"><p role="status">Cargando...</p></main>;
 return <div className="shell"><header className="header"><div className="brand"><span className="logo">MG</span><strong>Mis Gastos</strong><span className="brand-sub">Finanzas personales</span></div>
  {usuario&&<div className="header-right"><span className="welcome">{usuario.nombre}</span><button className="btn outline" onClick={()=>void logout()}>Cerrar sesión</button></div>}
 </header><main className="container">
 {error&&<p role="alert" className="alert">{error} <button className="mini" onClick={()=>setError('')}>Cerrar</button></p>}
 {!usuario?<section className="auth panel"><p className="eyebrow">TU DINERO, BAJO CONTROL</p><h1>{registro?'Crea tu cuenta':'Bienvenido a Mis Gastos'}</h1>
  <p className="muted">Organiza tus ingresos, gastos y presupuestos en un solo lugar.</p>
  <form onSubmit={e=>void submitAuth(e)}>{registro&&<label>Nombre completo<input name="nombre" required autoComplete="name" maxLength={100}/></label>}
   <label>Correo electrónico<input type="email" name="correo" required autoComplete="email"/></label>
   <label>Contraseña<input type="password" name="password" required minLength={registro?10:1} maxLength={128} autoComplete={registro?'new-password':'current-password'}/></label>
   <button className="btn primary" type="submit">{registro?'Crear cuenta':'Ingresar'}</button></form>
  <button className="link" type="button" onClick={()=>{setRegistro(!registro);setError('');}}>{registro?'Ya tengo una cuenta':'¿No tienes cuenta? Regístrate'}</button>
 </section>:<>
 <div className="greeting"><p className="eyebrow">PANEL DE CONTROL</p><h1>Hola, {usuario.nombre.split(' ')[0]} 👋</h1><p className="muted">Consulta y organiza tus finanzas personales.</p></div>
 <nav className="tabs" aria-label="Secciones principales">
 {(usuario.rol==='ADMIN'?[['admin','Administración']]:[['inicio','Resumen'],['movimientos','Movimientos'],['categorias','Categorías'],['presupuestos','Presupuestos']]).map(([key,label])=><button key={key} className={tab===key?'tab active':'tab'} aria-current={tab===key?'page':undefined} onClick={()=>{setTab(key as Tab);setError('');}}>{label}</button>)}
 </nav>
 {usuario.rol==='ADMIN'?<AdminPanel/>:tab==='movimientos'?<MovimientoPanel categorias={categorias} refresh={refresh}/>:
 tab==='categorias'?<CategoriaPanel categorias={categorias} refresh={refresh}/>:
 tab==='presupuestos'?<PresupuestoPanel categorias={categorias} refresh={refresh}/>:
 <section className="space"><div className="stat-grid">
  <article className="stat"><span>Balance total</span><strong>{moneda(resumen?.balance??0)}</strong><small>Ingresos menos gastos acumulados</small></article>
  <article className="stat"><span>Ingresos acumulados</span><strong className="positive">{moneda(resumen?.total_ingresos??0)}</strong><small>Todos los movimientos registrados</small></article>
  <article className="stat"><span>Gastos acumulados</span><strong className="negative">{moneda(resumen?.total_gastos??0)}</strong><small>Todos los movimientos registrados</small></article>
 </div><section className="panel"><div className="section-head"><div><h2>Resumen del mes</h2><p>
  {periodo
    ? `${periodo.mes}/${periodo.anio} · tus categorías principales`
    : 'Resumen mensual no disponible por el momento'}
</p></div></div>
 <div className="stat-grid mini-stats"><div><span>Ingresos del mes</span><strong>{periodo ? moneda(periodo.ingresos) : '—'}</strong></div><div><span>Gastos del mes</span><strong></strong></div><div><span>Balance del mes</span><strong>{periodo ? moneda(periodo.balance) : '—'}</strong></div></div>
 <h3>Distribución de gastos</h3>{!periodo?.gastos_por_categoria.length?<p className="muted">
  {periodo
    ? 'Aún no hay gastos registrados para este mes.'
    : 'La distribución mensual no está disponible por el momento.'}
</p>:
 <div className="list">{periodo.gastos_por_categoria.map(c=><div className="item" key={c.id_categoria}><strong>{c.nombre}</strong><span>{moneda(c.monto)}</span></div>)}</div>}
 </section></section>}
 </>}
 </main><footer className="footer">Mis Gastos · Proyecto académico de Programación Web · URL</footer></div>;
}
