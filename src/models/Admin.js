const mongoose=require('mongoose')

const adminSchema=new mongoose.Schema({
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    role:{
        type:String,
        default:"admin"
    },
    permissions:[{
        type:String,
        enum:["view_reports", "edit_reports", "delete_reports", "manage_assignments", "manage_departments", "view_analytics", "export_data", "super_admin"]
    }],
    departmentId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Department"
    },
    isActive:{
        type:Boolean,default:true
    },
    lastLoginAt:{
        type:Date
    },
    profile:{
        name:String,
        phone:String,
        designation:String
    }
})

const Admin=mongoose.model('Admin',adminSchema)
module.exports=Admin
