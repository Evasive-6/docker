const { default: mongoose } = require("mongoose");

const memberSchema=new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true ,unique:true},
    //  
    phone: { type: String, default: "" },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    role: { type: String, enum: ["member", "supervisor", "head"], default: "member" },
    specialization: [String], // e.g., ["electrical", "plumbing"]
    isActive: { type: Boolean, default: true },
    assignedReports: { type: Number, default: 0 },
    completedReports: { type: Number, default: 0 }
},{timestamps:true})


const Member=mongoose.model("Member",memberSchema)
module.exports=Member

