import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { COOKIE_MINUTES, COOKIE_NAME, cookieOptions, jwtSecret, requireAuth } from '../../middleware/auth';
import { prismaError } from '../../lib/validation';

export const authRouter = Router();
const loginSchema = z.object({
  correo: z.string().trim().toLowerCase().email().max(150),
  password: z.string().min(1).max(128)
});
const registerSchema = loginSchema.extend({
  nombre: z.string().trim().min(1).max(100),
  password: z.string().min(10).max(128)
});
const limiter = rateLimit({ windowMs:15*60*1000, limit:10, standardHeaders:'draft-7', legacyHeaders:false,
  message:{error:'Demasiados intentos. Vuelve a intentar más tarde'} });
function setSession(res: import('express').Response,id:number,ver:number) {
  const token=jwt.sign({ ver },jwtSecret(),{ subject:String(id), expiresIn:COOKIE_MINUTES*60,algorithm:'HS256' });
  res.cookie(COOKIE_NAME,token,{...cookieOptions(),maxAge:COOKIE_MINUTES*60000});
}

authRouter.post('/register',limiter,async(req,res,next)=>{
  try {
    const parsed=registerSchema.safeParse(req.body);
    if(!parsed.success){res.status(400).json({error:'Revisa nombre, correo y contraseña (mínimo 10 caracteres)'});return;}
    const {nombre,correo,password}=parsed.data;
    const existente=await prisma.usuario.findUnique({where:{correo}});
    if(existente){res.status(409).json({error:'Correo ya registrado'});return;}
    const hash=await bcrypt.hash(password,12);
    const user=await prisma.usuario.create({data:{nombre,correo,password:hash}});
    setSession(res,user.id_usuario,user.token_version);
    res.status(201).json({usuario:{id_usuario:user.id_usuario,nombre:user.nombre,correo:user.correo,rol:user.rol}});
  }catch(e){prismaError(e,res,next);}
});

authRouter.post('/login',limiter,async(req,res,next)=>{
  try {
    const parsed=loginSchema.safeParse(req.body);
    if(!parsed.success){res.status(401).json({error:'Credenciales inválidas'});return;}
    const {correo,password}=parsed.data;
    const user=await prisma.usuario.findUnique({where:{correo}});
    if(!user || user.estado!=='ACTIVO'){res.status(401).json({error:'Credenciales inválidas o cuenta deshabilitada'});return;}
    const now=new Date();
    if(user.bloqueado_hasta && user.bloqueado_hasta>now){res.status(429).json({error:'Cuenta bloqueada por 15 minutos'});return;}
    const matches=await bcrypt.compare(password,user.password);
    if(!matches){
      // Actualización condicional para reducir la posibilidad de carreras entre intentos simultáneos.
      const nextCount=(user.bloqueado_hasta && user.bloqueado_hasta<=now?0:user.intentos_fallidos)+1;
      await prisma.usuario.updateMany({where:{id_usuario:user.id_usuario,intentos_fallidos:user.intentos_fallidos},data:{
        intentos_fallidos:nextCount>=5?0:nextCount,
        bloqueado_hasta:nextCount>=5?new Date(Date.now()+15*60000):null
      }});
      res.status(401).json({error:'Credenciales inválidas o cuenta deshabilitada'});return;
    }
    await prisma.usuario.update({where:{id_usuario:user.id_usuario},data:{intentos_fallidos:0,bloqueado_hasta:null}});
    setSession(res,user.id_usuario,user.token_version);
    res.json({usuario:{id_usuario:user.id_usuario,nombre:user.nombre,correo:user.correo,rol:user.rol}});
  }catch(e){next(e);}
});

authRouter.get('/me',requireAuth,(req,res)=>{
 const {id_usuario,nombre,correo,rol}=req.currentUser!;
 res.json({usuario:{id_usuario,nombre,correo,rol}});
});
authRouter.post('/logout',requireAuth,async(req,res,next)=>{
 try {
  await prisma.usuario.update({where:{id_usuario:req.currentUser!.id_usuario},data:{token_version:{increment:1}}});
  res.clearCookie(COOKIE_NAME,cookieOptions());res.status(204).end();
 }catch(e){next(e);}
});
