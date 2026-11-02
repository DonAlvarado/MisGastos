import { Router } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth,requireRole } from '../../middleware/auth';
import { moneySchema,idSchema,prismaError } from '../../lib/validation';
export const presupuestosRouter=Router();
presupuestosRouter.use(requireAuth,requireRole('USUARIO'));
const schema=z.object({monto_limite:moneySchema,mes:z.number().int().min(1).max(12),anio:z.number().int().min(2000).max(2100),id_categoria:z.number().int().positive()});
const editSchema=schema.partial().refine(v=>Object.keys(v).length>0);
async function validCategory(owner:number,id_categoria:number){
 return prisma.categoria.findFirst({where:{id_categoria,tipo:'GASTO',OR:[{id_usuario:owner},{id_usuario:null,predeterminada:true}]}});
}
async function listBudget(owner:number,mes?:number,anio?:number){
 const budgets=await prisma.presupuesto.findMany({where:{id_usuario:owner,...(mes?{mes}:{}),...(anio?{anio}:{})},
  include:{categoria:{select:{nombre:true}}},orderBy:[{anio:'desc'},{mes:'desc'}]});
 const data=await Promise.all(budgets.map(async p=>{
  const desde=new Date(Date.UTC(p.anio,p.mes-1,1));const hasta=new Date(Date.UTC(p.anio,p.mes,1));
  const a=await prisma.movimiento.aggregate({where:{id_usuario:owner,id_categoria:p.id_categoria,tipo:'GASTO',fecha:{gte:desde,lt:hasta}},_sum:{monto:true}});
  const gastado=a._sum.monto??new Prisma.Decimal(0);
  return {id_presupuesto:p.id_presupuesto,monto_limite:p.monto_limite,mes:p.mes,anio:p.anio,
   id_categoria:p.id_categoria,categoria:p.categoria,gastado,restante:p.monto_limite.minus(gastado),excedido:gastado.gt(p.monto_limite)};
 }));return data;
}
presupuestosRouter.get('/',async(req,res,next)=>{
 try{
  const m=idSchema.safeParse(req.query.mes),a=idSchema.safeParse(req.query.anio);
  const mes=m.success&&m.data<=12?m.data:undefined,anio=a.success?a.data:undefined;
  res.json({presupuestos:await listBudget(req.currentUser!.id_usuario,mes,anio)});
 }catch(e){next(e);}
});
presupuestosRouter.post('/',async(req,res,next)=>{
 try{
  const body=schema.safeParse(req.body);
  if(!body.success){res.status(400).json({error:'Presupuesto inválido'});return;}
  const owner=req.currentUser!.id_usuario;
  if(!await validCategory(owner,body.data.id_categoria)){res.status(400).json({error:'Categoría de gasto inválida'});return;}
  const {monto_limite,...rest}=body.data;
  const presupuesto=await prisma.presupuesto.create({data:{...rest,id_usuario:owner,monto_limite:new Prisma.Decimal(monto_limite)}});
  res.status(201).json({presupuesto});
 }catch(e){prismaError(e,res,next);}
});
presupuestosRouter.put('/:id',async(req,res,next)=>{
 try{
  const id=idSchema.safeParse(req.params.id),body=editSchema.safeParse(req.body);
  if(!id.success||!body.success){res.status(400).json({error:'Presupuesto inválido'});return;}
  const owner=req.currentUser!.id_usuario;
  const old=await prisma.presupuesto.findFirst({where:{id_presupuesto:id.data,id_usuario:owner}});
  if(!old){res.status(404).json({error:'Presupuesto no encontrado'});return;}
  const category=body.data.id_categoria??old.id_categoria;
  if(!await validCategory(owner,category)){res.status(400).json({error:'Categoría de gasto inválida'});return;}
  const {monto_limite,...rest}=body.data;
  const result=await prisma.presupuesto.updateMany({where:{id_usuario:owner,id_presupuesto:id.data},data:{
   ...rest,...(monto_limite?{monto_limite:new Prisma.Decimal(monto_limite)}:{})
  }});
  if(!result.count){res.status(404).json({error:'Presupuesto no encontrado'});return;}
  res.json({presupuesto:await prisma.presupuesto.findUnique({where:{id_presupuesto:id.data}})});
 }catch(e){prismaError(e,res,next);}
});
presupuestosRouter.delete('/:id',async(req,res,next)=>{
 try{
  const id=idSchema.safeParse(req.params.id);
  if(!id.success){res.status(400).json({error:'ID inválido'});return;}
  const result=await prisma.presupuesto.deleteMany({where:{id_presupuesto:id.data,id_usuario:req.currentUser!.id_usuario}});
  if(!result.count){res.status(404).json({error:'Presupuesto no encontrado'});return;}
  res.status(204).end();
 }catch(e){next(e);}
});
