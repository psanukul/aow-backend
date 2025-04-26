import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import errorHandler from "./middlewares/errorHandler.middleware.js";

const app = express();

const corsOptions = {};

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use(cors(corsOptions));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());


import userRouter from "./routes/user.routes.js";

app.use("/api/v1/users", userRouter);

app.use(errorHandler);
export { app };
