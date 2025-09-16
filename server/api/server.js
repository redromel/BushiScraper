import express from "express";

const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
  // res.sendStatus(200);
  console.log("test");
  res.send("Hello World");
});

app.listen(PORT, "0.0.0.0", () => console.log(`API on http://0.0.0.0:${PORT}`));