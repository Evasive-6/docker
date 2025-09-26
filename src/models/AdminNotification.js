const mongoose=require('mongoose')

const notificationSchema=new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    type: { type: String, enum: ["new_report", "escalation", "assignment", "status_change", "flag_review"], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report" },
    isRead: { type: Boolean, default: false },
    priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" }
},{timestamps:true})

const Notification=mongoose.model("Notification",notificationSchema)

module.exports=Notification
