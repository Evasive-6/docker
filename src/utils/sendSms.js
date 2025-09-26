const client = require("../config/twilio")
require('dotenv').config()

const sendSms=async(phone,message)=>{
    try{
        await client.messages.create({
            body:message,
            from:process.env.TWILIO_PHONE_NUMBER,
            to:phone
        })
        console.log(`SMS SEND TO ${phone}`)
    
    }catch(err){
        console.error("Twilio Error",err)
        throw new Error("SMS sending failed")
    }
}

module.exports=sendSms