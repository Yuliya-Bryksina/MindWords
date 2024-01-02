require("dotenv").config();

const Word = require("./models/word");
const Deck = require("./models/path-to-deck-model");
const User = require("./models/user"); // Путь к вашей модели пользователя
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const router = express.Router();

const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Включать только при использовании HTTPS
    },
    store: MongoStore.create({
      mongoUrl: process.env.DB_URI,
      ttl: 14 * 24 * 60 * 60, // Срок жизни сессии в секундах (14 дней)
    }),
  })
);

app.use(express.static("public"));

mongoose
  .connect(process.env.DB_URI)
  .then(() => console.log("Connected to MongoDB..."))
  .catch((err) => console.error("Could not connect to MongoDB...", err));

app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/words", isAuthenticated, async (req, res) => {
  try {
    // Добавление скобок к транскрипции, полученной из запроса
    if (req.body.transcription) {
      req.body.transcription = `[${req.body.transcription}]`;
    }

    // Создаем новое слово с userId из сессии
    const newWord = new Word({ ...req.body, userId: req.session.userId });
    await newWord.save();

    // Проверяем, передан ли ID колоды
    if (req.body.deckId) {
      await Deck.findByIdAndUpdate(req.body.deckId, {
        $push: { words: newWord._id },
      });
    }

    res.status(201).send(newWord);
  } catch (error) {
    res.status(400).send(error);
  }
});

app.get("/daily-tasks", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const newWordsCount = await Word.countDocuments({
      studied: false,
      userId: userId,
    });
    const wordsToReviewCount = await Word.countDocuments({
      studied: true,
      nextReviewDate: { $lte: Date.now() },
      userId: userId,
    });
    res.json({ newWords: newWordsCount, wordsToReview: wordsToReviewCount });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/words", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const wordsToReview = await Word.find({
      nextReviewDate: { $lte: Date.now() },
      userId: userId,
    });
    res.status(200).send(wordsToReview);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get("/new-words-count", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const count = await Word.countDocuments({ studied: false, userId: userId });
    res.json({ newWordsCount: count });
  } catch (error) {
    console.error("Ошибка при подсчете новых слов: ", error);
    res.status(500).send("Ошибка на сервере при подсчете новых слов");
  }
});

app.get("/api/new-words", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const newWords = await Word.find({ studied: false, userId: userId });
    res.json(newWords);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/words-to-review", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const wordsToReview = await Word.find({
      studied: true,
      nextReviewDate: { $lte: new Date() },
      userId: userId,
    });
    res.json(wordsToReview);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Обработчик маршрута, который будет отвечать на запрос поиска значения слова в БД в модальном окне

// Corrected /get-word-definition handler
app.get("/get-word-definition", isAuthenticated, async (req, res) => {
  const { word } = req.query;
  const userId = req.session.userId;

  try {
    const wordDefinition = await Word.findOne({
      translation: word,
      userId: userId,
    });
    if (!wordDefinition) {
      return res
        .status(404)
        .send("Word not found or does not belong to the user");
    }

    res.send({
      term: wordDefinition.term,
      transcription: wordDefinition.transcription,
      translation: wordDefinition.translation,
    });
  } catch (error) {
    console.error(`Ошибка при поиске слова: ${error}`);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/update-word-status", isAuthenticated, async (req, res) => {
  const { wordId, knowsWord } = req.body;
  const userId = req.session.userId;

  try {
    await updateWord(wordId, knowsWord, userId); // Обновляем с учетом userId
    res.send({ message: "Word status updated successfully" });
  } catch (error) {
    res.status(500).send(error);
  }
});

async function updateWord(wordId, knowsWord, userId) {
  try {
    // Поиск слова с учетом userId для обеспечения безопасности
    const word = await Word.findOne({ _id: wordId, userId: userId });

    if (!word) {
      throw new Error("Word not found or does not belong to the user");
    }

    // Теперь логика обновления слова
    if (knowsWord) {
      // Логика для ситуации, когда пользователь знает слово
      word.repetitionLevel += 1;
      word.efactor = calculateEFactor(word.efactor, 5);
      word.reviewInterval = calculateInterval(
        word.reviewInterval,
        word.efactor,
        word.repetitionLevel
      );
      word.nextReviewDate = new Date(
        Date.now() + word.reviewInterval * 24 * 60 * 60 * 1000
      );
      word.studied = true;
    } else {
      // Логика для ситуации, когда пользователь не знает слово
      word.repetitionLevel = 0;
      word.reviewInterval = 1;
      word.nextReviewDate = new Date();
      // Поле studied не изменяется
    }

    await word.save();
    console.log("Word saved successfully.");
  } catch (error) {
    console.error("Error in updateWord:", error);
    throw error;
  }
}

function calculateEFactor(efactor, qualityResponse) {
  // Функция для расчета E-фактора
  return Math.max(
    1.3,
    efactor +
      (0.1 - (5 - qualityResponse) * (0.08 + (5 - qualityResponse) * 0.02))
  );
}

function calculateInterval(previousInterval, efactor, repetitionCount) {
  // Функция для расчета интервала
  if (repetitionCount === 1) {
    return 1;
  } else if (repetitionCount === 2) {
    return 6;
  } else {
    return Math.round(previousInterval * efactor);
  }
}

// Добавьте дополнительные маршруты для обновления и удаления слов здесь

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

//---Создание функционала колод---//

// Создание новой колоды
app.post("/decks", isAuthenticated, async (req, res) => {
  try {
    // Создаем новую колоду с userId из сессии
    const deck = new Deck({
      name: req.body.name,
      userId: req.session.userId, // Привязываем колоду к текущему пользователю
      updatedAt: Date.now(), // Явно устанавливаем текущую дату обновления
    });
    await deck.save();
    res.status(201).send(deck);
  } catch (error) {
    res.status(400).send(error);
  }
});

//Маршрут для получения колод с группировкой по месяцам
app.get("/decks/grouped", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Проверяем, есть ли колоды у пользователя
    const decksCount = await Deck.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
    });
    if (decksCount === 0) {
      // Если колод нет, отправляем пустой массив
      return res.json([]);
    }

    // Если колоды есть, продолжаем запрос агрегации
    const decks = await Deck.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $project: {
          name: 1,
          termCount: { $size: "$words" },
          lastUpdated: 1,
          monthYear: { $dateToString: { format: "%Y-%m", date: "$updatedAt" } },
        },
      },
      {
        $group: {
          _id: "$monthYear",
          decks: { $push: "$$ROOT" },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.json(decks);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// Маршрут для поиска колод по имени
app.get("/decks/search", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const searchQuery = req.query.q;
    console.log(`Search query received: ${searchQuery}`);

    const decks = await Deck.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          name: new RegExp(searchQuery, "i"),
        },
      }, // Фильтруем колоды по userId и поисковому запросу
      {
        $project: {
          name: 1,
          words: 1,
          termCount: { $size: "$words" }, // Добавляем поле termCount
          updatedAt: 1, // Если вам нужно поле updatedAt
        },
      },
    ]);
    res.send(decks);
  } catch (error) {
    console.error("Error during deck search:", error);
    res.status(500).send(error);
  }
});

// Получение списка колод
app.get("/decks", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const decks = await Deck.find({ userId: userId }).populate("words");
    const updatedDecks = decks.map((deck) => {
      return {
        ...deck._doc,
        termCount: deck.words.length, // Добавляем количество слов в каждой колоде
      };
    });
    res.send(updatedDecks);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Добавление слова в колоду
app.post("/decks/:deckId/words", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const deck = await Deck.findOne({ _id: req.params.deckId, userId: userId });

    if (!deck) {
      return res.status(404).send("Колода не найдена или вам не принадлежит.");
    }

    deck.words.push(req.body.wordId);
    await deck.save();
    res.status(200).send(deck);
  } catch (error) {
    res.status(400).send(error);
  }
});

app.get("/decks/:deckId/words", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const deckId = req.params.deckId;
    const deck = await Deck.findOne({ _id: deckId, userId: userId }).populate(
      "words"
    );

    if (!deck) {
      return res.status(404).send("Колода не найдена или вам не принадлежит.");
    }

    res.status(200).json({ deckName: deck.name, words: deck.words });
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post("/update-deck/:deckId", isAuthenticated, async (req, res) => {
  const { deckName, words: updatedWords } = req.body;
  const deckId = req.params.deckId;
  const userId = req.session.userId;

  try {
    // Получение текущего состояния колоды и проверка, что она принадлежит пользователю
    const deck = await Deck.findOne({ _id: deckId, userId: userId });

    if (!deck) {
      return res.status(404).send("Колода не найдена или вам не принадлежит.");
    }

    // Создание массива идентификаторов слов для обновления
    let wordsToUpdate = deck.words.map((word) => word.toString());

    // Обновление слов
    for (const updatedWord of updatedWords) {
      if (wordsToUpdate.includes(updatedWord.id)) {
        await Word.findByIdAndUpdate(updatedWord.id, {
          term: updatedWord.term,
          transcription: updatedWord.transcription,
          translation: updatedWord.translation,
        });
      }
    }

    // Обновление названия колоды
    if (deckName) {
      deck.name = deckName;
      await deck.save();
    }

    res.status(200).json(deck);
  } catch (error) {
    console.error("Error while updating deck:", error);
    res.status(500).json({ message: error.message });
  }
});

// Похоже, что это не используется
// async function getLastUpdatedDateForDecks() {
//   const decks = await Deck.find(); // Получаем все колоды

//   const lastUpdatedDates = await Promise.all(
//     decks.map(async (deck) => {
//       // Находим последнее обновленное слово в колоде
//       const lastWordUpdate = await Word.findOne({ _id: { $in: deck.words } })
//         .sort({ updatedAt: -1 }) // Сортируем слова по дате обновления
//         .select("updatedAt -_id"); // Выбираем только нужное поле

//       return {
//         deckId: deck._id,
//         lastUpdate: lastWordUpdate ? lastWordUpdate.updatedAt : deck.createdAt,
//       };
//     })
//   );

//   return lastUpdatedDates;
// }

app.get("/decks/last-updated", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const decks = await Deck.find({ userId: userId }).populate({
      path: "words",
      options: { sort: { updatedAt: -1 } }, // Сортировка слов по дате обновления
    });

    // Создаем объект, который будет содержать даты последнего обновления
    const deckUpdates = decks.map((deck) => {
      const lastUpdate =
        deck.words.length > 0 ? deck.words[0].updatedAt : deck.createdAt;
      return { deckId: deck._id, lastUpdate };
    });

    res.json(deckUpdates);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/delete-word", isAuthenticated, async (req, res) => {
  const { wordId } = req.body;
  const userId = req.session.userId;

  try {
    // Находим и проверяем слово перед его удалением
    const word = await Word.findOne({ _id: wordId, userId: userId });
    if (!word) {
      return res.status(404).json({
        success: false,
        message: "Слово не найдено или вам не принадлежит.",
      });
    }

    // Удаление слова
    await Word.findByIdAndDelete(wordId);

    // Обновление колод, удаляя из них это слово
    await Deck.updateMany({ userId: userId }, { $pull: { words: wordId } });

    res.json({ success: true, message: "Слово успешно удалено." });
  } catch (error) {
    console.error("Ошибка при удалении слова:", error);
    res
      .status(500)
      .json({ success: false, message: "Ошибка при удалении слова." });
  }
});

app.post("/delete-deck", isAuthenticated, async (req, res) => {
  const { deckId } = req.body;
  const userId = req.session.userId;

  try {
    // Находим и проверяем колоду перед её удалением
    const deck = await Deck.findOne({ _id: deckId, userId: userId });
    if (!deck) {
      return res.status(404).json({
        success: false,
        message: "Колода не найдена или вам не принадлежит.",
      });
    }

    // Удаление всех слов, связанных с колодой
    await Word.deleteMany({ _id: { $in: deck.words } });

    // Удаление самой колоды
    await Deck.findByIdAndDelete(deckId);

    res.json({
      success: true,
      message: "Колода и все связанные слова успешно удалены.",
    });
  } catch (error) {
    console.error("Ошибка при удалении колоды:", error);
    res
      .status(500)
      .json({ success: false, message: "Ошибка при удалении колоды." });
  }
});

// -- НАСТРОЙКА СЕССИЙ-- //

// Маршрут регистрации
app.post("/register", async (req, res) => {
  try {
    console.log(req.body); // Логирование данных запроса
    const { email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send("User already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ email, passwordHash });
    await user.save();

    req.session.userId = user._id; // Сохраняем ID пользователя в сессии
    res.status(201).json({ success: true, message: "User created." });
  } catch (error) {
    console.error("Error creating user:", error); // Логирование ошибки
    res.status(500).send("Error creating user.");
  }
});

// Промежуточное ПО (middleware), которое будет проверять наличие userId в сессии
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    console.log(
      "Пользователь аутентифицирован, ID пользователя:",
      req.session.userId
    );
    next();
  } else {
    console.log("Пользователь не аутентифицирован");
    res.status(401).send("You are not authenticated.");
  }
}

// Использование промежуточного ПО для защищенных маршрутов
app.get("/some-protected-route", isAuthenticated, (req, res) => {
  // Обработчик для защищенного маршрута
  res.send("This is a protected route.");
});

// Маршрут входа
app.post("/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body; // Добавляем `rememberMe` в деструктуризацию
    const user = await User.findOne({ email });
    if (!user || !(await user.isValidPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }
    // Установка идентификатора пользователя для сессии
    req.session.userId = user._id;

    // Установка параметра 'maxAge' куки сессии в зависимости от состояния чекбокса "Запомнить меня"
    if (rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 дней
    } else {
      req.session.cookie.expires = false; // Куки сессии будет удалена при закрытии браузера
    }
    console.log("Сессия установлена на:", req.session.cookie.maxAge);
    console.log("Сессия установлена:", req.session);
    res.json({
      success: true,
      message: "User logged in.",
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in user.",
    });
  }
});

// Маршрут для выхода, который будет уничтожать сессию:
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).send("Could not log out.");
    } else {
      res.send("User logged out.");
    }
  });
});
