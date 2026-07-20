import express from 'express'
import cors from 'cors'
import 'dotenv/config'

import apiRouter from "./routes/apiRouter"

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/", apiRouter);

if (require.main === module) {
    const PORT = process.env.PORT || 5002;
    app.listen(PORT, () => {
        console.log(`Listening on PORT ${PORT}`);
    })
}

export default app;

