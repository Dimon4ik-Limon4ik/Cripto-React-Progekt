import express from "express";

let user = {
  "a7f3k2m9": {
    nickname: "Дима",
    year: "15",
  },
  "b9q1x5n8": {
    nickname: "Алекс",
    year: "18",
  },
  "c4w7p2j6": {
    nickname: "Мария",
    year: "16",
  },
  "d6r3t8v1": {
    nickname: "Иван",
    year: "17",
  },
  "e2s9h4k7": {
    nickname: "Анна",
    year: "14",
  },
  "f5u1l6m3": {
    nickname: "Пётр",
    year: "19",
  },
};

const app = express();

const PORT = process.env.PORT || 5000;

app.get("/api/coins/", (req, res) => {
res.json(user);
});

app.post("/api/coins/change", (req, res) => {
  const {key,parameter,value} = req.body
  if (!user[key]) {
    return res.json({ error: "Пользователь не найден" });
  }
user[key][parameter] = value
  res.json({ message: "Обновлено", user: user[key] });
}

)

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
