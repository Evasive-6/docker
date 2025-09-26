const { getPresignedPutUrl, getPublicUrl, getPresignedGetUrl } = require("../services/fileUpload.service");

const presign=async(req,res,next)=>{
    try{

        const{files,prefix}=req.body
        if(!files || !Array.isArray(files) || files.length===0){
            return res.status(400).json({message:"files array is required"})
        }

        const result=await Promise.all(files.map(async(file)=>{
            const safeName=(file.name || "file").replace(/\s+/g, "_");

            let key;
            if(file.key){
                key=file.key
            }else{
                const basePrefix = prefix ? `${prefix.replace(/\/$/, "")}/` : `temp/${Date.now()}-`;
                key=`${basePrefix}${Math.random().toString(36).slice(2, 8)}_${safeName}`;
            }

            const uploadUrl = await getPresignedPutUrl(key,file.contentType || "application/octet-stream");
            const publicUrl=await getPublicUrl(key);
            const getURL =await getPresignedGetUrl(key,300);
            return {key,uploadUrl,publicUrl,getURL}


        }));
        res.json({files:result});
    }catch(err){
        next(err)
    }
}

module.exports={presign}