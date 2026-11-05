import 'dotenv/config';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Db } from '../src/db';
import { OrdersService } from '../src/orders.service';
import { CollectionsService } from '../src/collections.service';
import { dhakaDate } from '../src/domain/geo';
const db=new Db();
async function seed() {
  if(await db.user.count()) {console.log('Seed skipped: database already contains users.');return;}
  const password=process.env.SEED_PASSWORD;
  if(!password||password.length<12) throw new Error('Set SEED_PASSWORD with at least 12 characters');
  const passwordHash=await hash(password,12);
  const region=await db.region.create({data:{name:'Dhaka Division'}});
  const area=await db.area.create({data:{name:'Dhaka North',regionId:region.id}});
  const territory=await db.territory.create({data:{name:'Mirpur',areaId:area.id}});
  const distributor=await db.distributor.create({data:{name:'Rahman Trading Co.',code:'DST-001',territoryId:territory.id}});
  const beats=[];
  for(const [name,weekday] of [['Mirpur 10–11',4],['Kazipara–Shewrapara',0]] as const) beats.push(await db.beat.create({data:{name,weekday,territoryId:territory.id}}));
  const roles=[['admin','COMPANY_ADMIN','Amitav Roy Chowdhury'],['manager','AREA_MANAGER','Nadia Rahman'],['distributor','DISTRIBUTOR','Arif Rahman'],['sr','SR','Tanvir Hasan'],['accounts','ACCOUNTS','Farhana Akter']];
  const users=[];
  for(const [email,role,fullName] of roles) users.push(await db.user.create({data:{email:`${email}@fmcg.local`,role,fullName,passwordHash,territoryId:territory.id,...(role==='DISTRIBUTOR'?{distributorId:distributor.id}:{})}}));
  const names=['Bismillah Store','Mayer Doa General Store','Al Madina Traders','Rahim Enterprise','Shapla Super Shop','Bhai Bhai Store','New Town Pharmacy','Mitali Departmental Store','Ayesha Store','Green Leaf Restaurant','Sarker General Store','Daily Needs','Mina Bazar Corner','Janata Store','Azad Traders','Popular Pharmacy','Rupali Store','City Mart','Iqbal Enterprise','Nahar Store','Lakeview Restaurant','Sundarban Traders','Prime Grocery','Sathi Store','Dhaka General Store','Shanti Pharmacy','Eastern Mart','Apon Store','Khan Enterprise','Bengal Grocery'];
  const outlets=[];
  for(let i=0;i<30;i++) outlets.push(await db.outlet.create({data:{name:names[i],code:`OUT-${String(i+1).padStart(3,'0')}`,owner:['Abdul Karim','Mohammad Rahim','Shahidul Islam','Fatima Begum'][i%4],phone:`017${String(10000000+i)}`,address:`House ${i+12}, Road ${i%6+1}, Mirpur, Dhaka`,beatId:beats[i%2].id,channel:names[i].includes('Pharmacy')?'PHARMACY':names[i].includes('Restaurant')?'HOTEL':'GENERAL',lat:23.806+ i*0.0003,lng:90.368+i*0.0001,creditLimitMinor:i===29?10000:5000000}}));
  const products=[['Fresh Soyabean Oil 1L','Cooking essentials',18500],['Fresh Soyabean Oil 5L','Cooking essentials',89000],['Radhuni Turmeric 100g','Spices',7500],['Radhuni Chilli 100g','Spices',8500],['ACI Pure Salt 1kg','Cooking essentials',4200],['Fresh Sugar 1kg','Cooking essentials',13000],['Teer Atta 2kg','Cooking essentials',12400],['Pran UHT Milk 1L','Dairy & beverages',11000],['Ispahani Tea 200g','Dairy & beverages',11000],['Pran Mango Juice 250ml','Dairy & beverages',3000],['Olympic Energy Biscuits','Snacks',2000],['Pran Chanachur 200g','Snacks',6000],['Maggi Noodles 8-pack','Snacks',18500],['Dove Soap 100g','Personal care',9500],['Lifebuoy Soap 100g','Personal care',5500],['Lux Soap 100g','Personal care',6000],['Wheel Detergent 500g','Home care',6500],['Surf Excel 500g','Home care',12000],['Harpic 500ml','Home care',13500],['Vim Dishwash 300g','Home care',4000]] as const;
  const price=await db.priceList.create({data:{name:'Standard trade price',version:1}}),skus=[];
  for(let i=0;i<products.length;i++) {
    const [name,category,priceMinor]=products[i];
    const sku=await db.sku.create({data:{code:`SKU-${String(i+1).padStart(3,'0')}`,name,category,unit:'pcs',packSize:12,reorderLevel:50}});skus.push(sku);
    await db.priceListItem.create({data:{priceListId:price.id,skuId:sku.id,priceMinor}});
    await db.distributorStock.create({data:{distributorId:distributor.id,skuId:sku.id,qty:i===18?28:i===19?42:800+i*20}});
  }
  const start=new Date();start.setDate(1);start.setHours(0,0,0,0);const end=new Date(start);end.setMonth(end.getMonth()+1);
  await db.scheme.create({data:{name:'Everyday trade savings',priority:10,startsOn:start,endsOn:end,rules:{type:'PERCENT',value:3,minMinor:500000}}});
  await db.scheme.create({data:{name:'Energy boost · buy 12, get 1',priority:20,startsOn:start,endsOn:end,rules:{type:'FREE',skuId:skus[10].id,buyQty:12,freeQty:1}}});
  const sr=users.find(u=>u.role==='SR')!,admin=users[0],orders=new OrdersService(db),collections=new CollectionsService(db);
  for(let i=0;i<36;i++) {
    const order=await orders.create(sr,{clientOrderId:randomUUID(),outletId:outlets[i%28].id,distributorId:distributor.id,priceListVersion:1,orderedAt:new Date(Date.now()-(i%5)*86400000).toISOString(),notes:i%7===0?'Morning delivery preferred':'',lines:[{skuId:skus[i%17].id,qty:12+i%6},{skuId:skus[(i+3)%17].id,qty:6+i%4}]}) as {id:string};
    if(i<28) await orders.transition(admin,order.id,'CONFIRMED');
    if(i<24) await orders.transition(admin,order.id,'ALLOCATED');
    if(i<20) await orders.transition(admin,order.id,'DISPATCHED');
    if(i<17) {
      await orders.transition(admin,order.id,'DELIVERED');
      const deliveredAt=new Date(Date.now()-(i%5)*86400000);
      await db.delivery.update({where:{orderId:order.id},data:{deliveredAt}});
      if(i%3!==0) {
        const invoice=await db.invoice.findFirstOrThrow({where:{delivery:{orderId:order.id}}});
        await collections.create(sr,{clientCollectionId:randomUUID(),outletId:outlets[i%28].id,amountMinor:Math.floor(invoice.totalMinor*(i%2?1:0.6)),method:i%2?'BKASH':'CASH',reference:i%2?`TRX-SEED-${i}`:''});
      }
    }
  }
  const month=dhakaDate().slice(0,7);
  await db.target.create({data:{srId:sr.id,periodYm:month,targetMinor:12000000,focusSkuJson:[skus[10].id]}});
  for(let i=0;i<14;i++) await db.journeyVisit.create({data:{srId:sr.id,outletId:outlets[i].id,beatDate:dhakaDate(),callType:i<9?'PRODUCTIVE':i<12?'NO_ORDER':'CLOSED',checkInAt:new Date(Date.now()-i*600000),lat:outlets[i].lat,lng:outlets[i].lng}});
  console.log('Seeded: 1 territory, 2 beats, 1 distributor, 30 outlets, 20 SKUs, 5 roles and sample sales.');
}
seed().finally(()=>db.$disconnect());
