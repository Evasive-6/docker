const AWS=require('aws-sdk')

const BUCKET=process.env.S3_BUCKET;
const REGION=process.env.AWS_REGION ||"us-east-1";

const s3Config ={
    accessKeyId:process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY,
    region:REGION,
    signatureVersion:"v4"
}

if(process.env.MINIO_ENDPOINT){
    s3Config.endpoint=process.env.MINIO_ENDPOINT;
    s3Config.s3ForcePathStyle=true;
}

const s3=new AWS.S3(s3Config);

const getPresignedPutUrl=async(key,contentType="application/octet-stream",expires=300)=>{
    if(!BUCKET)throw new Error("S3_BUCKET NOT CONFIGURED");
    const params={
        Bucket:BUCKET,
        Key:key,
        Expires:expires,
        ContentType:contentType
    }
    return s3.getSignedUrlPromise("putObject",params);
}

const getPresignedGetUrl=async(key,expires=600)=>{
    if(!BUCKET)throw new Error("S3_BUCKET not configured")
    
    const params={
        Bucket:BUCKET,
        Key:key,
        Expires:expires
    }
    return s3.getSignedUrlPromise("getObject",params)
}

const getPublicUrl=async(key)=>{
    if(process.env.S3_PUBLIC_URL){
        return `${process.env.S3_PUBLIC_URL.replace(/\/$/,"")}/${key}`
    }
    return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}


const objectExists=async(key)=>{
    try{
        await s3.headObject({Bucket:BUCKET,Key:key}).promise();
        return true
    }catch(err){
        if(err.code==="Not Found" || err.statusCode===404)return false;
        throw err;
    }
}

module.exports={
    s3,getPresignedGetUrl,getPresignedPutUrl,getPublicUrl,objectExists
}
