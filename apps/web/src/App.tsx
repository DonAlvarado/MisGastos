import { useEffect, useState, type FormEvent } from 'react';

type Usuario = { id_usuario: number; nombre: string; correo: string; rol: 'USUARIO' | 'ADMIN' };
type Categoria = { id_categoria: number; nombre: string; tipo: 'GASTO' | 'INGRESO' };
type Movimiento = { id_movimiento: number; descripcion: string | null; monto: string; fecha: string; tipo: 'GASTO' | 'INGRESO'; categoria: { nombre: string } };
type Resumen = { total_ingresos: string; total_gastos: string; balance: string };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(`/api${url}`, { credentials: 'include', ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  if (r.status === 204) return {} as T;
  const data: unknown = await r.json();
  if (!r.ok) {
    const message = typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : 'Error inesperado';
    throw new Error(message);
  }
  return data as T;
}

function money(value: string) {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(value));
}

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [registro, setRegistro] = useState(false);
  const [error, setError] = useState('');
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [tipo, setTipo] = useState<'GASTO' | 'INGRESO'>('GASTO');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    api<{ usuario: Usuario }>('/auth/me')
      .then(d => setUsuario(d.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!usuario || usuario.rol !== 'USUARIO') return;
    void actualizarFinanzas();
  }, [usuario]);

  async function actualizarFinanzas() {
    try {
      const [r, c, m] = await Promise.all([
        api<{ resumen: Resumen }>('/dashboard'),
        api<{ categorias: Categoria[] }>('/categorias'),
        api<{ movimientos: Movimiento[] }>('/movimientos')
      ]);
      setResumen(r.resumen); setCategorias(c.categorias); setMovimientos(m.movimientos);
    } catch (e) { setError((e as Error).message); }
  }

  async function onAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('');
    const form = new FormData(e.currentTarget);
    const body = { nombre: String(form.get('nombre') ?? ''), correo: String(form.get('correo') ?? ''), password: String(form.get('password') ?? '') };
    try {
      const d = await api<{ usuario: Usuario }>(registro ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(body) });
      setUsuario(d.usuario);
    } catch (e) { setError((e as Error).message); }
  }

  async function onCrear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setMensaje('');
    const f = e.currentTarget;
    const data = new FormData(f);
    try {
      await api('/movimientos', { method: 'POST', body: JSON.stringify({
        descripcion: String(data.get('descripcion') ?? ''),
        monto: String(data.get('monto')), tipo,
        id_categoria: Number(data.get('categoria'))
      }) });
      setMensaje('Movimiento registrado.'); f.reset(); await actualizarFinanzas();
    } catch (e) { setError((e as Error).message); }
  }

  async function logout() {
    setError('');
    try { await api('/auth/logout', { method: 'POST' }); setUsuario(null); setResumen(null); setMovimientos([]); }
    catch (e) { setError((e as Error).message); }
  }

  if (cargando) return <main className="container"><p>Cargando aplicación...</p></main>;
  return <div className="app-shell">
    <header className="header"><div className="brand"><span className="brand-mark">MG</span><strong>Mis Gastos</strong></div>
      {usuario && <button className="btn outline" onClick={() => void logout()}>Cerrar sesión</button>}</header>
    <main className="container">
      {error && <p role="alert" className="alert">{error}</p>}
      {!usuario ? <section className="login-card">
        <p className="eyebrow">FINANZAS PERSONALES</p>
        <h1>{registro ? 'Crea tu cuenta' : 'Bienvenido a Mis Gastos'}</h1>
        <p className="subtle">Controla tus ingresos, gastos y presupuestos en un mismo lugar.</p>
        <form onSubmit={e => void onAuth(e)}>
          {registro && <label>Nombre<input name="nombre" required maxLength={100} autoComplete="name"/></label>}
          <label>Correo electrónico<input name="correo" type="email" required autoComplete="email"/></label>
          <label>Contraseña<input name="password" type="password" minLength={8} required autoComplete={registro ? 'new-password' : 'current-password'}/></label>
          <button className="btn primary" type="submit">{registro ? 'Registrarme' : 'Iniciar sesión'}</button>
        </form>
        <button className="link" onClick={() => { setRegistro(!registro); setError(''); }}>
          {registro ? 'Ya tengo una cuenta' : 'Crear cuenta nueva'}
        </button>
      </section> : <>
        <p className="eyebrow">PANEL PRINCIPAL</p><h1>Hola, {usuario.nombre}</h1>
        <p className="subtle">Sesión activa como {usuario.rol === 'ADMIN' ? 'administrador' : 'usuario'}.</p>
        {usuario.rol === 'ADMIN' ? <section className="panel"><h2>Panel administrador</h2><p>Acceso autorizado. Pendiente: gestión de usuarios y categorías predeterminadas. No se muestran finanzas ajenas.</p></section> : <>
          <div className="cards">
            <article className="card"><span>Ingresos</span><strong>{money(resumen?.total_ingresos ?? '0')}</strong></article>
            <article className="card"><span>Gastos</span><strong>{money(resumen?.total_gastos ?? '0')}</strong></article>
            <article className="card"><span>Balance</span><strong>{money(resumen?.balance ?? '0')}</strong></article>
          </div>
          <div className="columns"><section className="panel">
            <h2>Registrar movimiento</h2>
            <form onSubmit={e => void onCrear(e)}>
              <label>Tipo<select value={tipo} onChange={e => setTipo(e.target.value as 'GASTO' | 'INGRESO')}><option value="GASTO">Gasto</option><option value="INGRESO">Ingreso</option></select></label>
              <label>Categoría<select name="categoria" required defaultValue="" key={tipo}>
                <option value="" disabled>Selecciona una categoría</option>
                {categorias.filter(c => c.tipo === tipo).map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
              </select></label>
              <label>Monto (Q)<input name="monto" type="text" required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" placeholder="250.00"/></label>
              <label>Descripción<input name="descripcion" maxLength={255}/></label>
              <button className="btn primary">Guardar movimiento</button>
              {mensaje && <p role="status" className="success">{mensaje}</p>}
            </form>
          </section><section className="panel">
            <h2>Movimientos recientes</h2>
            {movimientos.length === 0 ? <p className="subtle">Todavía no hay movimientos registrados.</p> : <div className="movimientos">
              {movimientos.map(m => <div className="movimiento" key={m.id_movimiento}>
                <div><strong>{m.categoria.nombre}</strong><small>{m.descripcion || new Date(m.fecha).toLocaleDateString('es-GT')}</small></div>
                <span className={m.tipo === 'GASTO' ? 'negative' : 'positive'}>{m.tipo === 'GASTO' ? '−' : '+'}{money(m.monto)}</span>
              </div>)}
            </div>}
          </section></div>
          <p className="footnote">Base inicial: todavía faltan presupuestos, filtros, edición, eliminación, pruebas completas y panel de administración.</p>
        </>}
      </>}
    </main>
  </div>;
}
