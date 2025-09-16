import express from "express";
import deckRouter from "./routes/decks.js";
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use("/decks", deckRouter);

app.get("/", (req, res) => {
  // res.sendStatus(200);
  console.log("test");
  res.send("Hello World");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => console.log(`API on http://0.0.0.0:${PORT}`));
