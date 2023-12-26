const Word = require("./models/word");
const Deck = require("./models/path-to-deck-model");
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

app.use(express.static("public"));

mongoose
  .connect(
    "mongodb+srv://bryksinaiuliia:FHikiKxDbnJX6QSJ@cluster1.fc0ysks.mongodb.net/?retryWrites=true&w=majority"
  )
  .then(() => console.log("Connected to MongoDB..."))
  .catch((err) => console.error("Could not connect to MongoDB...", err));

app.use(cors());
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/words", async (req, res) => {
  try {
    // Добавление скобок к транскрипции, полученной из запроса
    if (req.body.transcription) {
      req.body.transcription = `[${req.body.transcription}]`;
    }
    const newWord = new Word(req.body);
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

app.get("/daily-tasks", async (req, res) => {
  try {
    const newWordsCount = await Word.countDocuments({ studied: false });
    const wordsToReviewCount = await Word.countDocuments({
      studied: true, // Добавьте это условие
      nextReviewDate: { $lte: Date.now() },
    });
    res.json({ newWords: newWordsCount, wordsToReview: wordsToReviewCount });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/words", async (req, res) => {
  try {
    const wordsToReview = await Word.find({
      nextReviewDate: { $lte: Date.now() },
    });
    res.status(200).send(wordsToReview);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get("/new-words-count", async (req, res) => {
  try {
    // Считаем количество слов, которые еще не изучены
    const count = await Word.countDocuments({ studied: false });
    res.json({ newWordsCount: count });
  } catch (error) {
    console.error("Ошибка при подсчете новых слов: ", error);
    res.status(500).send("Ошибка на сервере при подсчете новых слов");
  }
});

app.get("/api/new-words", async (req, res) => {
  try {
    const newWords = await Word.find({ studied: false });
    res.json(newWords);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/words-to-review", async (req, res) => {
  try {
    const wordsToReview = await Word.find({
      studied: true,
      nextReviewDate: { $lte: new Date() },
    });
    res.json(wordsToReview);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Обработчик маршрута, который будет отвечать на запрос поиска значения слова в БД в модальном окне

// Corrected /get-word-definition handler
app.get("/get-word-definition", async (req, res) => {
  const { word } = req.query;
  console.log(`Запрошенное слово: ${word}`); // Логируем полученное слово
  try {
    const wordDefinition = await Word.findOne({ translation: word });
    console.log(`Найденное определение: ${wordDefinition}`);

    if (!wordDefinition) {
      return res.status(404).send("Word not found");
    }

    res.send({
      term: wordDefinition.term, // Английское слово
      transcription: wordDefinition.transcription, // Транскрипция
      translation: wordDefinition.translation, // Перевод, если вам нужен
    });
  } catch (error) {
    console.error(`Ошибка при поиске слова: ${error}`); // Логируем ошибку
    res.status(500).send("Internal Server Error");
  }
});

app.post("/update-word-status", async (req, res) => {
  try {
    const { wordId, knowsWord } = req.body;
    await updateWord(wordId, knowsWord); // Используем функцию updateWord для обновления статуса слова
    res.send({ message: "Word status updated successfully" });
  } catch (error) {
    res.status(500).send(error);
  }
});

async function updateWord(wordId, knowsWord) {
  const word = await Word.findById(wordId);

  if (!word) {
    throw new Error("Word not found");
  }

  if (knowsWord) {
    // Логика для успешного ответа
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
    // Логика для неуспешного ответа
    word.repetitionLevel = 0;
    word.reviewInterval = 1;
    word.nextReviewDate = new Date();
    // Не изменяем статус studied
  }

  await word.save();
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
// Путь к вашей модели Deck

// Создание новой колоды
app.post("/decks", async (req, res) => {
  try {
    const deck = new Deck({ name: req.body.name });
    await deck.save();
    res.status(201).send(deck);
  } catch (error) {
    res.status(400).send(error);
  }
});

//Маршрут для получения колод с группировкой по месяцам
app.get("/decks/grouped", async (req, res) => {
  try {
    const decks = await Deck.aggregate([
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
    res.send(decks);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Маршрут для поиска колод по имени
app.get("/decks/search", async (req, res) => {
  try {
    const searchQuery = req.query.q;
    // Используем агрегацию, чтобы добавить количество терминов
    const decks = await Deck.aggregate([
      { $match: { name: new RegExp(searchQuery, "i") } }, // Находим колоды по запросу
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
    res.status(500).send(error);
  }
});

// Получение списка колод
// В файле server.js, в маршруте, который загружает колоды
app.get("/decks", async (req, res) => {
  try {
    const decks = await Deck.find({}).populate("words");
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
app.post("/decks/:deckId/words", async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.deckId);
    deck.words.push(req.body.wordId);
    await deck.save();
    res.status(200).send(deck);
  } catch (error) {
    res.status(400).send(error);
  }
});

app.get("/decks/:deckId/words", async (req, res) => {
  try {
    const deckId = req.params.deckId;
    const deck = await Deck.findById(deckId).populate("words");
    if (!deck) {
      return res.status(404).send("Колода не найдена.");
    }
    res.status(200).json({ deckName: deck.name, words: deck.words });
  } catch (error) {
    res.status(500).send(error);
  }
});
