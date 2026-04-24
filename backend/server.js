require("dotenv/config");

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { PrismaClient } = require("@prisma/client");

const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || "file:./prisma/dev.db"
});

const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors());
app.use(express.json());

const SECRET = "supersecret";

// регистрация
app.post("/register", async (req, res) => {
    const { username, password, rights } = req.body;

    if (!username || !password) { return res.status(400).json({ message: "username или password отсутствует" }); }
    if (!password || password.length < 8) {return res.status(400).json({message: "Пароль должен быть минимум 8 символов"});}
    if (password.length > 16) {return res.status(400).json({message: "Пароль слишком длинный"});}

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            username,
            password: hash,
            rights
        }
    });
    console.log("USER CREATED:", user);

    res.json({username: username});
});

app.get('/user/check', async (req, res) => {
    const { username } = req.query;
    const user = await prisma.user.findUnique({
        where: { username: String(username) }
    });
    res.json({ exists: !!user });
});

app.get("/barrels", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });

    const decoded = jwt.verify(token, SECRET);
    const userId = decoded.id;

    const barrels = await prisma.barrels.findMany({
      where: { ownerId: userId }
    });

    res.json(barrels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// логин
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
        where: { username }
    });

    if (!user) return res.status(404).json({ message: "Неверный логин или пароль" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Ошибка обработки пароля" });

    const token = jwt.sign({id: user.id, rights: user.rights}, SECRET);

    res.json({token, username: username, rights: user.rights, isSO: user.isSO});
});

// middleware
function auth(req, res, next) {
    const token = req.headers.authorization;
    if (!token) return res.sendStatus(403);

    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch {
        res.sendStatus(403);
    }
}

app.post("/items", async (req, res) => {
  const { name, type, image } = req.body;

  const item = await prisma.item.create({
    data: { name, type, image }
  });

  res.json(item);
});

app.patch("/barrels/:id", async (req, res) => {
  const { itemId } = req.body;

  const barrel = await prisma.barrels.update({
    where: { id: req.params.id },
    data: {
      itemId: itemId || null
    }
  });

  res.json(barrel);
});

// создать бочку
app.post("/barrels_create", auth, async (req, res) => {
    const product = await prisma.barrels.create({
        data: {
            xyz: req.xyz,
            ownerId: req.user.id
        }
    });

    res.json(product);
});

// поиск
app.get("/search", async (req, res) => {
  const search = req.query.search || "";

  const items = await prisma.item.findMany({
    where: {
      name: {
        contains: search,
        mode: "insensitive"
      }
    },
    orderBy: {
      likes: "desc" // 🔥 популярные выше
    }
  });

  res.json(items);
});

app.get("/search/recommended", async (req, res) => {
  const items = await prisma.item.findMany({
    orderBy: [
      { likes: "desc" },
      { createdAt: "desc" }
    ],
    take: 10
  });

  res.json(items);
});

app.listen(5000, () => console.log("Backend running"));
