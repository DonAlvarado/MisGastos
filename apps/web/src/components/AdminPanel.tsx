import {useEffect,useState,type FormEvent} from 'react';
import {api,fechaCorta,type Categoria,type Usuario,type Tipo} from '../lib/api';
export function AdminPanel(){
 const [usuarios,setUsuarios]=useState<Usuario[]>([]),[categorias,setCategorias]=useState<Categoria[]>([]),[error,setError]=useState('');
 const [nombre,setNombre]=useState(''),[tipo,setTipo]=useState<Tipo>('GASTO');
 async function load(){const [u,c]=await Promise.all([api<{usuarios:Usuario[]}>('/admin/usuarios'),api<{categorias:Categoria[]}>('/admin/categorias')]);setUsuarios(u.usuarios);setCategorias(c.categorias);}
 useEffect(()=>{void load().catch(e=>setError((e as Error).message));},[]);
 async function state(u:Usuario){try{await api(`/admin/usuarios/${u.id_usuario}/estado`,{method:'PATCH',body:JSON.stringify({estado:u.estado==='ACTIVO'?'INACTIVO':'ACTIVO'})});await load();}catch(e){setError((e as Error).message);}}
 async function add(e:FormEvent){e.preventDefault();try{await api('/admin/categorias',{method:'POST',body:JSON.stringify({nombre,tipo})});setNombre('');await load();}catch(e){setError((e as Error).message);}}
 async function edit(c:Categoria){const nuevo=window.prompt('Nuevo nombre de categoría',c.nombre);if(nuevo===null)return;
 try{await api(`/admin/categorias/${c.id_categoria}`,{method:'PUT',body:JSON.stringify({nombre:nuevo,tipo:c.tipo})});await load();}catch(e){setError((e as Error).message);}}
 async function remove(id:number){if(!window.confirm('¿Eliminar categoría global? Solo si no tiene datos asociados.'))return;
 try{await api(`/admin/categorias/${id}`,{method:'DELETE'});await load();}catch(e){setError((e as Error).message);}}
 return <section className="space"><h2>Administración</h2><p className="muted">Gestiona cuentas y categorías globales. No se muestran movimientos financieros de otros usuarios.</p>
 {error&&<p className="alert" role="alert">{error}</p>}
 <section className="panel"><h3>Usuarios registrados</h3><div className="list">{usuarios.map(u=><article className="item" key={u.id_usuario}>
  <div><strong>{u.nombre}</strong><small>{u.correo} · {u.rol} · {u.fecha_registro?fechaCorta(u.fecha_registro):''}</small></div>
  <div className="item-actions"><span className={u.estado==='ACTIVO'?'positive':'negative'}>{u.estado}</span>
  <button className="mini" onClick={()=>void state(u)}>{u.estado==='ACTIVO'?'Deshabilitar':'Habilitar'}</button></div>
 </article>)}</div></section>
 <section className="panel"><h3>Categorías predeterminadas</h3><form className="compact-form" onSubmit={e=>void add(e)}><label>Nombre<input value={nombre} onChange={e=>setNombre(e.target.value)} required maxLength={60}/></label>
 <label>Tipo<select value={tipo} onChange={e=>setTipo(e.target.value as Tipo)}><option value="GASTO">Gasto</option><option value="INGRESO">Ingreso</option></select></label>
 <button className="btn primary">Crear</button></form><div className="list">{categorias.map(c=><article className="item" key={c.id_categoria}><div><strong>{c.nombre}</strong><small>{c.tipo}</small></div>
 <div className="item-actions"><button className="mini" onClick={()=>void edit(c)}>Editar</button><button className="mini danger" onClick={()=>void remove(c.id_categoria)}>Eliminar</button></div></article>)}</div></section>
 </section>;
}
