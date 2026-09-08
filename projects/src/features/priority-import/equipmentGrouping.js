export function groupEquipment(items,{preview=false}={}) {
  const groups=new Map();
  for(const item of items){
    if(preview&&(item.kind!=='equipment'||['invalid','cancelled','missing'].includes(item.status)))continue;
    const floor=(preview?item.floor:item.custom_values?.import_floor)||'ללא קומה';
    const system=preview?item.systemName:item.system_name||'ללא מערכת';
    const identity=preview?[item.name,item.manufacturer,item.model]:[item.catalog_item_id||item.name,item.manufacturer,item.model];
    const key=JSON.stringify([floor,system,...identity]);
    if(!groups.has(key))groups.set(key,{key,floor,system,name:item.name,manufacturer:item.manufacturer,model:item.model,quantity:0,installed:0,items:[]});
    const group=groups.get(key);group.quantity+=Number(item.quantity||0);group.installed+=Number(preview?item.values?.quantity_installed||0:item.quantity_installed||0);group.items.push(item);
  }
  return [...groups.values()].sort((a,b)=>a.floor.localeCompare(b.floor,'he',{numeric:true})||a.name.localeCompare(b.name,'he'));
}
