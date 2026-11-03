import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth,requireRole } from '../../middleware/auth';
import { idSchema,prismaError } from '../../lib/validation';
export const adminRouter=Router();adminRouter.use(requireAuth,requireRole('ADMIN'));
const categorySchema=z.object({nombre:z.string().trim().min(1).max(60),tipo:z.enum(['INGRESO','GASTO'])});
adminRouter.get('/usuarios',async(_req,res,next)=>{
 try{
  const usuarios=await prisma.usuario.findMany({select:{id_usuario:true,nombre:true,correo:true,rol:true,estado:true,fecha_registro:true},orderBy:{fecha_registro:'desc'}});
  res.json({usuarios});
 }catch(e){next(e);}
});
adminRouter.patch('/usuarios/:id/estado',async(req,res,next)=>{
 try{
  const id=idSchema.safeParse(req.params.id),body=z.object({estado:z.enum(['ACTIVO','INACTIVO'])}).safeParse(req.body);
  if(!id.success||!body.success){res.status(400).json({error:'Datos inválidos'});return;}
  if(id.data===req.currentUser!.id_usuario && body.data.estado==='INACTIVO'){
   res.status(409).json({error:'No puedes deshabilitar tu propia sesión'});return;
  }
  const result=await prisma.usuario.updateMany({where:{id_usuario:id.data},data:{estado:body.data.estado,token_version:{increment:1}}});
  if(!result.count){res.status(404).json({error:'Usuario no encontrado'});return;}
  res.json({mensaje:'Estado actualizado y sesiones anteriores revocadas'});
 }catch(e){next(e);}
});
adminRouter.get('/categorias',async(_req,res,next)=>{
 try{res.json({categorias:await prisma.categoria.findMany({where:{predeterminada:true,id_usuario:null},orderBy:{nombre:'asc'}})});}catch(e){next(e);}
});
adminRouter.post('/categorias',async(req,res,next)=>{
 try{
  const parsed=categorySchema.safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:'Categoría inválida'});return;}
  const categoria=await prisma.categoria.create({data:{...parsed.data,predeterminada:true,id_usuario:null}});
  res.status(201).json({categoria});
 }catch(e){prismaError(e,res,next);}
});
adminRouter.put('/categorias/:id',async(req,res,next)=>{
 try{
  const id=idSchema.safeParse(req.params.id),body=categorySchema.partial().refine(d=>Object.keys(d).length>0).safeParse(req.body);
  if(!id.success||!body.success){res.status(400).json({error:'Datos inválidos'});return;}
  const old=await prisma.categoria.findFirst({where:{id_categoria:id.data,predeterminada:true,id_usuario:null}});
  if(!old){res.status(404).json({error:'Categoría predeterminada no encontrada'});return;}
  if(body.data.tipo && body.data.tipo!==old.tipo){
   const [mov,pres]=await Promise.all([prisma.movimiento.count({where:{id_categoria:id.data}}),prisma.presupuesto.count({where:{id_categoria:id.data}})]);
   if(mov+pres>0){res.status(409).json({error:'Categoría en uso, no cambiar tipo'});return;}
  }
  const categoria=await prisma.categoria.update({where:{id_categoria:id.data},data:body.data});res.json({categoria});
 }catch(e){prismaError(e,res,next);}
});
adminRouter.delete('/categorias/:id',async(req,res,next)=>{
 try{
  const id=idSchema.safeParse(req.params.id);
  if(!id.success){res.status(400).json({error:'ID inválido'});return;}
  const existing=await prisma.categoria.findFirst({where:{id_categoria:id.data,predeterminada:true,id_usuario:null}});
  if(!existing){res.status(404).json({error:'Categoría predeterminada no encontrada'});return;}
  const [mov,pres]=await Promise.all([prisma.movimiento.count({where:{id_categoria:id.data}}),prisma.presupuesto.count({where:{id_categoria:id.data}})]);
  if(mov+pres>0){res.status(409).json({error:'Categoría utilizada por movimientos o presupuestos'});return;}
  await prisma.categoria.delete({where:{id_categoria:id.data}});res.status(204).end();
 }catch(e){prismaError(e,res,next);}
});
