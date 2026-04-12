import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { rateLimit } from 'express-rate-limit'

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 300,
	standardHeaders: 'draft-8', 
	legacyHeaders: false, 
	ipv6Subnet: 56, 
})

const app = express();
app.use(cors());
// app.use(limiter)
app.use(express.json());
const PORT = process.env.PORT || 5002;

import apiRouter from "./routes/apiRouter"

app.use("/api/",apiRouter);

app.listen(PORT,()=>{
    console.log(`Listening on PORT ${PORT}`);
})

