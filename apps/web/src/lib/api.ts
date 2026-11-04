export type Tipo='INGRESO'|'GASTO';
export type Usuario={id_usuario:number;nombre:string;correo:string;rol:'USUARIO'|'ADMIN';estado?:'ACTIVO'|'INACTIVO';fecha_registro?:string};
export type Categoria={id_categoria:number;nombre:string;tipo:Tipo;predeterminada:boolean};
export type Movimiento={id_movimiento:number;descripcion:string|null;monto:string;fecha:string;tipo:Tipo;id_categoria:number;categoria:{nombre:string}};
export type Presupuesto={id_presupuesto:number;id_categoria:number;mes:number;anio:number;monto_limite:string;
 categoria:{nombre:string};gastado:string;restante:string;excedido:boolean};
export type Resumen={total_ingresos:string;total_gastos:string;balance:string};
export type Periodo={mes:number;anio:number;ingresos:string;gastos:string;balance:string;
 gastos_por_categoria:{id_categoria:number;nombre:string;monto:string}[]};
export const moneda=(v:string|number)=>new Intl.NumberFormat('es-GT',{style:'currency',currency:'GTQ'}).format(Number(v));
export const fechaCorta=(iso:string)=>new Date(iso).toLocaleDateString('es-GT',{timeZone:'UTC'});
export async function api<T>(url:string,options?:RequestInit):Promise<T>{
 const r=await fetch(`/api${url}`,{credentials:'same-origin',cache:'no-store',...options,
  headers:{...(options?.body?{'Content-Type':'application/json'}:{}),...(options?.headers??{})}});
 if(r.status===204)return {} as T;
 const data:unknown=await r.json().catch(()=>null);
 if(!r.ok){const message=typeof data==='object'&&data!==null&&'error' in data?String(data.error):`Error HTTP ${r.status}`;throw new Error(message);}
 return data as T;
}
