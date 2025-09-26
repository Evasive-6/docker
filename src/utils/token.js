const jwt=require('jsonwebtoken')
require('dotenv').config()

function signToken(payload,expiresIn="15m"){
    return jwt.sign(payload,process.env.JWT_SECRET,{expiresIn})
}



module.exports={signToken}

