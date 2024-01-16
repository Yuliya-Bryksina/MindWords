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
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const fs = require("fs");
const { parse } = require("csv-parse"); // Файлы будут временно сохраняться в папке 'uploads'
const nodemailer = require("nodemailer");
const path = require("path");

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
app.use(express.json());

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
    // if (req.body.transcription) {
    //   req.body.transcription = `[${req.body.transcription}]`;
    // }

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

    // Получаем список новых слов
    const newWords = await Word.find({
      studied: false,
      userId: userId,
    }).select("term nextReviewDate");

    // Получаем список слов для повторения
    const wordsToReview = await Word.find({
      studied: true,
      nextReviewDate: { $lte: Date.now() },
      userId: userId,
    }).select("term nextReviewDate");

    res.json({
      newWords: newWords,
      wordsToReview: wordsToReview,
    });
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
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("Пользователь не найден.");
    }

    // Проверяем, является ли дата последнего запроса новых слов текущим днем
    if (!isSameDay(user.lastNewWordsRequest, new Date())) {
      // Если нет, то обновляем список новых слов
      const currentDate = new Date();
      const newWordsQuery = {
        userId: userId,
        studied: false,
        nextReviewDate: { $lte: currentDate }, // Условие для выбора слов, готовых к изучению
      };

      const newWords = await Word.find(newWordsQuery)
        .limit(user.dailyWordLimit)
        .exec();

      user.dailyWordsList = newWords.map((word) => word._id);
      user.lastNewWordsRequest = currentDate;
      await user.save();

      res.json(newWords);
    } else {
      // Если да, то отправляем список слов, которые уже были выбраны для этого дня
      const savedWords = await Word.find({
        _id: { $in: user.dailyWordsList },
      }).exec();

      res.json(savedWords);
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

function isSameDay(date1, date2) {
  return (
    date1 &&
    date2 && // Дополнительная проверка на неопределенность
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

app.get("/api/words-to-review", isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const wordsToReview = await Word.find({
      studied: true,
      nextReviewDate: { $lte: new Date() },
      userId: userId,
    })
      .select(
        "term transcription translation nextReviewDate reviewInterval repetitionLevel efactor learningStep inLearningMode"
      ) // Добавляем выборку нужных полей
      .exec(); // Завершаем запрос
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

// Эндпоинт для обновления статуса слова
app.post("/update-word-status", isAuthenticated, async (req, res) => {
  const { wordId, qualityResponse } = req.body;
  const userId = req.session.userId;

  try {
    const updatedDailyWordsList = await updateWord(
      wordId,
      qualityResponse,
      userId
    );
    res.json({
      message: "Word status updated successfully",
      dailyWordsList: updatedDailyWordsList, // Возвращаем обновленный список слов
    });
  } catch (error) {
    console.error("Error updating word status:", error);
    res.status(500).send(error.message);
  }
});

// Определение шагов изучения

const learningSteps = [1, 10]; // Убедитесь, что этот массив доступен внутри функции

async function updateWord(wordId, qualityResponse, userId) {
  try {
    console.log("Updating word with qualityResponse:", qualityResponse); // Логирование выбранного ответа
    const word = await Word.findOne({ _id: wordId, userId: userId });
    if (!word) {
      throw new Error("Word not found or does not belong to the user");
    }
    console.log("Server: Current word state before updates:", word);

    // Обновляем E-Factor и Review Interval для всех ответов
    word.efactor = calculateEFactor(word.efactor, qualityResponse);
    word.reviewInterval = calculateInterval(
      word.reviewInterval,
      word.efactor,
      word.learningStep,
      qualityResponse
    );

    // Проверка на корректность reviewInterval перед установкой nextReviewDate
    if (!word.reviewInterval || word.reviewInterval < 0) {
      console.error("Invalid review interval calculated:", word.reviewInterval);
      word.reviewInterval = 1; // Установка стандартного интервала в случае ошибки
    }

    // Логика для слов в режиме обучения
    if (word.inLearningMode) {
      if (qualityResponse === 0 || qualityResponse === 1) {
        // "Снова" или "Трудно"
        word.learningStep = 0;
        word.inLearningMode = true; // Слово остается в режиме обучения
      } else {
        // "Хорошо" и "Легко"
        word.learningStep += 1;
        if (word.learningStep >= learningSteps.length) {
          // Выход из режима обучения
          word.inLearningMode = false;
          word.studied = true;
          word.repetitionLevel = 1; // Сброс уровня повторения
        }
      }
    } else {
      // Логика для слов в режиме повторения
      if (qualityResponse === 0) {
        // "Снова"
        word.inLearningMode = true;
        word.learningStep = 0;
        word.repetitionLevel = 0; // Сброс уровня повторения
        word.studied = false; // Изменение статуса на "не изучено" при ответе "Снова"
      } else if (qualityResponse === 1) {
        word.reviewInterval = Math.max(1, word.reviewInterval * 0.75); // Например, уменьшаем интервал на 25%
        word.efactor = Math.max(1.3, word.efactor - 0.1); // Немного уменьшаем E-Factor
        word.repetitionLevel = Math.max(0, word.repetitionLevel - 1); // Уменьшаем уровень повторения
      } else {
        // "Хорошо" и "Легко"
        word.repetitionLevel += 1;
      }
    }

    // Установка следующей даты пересмотра
    word.nextReviewDate = new Date(
      Date.now() + word.reviewInterval * 24 * 60 * 60 * 1000
    );

    console.log("Server: Current word state AFTER updates:", word);

    await word.save();
    // Если слово изучено, удаляем его из списка dailyWordsList пользователя
    if (word.studied) {
      console.log(
        `Attempting to remove wordId ${wordId} from dailyWordsList for user ${userId}`
      );
      const updateResult = await User.findByIdAndUpdate(userId, {
        $pull: { dailyWordsList: wordId },
      });
      console.log("Update result:", updateResult);
    }

    return { message: "Word status updated successfully" };
  } catch (error) {
    console.error(`Error updating word with wordId: ${wordId}:`, error);
    throw error; // Проброс ошибки для последующей обработки
  }
}

function calculateEFactor(efactor, qualityResponse) {
  let newEFactor;

  if (qualityResponse === 0) {
    newEFactor = efactor - 0.2; // Уменьшаем E-Factor сильнее
  } else if (qualityResponse === 1) {
    newEFactor = efactor - 0.15; // Уменьшаем E-Factor умеренно
  } else {
    newEFactor = efactor + 0.1; // Увеличиваем E-Factor для "Хорошо" и "Легко"
  }

  return Math.max(1.3, newEFactor); // E-Factor не может быть меньше 1.3
}

function calculateInterval(
  previousInterval,
  efactor,
  repetitionLevel,
  qualityResponse
) {
  console.log(
    `Calculating interval: previousInterval=${previousInterval}, efactor=${efactor}, repetitionLevel=${repetitionLevel}, qualityResponse=${qualityResponse}`
  );

  let calculatedInterval;

  if (repetitionLevel === 0) {
    // Интервалы для первого повторения
    switch (qualityResponse) {
      case 0:
        calculatedInterval = 1 / 1440; // Меньше минуты
        break;
      case 1:
        calculatedInterval = 6 / 1440; // 6 минут
        break;
      case 3:
        calculatedInterval = 10 / 1440; // 10 минут
        break;
      case 5:
        calculatedInterval = 3; // 3 дня
        break;
      default:
        calculatedInterval = 1 / 1440;
        break;
    }
  } else {
    // Для последующих повторений
    switch (qualityResponse) {
      case 0:
        calculatedInterval = 0.15; // Например, повторить через 6 часов
        break;
      case 1:
        calculatedInterval = previousInterval * 0.6; // Уменьшаем интервал меньше, чем на половину
        break;
      case 3:
        // Увеличиваем интервал значительнее для "Хорошо"
        if (repetitionLevel === 1) {
          calculatedInterval = 1; // 1 сутки для первого повтора "Хорошо"
        } else {
          calculatedInterval =
            previousInterval * (efactor * (1 + repetitionLevel * 0.1));
        }
        break;
      case 5:
        // Увеличиваем интервал для "Легко"
        if (repetitionLevel === 1) {
          calculatedInterval = 3; // 3 сутки для первого повтора "Легко"
        } else {
          calculatedInterval = previousInterval * efactor * 1.5;
        }
        break;
      default:
        calculatedInterval = previousInterval; // Стандартный интервал
        break;
    }
  }

  console.log(`Calculated interval: ${calculatedInterval}`);
  return Math.round(calculatedInterval * 1440) / 1440; // Возвращаем значение в днях, округленное до ближайшей минуты
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

// Маршрут для загрузки файла CSV
app.post(
  "/upload-csv",
  isAuthenticated,
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file; // Получаем файл из запроса
      const deckId = req.body.deckId; // ID колоды для добавления слов
      const words = await parseCsvFile(file.path); // Парсинг CSV файла

      await addWordsToDeck(words, deckId, req.session.userId); // Добавление слов в колоду
      res
        .status(200)
        .json({ success: true, message: "Слова успешно добавлены в колоду." });
    } catch (error) {
      console.error("Ошибка при загрузке CSV:", error);
      res
        .status(500)
        .json({ success: false, message: "Ошибка при обработке файла." });
    }
  }
);

const parseCsvFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const words = [];
    fs.createReadStream(filePath)
      .pipe(
        parse({
          from_line: 2, // Пропускаем строку с заголовками
          trim: true,
          columns: true, // Используем первую строку в качестве названий столбцов
        })
      )
      .on("data", (row) => {
        words.push({
          term: row.term,
          transcription: row.transcription || "", // Если нет транскрипции, используем пустую строку
          translation: row.translation,
        });
      })
      .on("end", () => {
        resolve(words);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
};

// Функция для добавления слов в колоду
const addWordsToDeck = async (words, deckId, userId) => {
  const deck = await Deck.findById(deckId);
  if (!deck) throw new Error("Deck not found.");

  const wordsToInsert = words.map((wordData) => ({
    term: wordData.term,
    transcription: wordData.transcription,
    translation: wordData.translation,
    userId: userId, // Связываем слово с пользователем
    // Поля со значениями по умолчанию не нужно добавлять
  }));

  const insertedWords = await Word.insertMany(wordsToInsert);
  deck.words.push(...insertedWords.map((word) => word._id));
  await deck.save();
};

// Маршрут для импорта слов в колоду
app.post("/import-words", isAuthenticated, async (req, res) => {
  const { deckId, words } = req.body;
  const userId = req.session.userId; // ID пользователя из сессии

  try {
    const deck = await Deck.findOne({ _id: deckId, userId: userId });
    if (!deck) {
      return res
        .status(404)
        .json({ success: false, message: "Колода не найдена." });
    }

    // Преобразуем слова в объекты для вставки в базу данных
    const wordsToInsert = words.map((word) => ({
      ...word,
      userId: userId, // Добавляем ID пользователя к каждому слову
    }));

    // Вставляем слова в базу данных
    const insertedWords = await Word.insertMany(wordsToInsert);

    // Добавляем ID новых слов в колоду
    deck.words.push(...insertedWords.map((word) => word._id));
    await deck.save();

    res.status(200).json({
      success: true,
      message: "Слова успешно импортированы в колоду.",
    });
  } catch (error) {
    console.error("Ошибка при импорте слов:", error);
    res
      .status(500)
      .json({ success: false, message: "Ошибка при импорте слов." });
  }
});

// Получение лимита слов для пользователя
app.get("/api/user/dailyWordLimit", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).send("Пользователь не найден");
    }
    res.json({ dailyWordLimit: user.dailyWordLimit });
  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка при получении данных пользователя");
  }
});

// Эндпоинт для обновления лимита слов на сервере
app.post("/api/user/dailyWordLimit", isAuthenticated, async (req, res) => {
  try {
    const { dailyWordLimit } = req.body;
    const userId = req.session.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("Пользователь не найден");
    }

    user.dailyWordLimit = dailyWordLimit;

    // Проверяем, нужно ли обновить список слов в соответствии с новым лимитом
    const newWords = await Word.find({ studied: false, userId: userId })
      .limit(dailyWordLimit)
      .exec();

    user.dailyWordsList = newWords.map((word) => word._id);
    await user.save();

    res.json({
      dailyWordLimit: user.dailyWordLimit,
      dailyWordsList: user.dailyWordsList,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка при сохранении данных");
  }
});

app.get("/api/words/:wordId", isAuthenticated, async (req, res) => {
  try {
    const word = await Word.findOne({
      _id: req.params.wordId,
      userId: req.session.userId,
    });
    if (!word) {
      return res
        .status(404)
        .send("Word not found or does not belong to the user");
    }
    res.json(word);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_SERVER,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_LOGIN,
    pass: process.env.SMTP_PASSWORD,
  },
});

app.get("/reset-password/:token", async (req, res) => {
  const token = req.params.token;

  // Пример проверки токена в базе данных
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) {
    // Обработка случая, когда токен недействителен или истек
    res.status(400).send("Недействительный или истекший токен сброса пароля.");
  } else {
    console.log(
      `Отправка файла: ${path.join(__dirname, "public", "reset-password.html")}`
    );
    // Отправляем HTML-страницу для установки нового пароля
    res.sendFile(path.join(__dirname, "public", "reset-password.html"));
  }
});

app.post("/request-reset-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send("Пользователь с таким email не найден.");
    }

    // Генерация токена сброса пароля (можно использовать UUID или любой другой уникальный идентификатор)
    const resetToken = require("crypto").randomBytes(32).toString("hex");

    // Сохранение токена сброса пароля в базу данных пользователя
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // Срок действия токена - 1 час
    await user.save();

    // Ссылка для сброса пароля
    const resetURL = `http://localhost:3000/reset-password/${resetToken}`;

    // Отправка email
    await transporter.sendMail({
      from: "remwordsapp@gmail.com",
      to: email,
      subject: "Сброс пароля приложения Remwords",
      text: `Для сброса пароля перейдите по ссылке: ${resetURL}`,
    });

    res.send("Инструкции по сбросу пароля отправлены на email.");
  } catch (error) {
    console.error(error);
    res.status(500).send("Ошибка сервера при запросе сброса пароля.");
  }
});

app.post("/reset-password/:token", async (req, res) => {
  console.log("req.body:", req.body);
  try {
    console.log("req.headers:", req.headers);
    const { token } = req.params;
    const { password } = req.body;
    console.log("Пароль = " + password); // Должен быть пароль

    // Находим пользователя по токену и проверяем срок его действия
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .send("Токен сброса пароля недействителен или истек.");
    }

    if (!password) {
      return res.status(400).send("Пароль не предоставлен.");
    }
    // Генерируем соль
    const salt = await bcrypt.genSalt(10);
    // Хешируем пароль с использованием сгенерированной соли
    const hashedPassword = await bcrypt.hash(password, salt);

    // Устанавливаем новый хешированный пароль и очищаем поля сброса
    user.passwordHash = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // Сохраняем обновленные данные пользователя
    await user.save();

    // Отправляем ответ, что пароль изменен
    res.json({ message: "Пароль успешно изменен." });
  } catch (error) {
    console.error(error);
    res.status(500).send("Ошибка сервера при сбросе пароля.");
  }
});
