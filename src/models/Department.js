const mongoose =require('mongoose')

const departmentSchema=new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    description: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    headOfDepartment: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    isActive: { type: Boolean, default: true },
    averageResolutionTime: { type: Number, default: 0 },
    totalReports: { type: Number, default: 0 },
    resolvedReports: { type: Number, default: 0 }
},{timestamps:true})

const Department=mongoose.model("Department",departmentSchema)
module.exports=Department
