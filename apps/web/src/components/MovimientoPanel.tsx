import {useEffect,useState,type FormEvent} from 'react';
import {api,fechaCorta,moneda,type Categoria,type Movimiento,type Tipo} from '../lib/api';
const fechaActual = new Date();
const today = `${fechaActual.getFullYear()}-${String(fechaActual.getMonth() + 1).padStart(2, '0')}-${String(fechaActual.getDate()).padStart(2, '0')}`;
export function MovimientoPanel({categorias,refresh}:{categorias:Categoria[];refresh:()=>Promise<void>}){
 const [items,setItems]=useState<Movimiento[]>([]),[tipo,setTipo]=useState<Tipo>('GASTO');
 const [selected,setSelected]=useState<number|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[filter,setFilter]=useState('TODOS');
 const [edit,setEdit]=useState({monto:'',descripcion:'',fecha:today,id_categoria:''});
 async function load(){const data=await api<{movimientos:Movimiento[]}>('/movimientos?limit=200');setItems(data.movimientos);}
 useEffect(()=>{void load().catch(e=>setError((e as Error).message));},[]);
 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();setError('');setBusy(true);
  const f=e.currentTarget,d=new FormData(f);
  try{
   await api('/movimientos',{method:'POST',body:JSON.stringify({tipo,id_categoria:Number(d.get('categoria')),
    monto:String(d.get('monto')),descripcion:String(d.get('descripcion')??''),fecha:String(d.get('fecha'))})});
   f.reset();await Promise.all([load(),refresh()]);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function remove(id:number){if(!window.confirm('¿Eliminar este movimiento?'))return;
  try{await api(`/movimientos/${id}`,{method:'DELETE'});await Promise.all([load(),refresh()]);}
  catch(e){setError((e as Error).message);}
 }
 function startEdit(m:Movimiento){setSelected(m.id_movimiento);setTipo(m.tipo);setEdit({monto:m.monto,
  descripcion:m.descripcion??'',fecha:m.fecha.slice(0,10),id_categoria:String(m.id_categoria)});}
 async function update(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!selected)return;setBusy(true);setError('');
  try{await api(`/movimientos/${selected}`,{method:'PUT',body:JSON.stringify({tipo,
   monto:edit.monto,descripcion:edit.descripcion,id_categoria:Number(edit.id_categoria),fecha:edit.fecha})});
   setSelected(null);await Promise.all([load(),refresh()]);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="space">
  <div className="section-head"><div><h2>Movimientos</h2><p>Registra, consulta, edita o elimina tus ingresos y gastos.</p></div></div>
  {error&&<p className="alert" role="alert">{error}</p>}
  <div className="two-cols"><section className="panel"><h3>{selected?'Editar movimiento':'Nuevo movimiento'}</h3>
   <form onSubmit={selected?e=>void update(e):e=>void save(e)}>
    <label>Tipo<select value={tipo} onChange={e=>setTipo(e.target.value as Tipo)}><option value="GASTO">Gasto</option><option value="INGRESO">Ingreso</option></select></label>
    <label>Categoría<select key={`${selected??'new'}-${tipo}`} required name="categoria" value={selected?edit.id_categoria:undefined}
      onChange={selected?e=>setEdit(v=>({...v,id_categoria:e.target.value})):undefined} defaultValue={selected?undefined:''}>
      <option value="" disabled>Selecciona una categoría</option>
      {categorias.filter(c=>c.tipo===tipo).map(c=><option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
    </select></label>
    <label>Monto en quetzales<input name="monto" required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?"
      value={selected?edit.monto:undefined} onChange={selected?e=>setEdit(v=>({...v,monto:e.target.value})):undefined} placeholder="250.00"/></label>
    <label>Fecha<input type="date" name="fecha" required defaultValue={selected?undefined:today}
      value={selected?edit.fecha:undefined} onChange={selected?e=>setEdit(v=>({...v,fecha:e.target.value})):undefined}/></label>
    <label>Descripción<input name="descripcion" maxLength={255} value={selected?edit.descripcion:undefined}
      onChange={selected?e=>setEdit(v=>({...v,descripcion:e.target.value})):undefined} placeholder="Ej. Compra de supermercado"/></label>
    <div className="inline"><button className="btn primary" disabled={busy}>{selected?'Guardar cambios':'Agregar movimiento'}</button>
    {selected&&<button type="button" className="btn light" onClick={()=>setSelected(null)}>Cancelar</button>}</div>
   </form>
  </section><section className="panel"><div className="section-head"><h3>Historial reciente</h3><label className="filter">Filtrar
    <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="TODOS">Todos</option><option value="INGRESO">Ingresos</option><option value="GASTO">Gastos</option></select></label></div>
    <div className="list">{items.filter(m=>filter==='TODOS'||m.tipo===filter).length===0&&<p className="muted">No hay movimientos para mostrar.</p>}
    {items.filter(m=>filter==='TODOS'||m.tipo===filter).map(m=><article className="item" key={m.id_movimiento}>
      <div><strong>{m.categoria.nombre}</strong><small>{fechaCorta(m.fecha)} · {m.descripcion||'Sin descripción'}</small></div>
      <div className="item-actions"><strong className={m.tipo==='INGRESO'?'positive':'negative'}>{m.tipo==='INGRESO'?'+':'−'}{moneda(m.monto)}</strong>
      <button type="button" className="mini" onClick={()=>startEdit(m)}>Editar</button>
      <button type="button" className="mini danger" onClick={()=>void remove(m.id_movimiento)}>Eliminar</button></div>
    </article>)}</div>
  </section></div></section>;
}
