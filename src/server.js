require('dotenv').config()
const connectDB = require('./config/db')
const app = require('./express')



const PORT = process.env.PORT;
const HOST = '0.0.0.0'; // Listen on all network interfaces for Android emulator access

connectDB()

app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`)
    console.log(`For Android emulator, use: http://10.0.2.2:${PORT}`)
    console.log(`For localhost, use: http://localhost:${PORT}`)
})
