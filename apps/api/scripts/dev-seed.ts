import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

async function main() {
 if(process.env.NODE_ENV==='production')throw new Error('No ejecutar seed de demo en producción');
 const pass=process.env.LOCAL_DEMO_PASSWORD;
 if(!pass||pass.length<12)throw new Error('Configura LOCAL_DEMO_PASSWORD (12+ caracteres) solo en apps/api/.env');
 // Sólo categorías de ejemplo, y usuarios locales. Archivo SQL original NO se usa en Neon.
 const defaults:[string,'GASTO'|'INGRESO'][]=[
  ['Salario','INGRESO'],['Negocio propio','INGRESO'],['Otros ingresos','INGRESO'],
  ['Alimentacion','GASTO'],['Transporte','GASTO'],['Vivienda','GASTO'],
  ['Servicios','GASTO'],['Salud','GASTO'],['Universidad','GASTO'],
  ['Entretenimiento','GASTO'],['Otros gastos','GASTO']
 ];
 for(const [nombre,tipo] of defaults){
  const exists=await prisma.categoria.findFirst({where:{nombre,tipo,predeterminada:true,id_usuario:null}});
  if(!exists)await prisma.categoria.create({data:{nombre,tipo,predeterminada:true}});
 }
 const hash=await bcrypt.hash(pass,12);
 for(const [nombre,correo,rol] of [
  ['Admin demo','admin@misgastos.local','ADMIN'],['Usuario demo','demo@misgastos.local','USUARIO']
 ] as const){
  const exists=await prisma.usuario.findUnique({where:{correo}});
  if(!exists)await prisma.usuario.create({data:{nombre,correo,rol,password:hash}});
 }
 console.log('Datos de demostración locales cargados. Usuarios: admin@misgastos.local, demo@misgastos.local');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>prisma.$disconnect());
