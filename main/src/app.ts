import express from 'express'
import cors from 'cors'
import 'dotenv/config'

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5002;

import apiRouter from "./routes/apiRouter"

app.use("/api/",apiRouter);

app.listen(PORT,()=>{
    console.log(`Listening on PORT ${PORT}`);
})

