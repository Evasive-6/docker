const generateOtp=()=>{

    const oo= Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`otp${oo}`)
    return oo

}

module.exports=generateOtp;

