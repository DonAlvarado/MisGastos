import {useState,type FormEvent} from 'react';
import {api,type Categoria,type Tipo} from '../lib/api';
export function CategoriaPanel({categorias,refresh}:{categorias:Categoria[];refresh:()=>Promise<void>}){
 const [error,setError]=useState(''),[editing,setEditing]=useState<Categoria|null>(null);
 const [nombre,setNombre]=useState(''),[tipo,setTipo]=useState<Tipo>('GASTO');
 function reset(){setEditing(null);setNombre('');setTipo('GASTO');}
 async function save(e:FormEvent){e.preventDefault();setError('');try{
  await api(editing?`/categorias/${editing.id_categoria}`:'/categorias',{method:editing?'PUT':'POST',body:JSON.stringify({nombre,tipo})});
  reset();await refresh();
 }catch(e){setError((e as Error).message);}}
 async function remove(id:number){if(!window.confirm('¿Eliminar esta categoría personal?'))return;
 try{await api(`/categorias/${id}`,{method:'DELETE'});await refresh();}catch(e){setError((e as Error).message);}}
 return <section className="space"><h2>Categorías</h2><p className="muted">Las categorías predeterminadas son compartidas y solo un administrador puede editarlas.</p>
 {error&&<p role="alert" className="alert">{error}</p>}
 <div className="two-cols"><section className="panel"><h3>{editing?'Editar categoría':'Nueva categoría personal'}</h3>
  <form onSubmit={e=>void save(e)}><label>Nombre<input required maxLength={60} value={nombre} onChange={e=>setNombre(e.target.value)}/></label>
   <label>Tipo<select value={tipo} onChange={e=>setTipo(e.target.value as Tipo)}><option value="GASTO">Gasto</option><option value="INGRESO">Ingreso</option></select></label>
   <div className="inline"><button className="btn primary">{editing?'Guardar':'Crear categoría'}</button>{editing&&<button type="button" className="btn light" onClick={reset}>Cancelar</button>}</div>
  </form></section><section className="panel"><h3>Categorías disponibles</h3><div className="list">{categorias.map(c=><article className="item" key={c.id_categoria}>
    <div><strong>{c.nombre}</strong><small>{c.tipo} · {c.predeterminada?'Predeterminada':'Personal'}</small></div>
    {!c.predeterminada&&<div className="item-actions"><button className="mini" onClick={()=>{setEditing(c);setNombre(c.nombre);setTipo(c.tipo);}}>Editar</button>
     <button className="mini danger" onClick={()=>void remove(c.id_categoria)}>Eliminar</button></div>}</article>)}</div></section></div></section>;
}
