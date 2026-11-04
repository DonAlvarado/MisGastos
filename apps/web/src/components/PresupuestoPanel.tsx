import {useEffect,useState,type FormEvent} from 'react';
import {api,moneda,type Categoria,type Presupuesto} from '../lib/api';
export function PresupuestoPanel({categorias,refresh}:{categorias:Categoria[];refresh:()=>Promise<void>}){
 const [items,setItems]=useState<Presupuesto[]>([]),[error,setError]=useState('');
 const [editing,setEditing]=useState<number|null>(null),[monto,setMonto]=useState('');
 const [mes,setMes]=useState(new Date().getMonth()+1),[anio,setAnio]=useState(new Date().getFullYear());
 async function load(){const d=await api<{presupuestos:Presupuesto[]}>(`/presupuestos?mes=${mes}&anio=${anio}`);setItems(d.presupuestos);}
 useEffect(()=>{void load().catch(e=>setError((e as Error).message));},[mes,anio]);
 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();setError('');
 const form=e.currentTarget;const d=new FormData(form);
 try{await api(editing?`/presupuestos/${editing}`:'/presupuestos',{method:editing?'PUT':'POST',body:JSON.stringify(editing?
 {monto_limite:monto}:{monto_limite:String(d.get('monto')),mes,anio,id_categoria:Number(d.get('categoria'))})});
 setEditing(null);setMonto('');form.reset();await Promise.all([load(),refresh()]);
 }catch(e){setError((e as Error).message);}}
 async function remove(id:number){if(!window.confirm('¿Eliminar este presupuesto?'))return;
 try{await api(`/presupuestos/${id}`,{method:'DELETE'});await Promise.all([load(),refresh()]);}catch(e){setError((e as Error).message);}}
 return <section className="space"><h2>Presupuestos</h2><p className="muted">Define límites por categoría y observa el avance mensual.</p>
 {error&&<p role="alert" className="alert">{error}</p>}
 <div className="inline"><label>Mes<select value={mes} onChange={e=>setMes(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>
 <label>Año<input type="number" min={2000} max={2100} value={anio} onChange={e=>setAnio(Number(e.target.value))}/></label></div>
 <div className="two-cols"><section className="panel"><h3>{editing?'Modificar presupuesto':'Nuevo presupuesto'}</h3>
 <form onSubmit={e=>void save(e)}>
 {!editing&&<label>Categoría de gasto<select name="categoria" required defaultValue=""><option value="" disabled>Seleccionar categoría</option>
  {categorias.filter(c=>c.tipo==='GASTO').map(c=><option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}</select></label>}
 <label>Límite mensual (Q)<input name="monto" value={editing?monto:undefined} onChange={editing?e=>setMonto(e.target.value):undefined} required pattern="[0-9]+(\.[0-9]{1,2})?" inputMode="decimal" placeholder="1200.00"/></label>
 <div className="inline"><button className="btn primary">{editing?'Guardar límite':'Crear presupuesto'}</button>
 {editing&&<button type="button" className="btn light" onClick={()=>setEditing(null)}>Cancelar</button>}</div>
 </form></section><section className="panel"><h3>Control del mes</h3>
 {items.length===0?<p className="muted">Todavía no hay presupuestos en este periodo.</p>:<div className="list">{items.map(p=>{
 const progress=Math.min(100,Number(p.gastado)/Math.max(Number(p.monto_limite),.01)*100);
 return <article className="budget" key={p.id_presupuesto}><div className="section-head"><strong>{p.categoria.nombre}</strong><span className={p.excedido?'negative':'muted'}>{moneda(p.gastado)} / {moneda(p.monto_limite)}</span></div>
 <div className="progress" role="progressbar" aria-label={`Uso de presupuesto para ${p.categoria.nombre}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div style={{width:`${progress}%`}} className={p.excedido?'over':''}/></div>
 <div className="inline"><small>{p.excedido?'Presupuesto excedido':`Disponible: ${moneda(p.restante)}`}</small><button className="mini" onClick={()=>{setEditing(p.id_presupuesto);setMonto(p.monto_limite);}}>Editar</button><button className="mini danger" onClick={()=>void remove(p.id_presupuesto)}>Eliminar</button></div>
 </article>;})}</div>}
 </section></div></section>;
}
