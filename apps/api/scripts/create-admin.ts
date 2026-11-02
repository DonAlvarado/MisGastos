import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
async function main(){
 const nombre=process.env.ADMIN_NAME?.trim(),correo=process.env.ADMIN_EMAIL?.trim().toLowerCase(),password=process.env.ADMIN_PASSWORD;
 if(!nombre||!correo||!password||password.length<12)throw new Error('Configura ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD de 12+ caracteres en ambiente privado');
 const existing=await prisma.usuario.findUnique({where:{correo}});
 if(existing)throw new Error('El correo ya existe. No se cambia el rol de cuentas registradas automáticamente.');
 await prisma.usuario.create({data:{nombre,correo,password:await bcrypt.hash(password,12),rol:'ADMIN'}});
 console.log('Cuenta de administrador creada (sin imprimir contraseña)');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>prisma.$disconnect());
