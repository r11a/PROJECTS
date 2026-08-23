const OPERATION_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function offlineIdempotency(pool){
  return async(request,response,next)=>{
    const operationId=String(request.get('X-Offline-Operation-Id')||'');
    if(!operationId)return next();
    if(!OPERATION_ID.test(operationId))return response.status(400).json({error:'מזהה פעולת Offline אינו תקין'});
    const claimed=await pool.query(`INSERT INTO offline_operation_receipts(operation_id,method,path) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING operation_id`,[operationId,request.method,request.originalUrl]);
    if(!claimed.rowCount){
      const existing=await pool.query('SELECT * FROM offline_operation_receipts WHERE operation_id=$1',[operationId]);const receipt=existing.rows[0];
      if(receipt&&(receipt.method!==request.method||receipt.path!==request.originalUrl||(receipt.user_id&&String(receipt.user_id)!==String(request.user?.id||''))))return response.status(409).json({error:'מזהה הסנכרון כבר שייך לפעולה אחרת',code:'OFFLINE_OPERATION_MISMATCH'});
      if(receipt?.status==='completed')return response.status(receipt.response_status||200).json(receipt.response_body||{});
      return response.status(409).json({error:'הפעולה כבר נמצאת בתהליך סנכרון',code:'OFFLINE_SYNC_IN_PROGRESS'});
    }
    const originalJson=response.json.bind(response);let persisted=false;
    response.json=(body)=>{if(!persisted&&response.statusCode<500){persisted=true;pool.query(`UPDATE offline_operation_receipts SET status='completed',response_status=$2,response_body=$3,user_id=$4,updated_at=NOW() WHERE operation_id=$1`,[operationId,response.statusCode,JSON.stringify(body??{}),request.user?.id||null]).then(()=>originalJson(body)).catch(error=>{console.error('Offline receipt persistence failed:',error.message);originalJson(body)});return response}return originalJson(body)};
    response.on('finish',()=>{if(!persisted&&response.statusCode<500)pool.query(`UPDATE offline_operation_receipts SET status='completed',response_status=$2,response_body='{}',user_id=$3,updated_at=NOW() WHERE operation_id=$1`,[operationId,response.statusCode,request.user?.id||null]).catch(error=>console.error('Offline receipt persistence failed:',error.message))});
    next();
  };
}
