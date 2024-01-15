let currentWordIndex = 0; // Индекс текущего слова
let wordList = []; // Список слов
let currentContext = ""; // "newWord" или "reviewWord"
let wordChanges = {}; // Ключ - это ID слова, значение - объект с изменениями
let parsedWords = []; // Глобальная переменная для хранения разобранных слов
let dailyWordLimit = 10; // Значение по умолчанию

function checkAuthentication() {
  const pathname = window.location.pathname;
  const excludedPaths = [
    "/login.html",
    "/register.html",
    // Убедитесь, что следующий путь соответствует формату URL, который вы используете для страницы сброса пароля
    "/reset-password.html",
    "/request-reset-password.html",
  ];

  // Мы добавляем регулярное выражение для проверки пути сброса пароля, который включает токен
  const excludedRegex = [
    /^\/reset-password\/[0-9a-fA-F]{40}\.html$/,
    // Добавьте другие регулярные выражения, если они вам нужны
  ];

  // Проверяем, является ли текущий путь исключением
  const isExcluded =
    excludedPaths.includes(pathname) ||
    excludedRegex.some((regex) => regex.test(pathname));

  if (isExcluded) {
    // Не выполнять редирект, если мы на одной из исключенных страниц
    console.log(
      "Находимся на странице, которая не требует аутентификации:",
      pathname
    );
    return true;
  }

  // Проверяем аутентификацию
  const isAuthenticated = localStorage.getItem("isAuthenticated");

  if (!isAuthenticated) {
    console.log("Редирект на страницу входа");
    window.location.href = "/login.html";
    return false;
  }

  return true;
}

if (window.location.pathname.includes("/deck.html")) {
  loadDeckWords();
}

function showNotification(message) {
  console.log("showNotification called with message:", message); // Добавить для отладки
  const notification = document.getElementById("notification");
  if (notification) {
    notification.textContent = message;
    notification.style.display = "block";

    setTimeout(() => {
      notification.style.display = "none";
    }, 3000);
  } else {
    console.log("Notification element not found"); // Добавить для отладки
  }
}

function updateDailyTasks() {
  console.log("updateDailyTasks called"); // Добавьте эту строку для отладки

  // Теперь получаем данные ежедневных задач
  return fetch("/daily-tasks") // Используем именно этот адрес
    .then((response) => response.json())
    .then((data) => {
      const now = new Date();
      const wordsToReviewCount = data.wordsToReview.filter((word) => {
        const reviewDate = new Date(word.nextReviewDate);
        return reviewDate <= now;
      }).length;

      const wordsToReviewCountElement =
        document.getElementById("wordsToReviewCount");
      if (wordsToReviewCountElement) {
        wordsToReviewCountElement.textContent = wordsToReviewCount;
      }
    })
    .catch((error) => {
      console.error("Ошибка при получении ежедневных задач:", error);
    });
}

function getTranslations(word) {
  const translationsElement = document.getElementById("translations");
  const transcriptionElement = document.getElementById("transcription");
  const translationElement = document.getElementById("translation");
  translationsElement.innerHTML = ""; // Очищаем предыдущие результаты

  if (word.length > 0) {
    translationsElement.style.display = "block";

    // Замените 'your-api-key' на ваш реальный ключ API
    const apiKey =
      "dict.1.1.20231220T193259Z.b792137434d37bea.a1702dd0a2afca504fb7b5891f602dfe827e67d2";
    const apiURL = `https://dictionary.yandex.net/api/v1/dicservice.json/lookup?key=${apiKey}&lang=en-ru&text=${word}`;

    fetch(apiURL)
      .then((response) => response.json())
      .then((data) => {
        if (data.def && data.def.length > 0) {
          const firstTranslation = data.def[0];
          const transcription = firstTranslation.ts;
          transcriptionElement.value = transcription; // Устанавливаем транскрипцию

          firstTranslation.tr.slice(0, 3).forEach((item) => {
            const translationDiv = document.createElement("div");
            translationDiv.textContent = item.text;
            translationDiv.classList.add("translation-option");
            translationDiv.onclick = () => {
              // Обработчик клика по варианту перевода
              translationElement.value = item.text;
            };
            translationsElement.appendChild(translationDiv);
          });
        } else {
          translationsElement.innerHTML = "Переводы не найдены.";
        }
      })
      .catch((error) => {
        translationsElement.innerHTML = "Ошибка загрузки переводов.";
        console.error("Error fetching translations:", error);
      });
  } else {
    translationsElement.style.display = "none";
  }
}

function addWord() {
  const wordInputValue = document.getElementById("wordInput").value;
  const transcriptionValue = document.getElementById("transcription").value;
  const translationValue = document.getElementById("translation").value;
  const selectedDeckId = document.getElementById("deckSelect").value;

  // Проверяем, что поля "Слово на английском" и "Перевод" заполнены
  if (!wordInputValue.trim() || !translationValue.trim()) {
    showNotification(
      "Пожалуйста, заполните поля 'Слово на английском' и 'Перевод'"
    );
    return; // Прерываем функцию, если какое-либо из полей пустое
  }

  const wordData = {
    term: wordInputValue,
    transcription: transcriptionValue,
    translation: translationValue,
  };

  // Шаг 1: Создание слова
  fetch("/words", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(wordData),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok.");
      }
      return response.json();
    })
    .then((createdWord) => {
      // Шаг 2: Добавление слова в колоду
      return fetch(`/decks/${selectedDeckId}/words`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ wordId: createdWord._id }),
      });
    })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok.");
      }
      return response.json();
    })
    .then((updatedDeck) => {
      showNotification(
        `Word "${wordInputValue}" added to deck "${updatedDeck.name}" successfully!`
      );
      // Очистка полей ввода и скрытие переводов после добавления слова
      document.getElementById("wordInput").value = "";
      document.getElementById("transcription").value = "";
      document.getElementById("translation").value = "";
      document.getElementById("translations").style.display = "none";
      document.getElementById("translations").innerHTML = "";
    })
    .catch((error) => {
      showNotification("Error adding word to deck: " + error.message);
    });
}

function loadWord(word, context) {
  let modal, studyWord, wordInEnglish, wordTranscription, wordDefinition;
  let againButton, hardButton, goodButton, easyButton;

  // Получаем элементы для контекста "newWord" или "reviewWord"
  if (context === "newWord") {
    modal = document.getElementById("studyModal");
    studyWord = document.getElementById("studyWord");
    wordInEnglish = document.getElementById("wordInEnglish");
    wordTranscription = document.getElementById("wordTranscription");
    wordDefinition = document.getElementById("wordDefinition");

    // Получаем ссылки на новые кнопки для контекста "newWord"
    againButton = document.getElementById("againWordButton");
    hardButton = document.getElementById("hardWordButton");
    goodButton = document.getElementById("goodWordButton");
    easyButton = document.getElementById("easyWordButton");
  } else if (context === "reviewWord") {
    modal = document.getElementById("wordsToReviewModal");
    studyWord = document.getElementById("reviewStudyWord");
    wordInEnglish = document.getElementById("reviewWordInEnglish");
    wordTranscription = document.getElementById("reviewWordTranscription");
    wordDefinition = document.getElementById("reviewWordDefinition");

    // Получаем ссылки на новые кнопки для контекста "reviewWord"
    againButton = document.getElementById("againReviewWordButton");
    hardButton = document.getElementById("hardReviewWordButton");
    goodButton = document.getElementById("goodReviewWordButton");
    easyButton = document.getElementById("easyReviewWordButton");
  }

  // Обновляем содержимое модального окна
  if (studyWord) studyWord.textContent = word.translation;
  if (wordInEnglish) wordInEnglish.textContent = word.term;
  if (wordTranscription) wordTranscription.textContent = word.transcription;

  // Управляем видимостью транскрипции и английского слова
  if (wordInEnglish) wordInEnglish.style.display = "none";
  if (wordTranscription) wordTranscription.style.display = "none";

  // Меняем классы для показа/скрытия определения слова
  if (wordDefinition) {
    wordDefinition.classList.add("hidden");
    wordDefinition.classList.remove("visible");
  }

  // Показываем модальное окно
  if (modal) modal.style.display = "block";

  // Показываем кнопку "Показать определение", если это необходимо
  const showDefinitionButton =
    context === "newWord" ? "showDefinition" : "showReviewDefinition";
  const showDefinitionElem = document.getElementById(showDefinitionButton);
  if (showDefinitionElem) showDefinitionElem.style.display = "block";

  // Назначаем обработчики событий для новых кнопок
  if (againButton) {
    againButton.removeEventListener("click", handleAgainWordClick);
    againButton.addEventListener("click", handleAgainWordClick);
    againButton.dataset.wordId = word._id;
  }

  if (hardButton) {
    hardButton.removeEventListener("click", handleHardWordClick);
    hardButton.addEventListener("click", handleHardWordClick);
    hardButton.dataset.wordId = word._id;
  }

  if (goodButton) {
    goodButton.removeEventListener("click", handleGoodWordClick);
    goodButton.addEventListener("click", handleGoodWordClick);
    goodButton.dataset.wordId = word._id;
  }

  if (easyButton) {
    easyButton.removeEventListener("click", handleEasyWordClick);
    easyButton.addEventListener("click", handleEasyWordClick);
    easyButton.dataset.wordId = word._id;
  }

  // Вызываем функцию обновления UI для отображения прогнозируемых дат следующего повторения
  updateNextReviewDateDisplay(word._id);
}

function initializeProgressBar(wordCount, progressBarId) {
  const progressBar = document.getElementById(progressBarId);
  if (!progressBar) {
    console.error(`Элемент с ID '${progressBarId}' не найден.`);
    return; // Прекращаем выполнение функции, если элемент не найден
  }

  console.log("Initializing progress bar with wordCount:", wordCount);
  progressBar.innerHTML = "";

  for (let i = 0; i < wordCount; i++) {
    const progressItem = document.createElement("div");
    progressItem.classList.add("progress-item");
    progressBar.appendChild(progressItem);
  }
}

function updateProgressBar() {
  const progressBarItems = document.querySelectorAll(".progress-item");
  // Обновляем прогресс-бар, используя learnedWordsCount
  if (progressBarItems.length > learnedWordsCount) {
    progressBarItems[learnedWordsCount].classList.add("learned"); // Добавляем класс для изученного слова
  }
}

// Функция для отправки статуса слова на сервер
function updateWordStatus(wordId, qualityResponse) {
  return fetch("/update-word-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wordId, qualityResponse }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      console.log("Word updated!!!", data); // Проверьте, что data содержит ожидаемые значения
      console.log("Updated dailyWordsList from server:", data.dailyWordsList);

      // Здесь можно добавить логику для обновления UI или sessionStorage, если это необходимо
    })
    .catch((error) => {
      console.error("Error updating word status:", error);
    });
}

// Обработка открытия модального окна для новых слов
function openNewWordsModal() {
  currentContext = "newWord";
  console.log("Открытие модального окна.");
  console.log(`learnedWordsCount: ${learnedWordsCount}`);
  console.log(`wordList: `, wordList);
  console.log(`currentWordIndex: ${currentWordIndex}`);

  // Запрос к серверу для получения новых слов
  fetch("/api/new-words")
    .then((response) => response.json())
    .then((newWords) => {
      // Фильтруем слова, убедившись, что они готовы к изучению
      const now = new Date();
      wordList = newWords
        .filter((word) => new Date(word.nextReviewDate) <= now)
        .slice(0, dailyWordLimit);

      if (wordList.length > 0) {
        loadWord(wordList[0], currentContext);
      }
      currentWordIndex = 0;
      initializeProgressBar(wordList.length, "newWordsProgressBar");
    })
    .catch((error) => {
      console.error("Ошибка при получении новых слов или лимита слов:", error);
    });
}

function isNextDay() {
  const lastUpdate = sessionStorage.getItem("lastUpdate");
  const currentDate = new Date().toDateString();

  if (!lastUpdate) {
    // Если дата последнего обновления отсутствует, считаем это новым днем
    sessionStorage.setItem("lastUpdate", currentDate);
    return true;
  }

  if (new Date(lastUpdate).toDateString() === currentDate) {
    // Если текущая дата совпадает с датой последнего обновления, это не новый день
    return false;
  }

  // Если текущая дата отличается от даты последнего обновления, это новый день
  sessionStorage.setItem("lastUpdate", currentDate);
  return true;
}

function openWordsToReviewModal() {
  currentContext = "reviewWord"; // Устанавливаем контекст до выполнения запроса
  fetch("/api/words-to-review")
    .then((response) => response.json())
    .then((data) => {
      if (data.length > 0) {
        wordList = data;
        currentWordIndex = 0;
        console.log("wordList.length:", wordList.length);
        learnedWordsCount = 0; // Сброс счетчика изученных слов
        initializeProgressBar(wordList.length, "reviewWordsProgressBar"); // Инициализируем прогресс-бар для слов на повторение
        loadWord(wordList[currentWordIndex], currentContext);
      }
    })
    .catch((error) => console.error("Ошибка: ", error));
}

// Функция для оповещения сервера о том, что слово было выучено
function notifyServerWordLearned(wordId) {
  fetch("/api/user/learned-word", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wordId }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Не удалось обновить статус слова на сервере");
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        console.log(
          `Слово с ID ${wordId} было помечено как изученное на сервере.`
        );
      }
    })
    .catch((error) => {
      console.error("Ошибка при отправке данных на сервер:", error);
    });
}

let learnedWordsCount = 0; // Счетчик изученных слов

function handleAgainWordClick() {
  const wordId = this.dataset.wordId;
  updateWordStatus(wordId, 0).then(() => {
    console.log(
      "handleAgainWordClick - currentWordIndex before loadNextWord:",
      currentWordIndex
    );
    loadNextWord();
    moveToWordEnd(wordId);
  });
}

function handleHardWordClick() {
  const wordId = this.dataset.wordId;
  updateWordStatus(wordId, 1).then(() => {
    console.log(
      "handleHardWordClick - currentWordIndex before loadNextWord:",
      currentWordIndex
    );
    loadNextWord();
    moveToWordEnd(wordId);
  });
}

function handleGoodWordClick() {
  const wordId = this.dataset.wordId;
  updateWordStatus(wordId, 3).then(() => {
    console.log(
      "handleGoodWordClick - currentWordIndex before loadNextWord:",
      currentWordIndex
    );
    markWordAsLearned(wordId);
  });
}

function handleEasyWordClick() {
  const wordId = this.dataset.wordId;
  updateWordStatus(wordId, 5).then(() => {
    console.log(
      "handleEasyWordClick - currentWordIndex before loadNextWord:",
      currentWordIndex
    );
    markWordAsLearned(wordId);
  });
}

function moveToWordEnd(wordId) {
  console.log("Before moveToWordEnd - currentWordIndex:", currentWordIndex);
  const index = wordList.findIndex((word) => word._id === wordId);
  console.log("Index of word to move:", index);

  if (index !== -1) {
    const wordToMove = wordList.splice(index, 1)[0];
    wordList.push(wordToMove);

    if (index <= currentWordIndex) {
      currentWordIndex--;
    }
    if (currentWordIndex < 0) {
      currentWordIndex = 0;
    }
  }

  console.log("After moveToWordEnd - currentWordIndex:", currentWordIndex);
}

async function getWordData(wordId) {
  try {
    const response = await fetch(`/api/words/${wordId}`);
    if (!response.ok) {
      throw new Error("Error fetching word data");
    }
    const wordData = await response.json();
    console.log(`Data received for wordId ${wordId}:`, wordData); // Лог полученных данных
    return wordData;
  } catch (error) {
    console.error(`Failed to fetch word data for wordId ${wordId}:`, error);
    // Обработка ошибок
  }
}

function calculateEFactor(efactor, qualityResponse) {
  let newEFactor = efactor;
  if (qualityResponse === 0) {
    newEFactor -= 0.2;
  } else if (qualityResponse === 1) {
    newEFactor -= 0.15;
  } else {
    newEFactor += 0.1;
  }
  return Math.max(1.3, newEFactor);
}

function calculateInterval(
  previousInterval,
  efactor,
  repetitionLevel,
  qualityResponse
) {
  let calculatedInterval;

  if (repetitionLevel === 0) {
    // Интервалы для первого повторения
    switch (qualityResponse) {
      case 0: // Снова
        calculatedInterval = 1 / 1440; // Меньше минуты
        break;
      case 1: // Трудно
        calculatedInterval = 6 / 1440; // 6 минут
        break;
      case 3: // Хорошо
        calculatedInterval = 10 / 1440; // 10 минут
        break;
      case 5: // Легко
        calculatedInterval = 3; // 3 дня
        break;
      default:
        calculatedInterval = 1 / 1440; // Значение по умолчанию
        break;
    }
  } else {
    // Для последующих повторений
    switch (qualityResponse) {
      case 0: // Снова
        calculatedInterval = 0.15; // Например, повторить через 6 часов
        break;
      case 1: // Трудно
        calculatedInterval = previousInterval * 0.6; // Уменьшаем интервал меньше, чем на половину
        break;
      case 3: // Хорошо
        if (repetitionLevel === 1) {
          calculatedInterval = 1; // 1 сутки для первого повтора "Хорошо"
        } else {
          calculatedInterval =
            previousInterval * (efactor * (1 + repetitionLevel * 0.1));
        }
        break;
      case 5: // Легко
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

async function updateNextReviewDateDisplay(wordId) {
  const word = await getWordData(wordId); // Получение данных о слове

  const nextReviewDates = {
    again: simulateNextReviewDate(word, 0),
    hard: simulateNextReviewDate(word, 1),
    good: simulateNextReviewDate(word, 3),
    easy: simulateNextReviewDate(word, 5),
  };
  console.log(`Updating UI with next review dates:`, nextReviewDates); // Лог перед обновлением UI
  // Обновление интерфейса пользователя
  // Обновление интерфейса пользователя с использованием новой функции форматирования
  document.getElementById("againNextReviewDate").textContent =
    formatDateForDisplay(nextReviewDates.again);
  document.getElementById("hardNextReviewDate").textContent =
    formatDateForDisplay(nextReviewDates.hard);
  document.getElementById("goodNextReviewDate").textContent =
    formatDateForDisplay(nextReviewDates.good);
  document.getElementById("easyNextReviewDate").textContent =
    formatDateForDisplay(nextReviewDates.easy);

  document.getElementById("againReviewNextReviewDate").textContent =
    formatDateForDisplay(nextReviewDates.again);
  document.getElementById("hardReviewNextReviewDate").textContent =
    formatDateForDisplay(nextReviewDates.hard);
  document.getElementById("goodReviewNextReviewDate").textContent =
    formatDateForDisplay(nextReviewDates.good);
  document.getElementById("easyReviewNextReviewDate").textContent =
    formatDateForDisplay(nextReviewDates.easy);
}

function formatDateForDisplay(nextReviewDate) {
  const now = new Date();
  const differenceInMilliseconds = nextReviewDate - now;
  const differenceInMinutes = Math.round(
    differenceInMilliseconds / (1000 * 60)
  );
  const differenceInHours = Math.round(differenceInMinutes / 60);
  const differenceInDays = Math.round(differenceInHours / 24);

  if (differenceInDays >= 1) {
    // Если разница больше или равна одному дню, отображаем в днях
    return `${differenceInDays} д.`;
  } else if (differenceInHours >= 1) {
    // Если разница больше или равна одному часу, но меньше одного дня, отображаем в часах
    return `${differenceInHours} ч.`;
  } else {
    // Если разница меньше одного часа, отображаем в минутах
    return `${differenceInMinutes} мин.`;
  }
}

const learningSteps = [1, 10]; // Шаги в минутах

function simulateNextReviewDate(word, qualityResponse) {
  // Создаем копию слова для имитации изменений
  let simulatedWord = { ...word };

  // Рассчитываем E-Factor
  simulatedWord.efactor = calculateEFactor(
    simulatedWord.efactor,
    qualityResponse
  );
  // Обновляем reviewInterval после изменения learningStep и efactor
  simulatedWord.reviewInterval = calculateInterval(
    simulatedWord.reviewInterval,
    simulatedWord.efactor,
    simulatedWord.learningStep, // Использовать learningStep вместо repetitionLevel
    qualityResponse
  );

  // Если слово в режиме обучения и получает ответы "Хорошо" или "Легко"
  if (
    simulatedWord.inLearningMode &&
    (qualityResponse === 3 || qualityResponse === 5)
  ) {
    simulatedWord.learningStep += 1;
    if (simulatedWord.learningStep >= learningSteps.length) {
      simulatedWord.inLearningMode = false; // Выход из режима обучения
      simulatedWord.studied = true; // Слово считается изученным
      simulatedWord.repetitionLevel = 1; // Сброс уровня повторения
    }
  }

  // Обрабатываем случаи "Снова" и "Трудно", если нужно
  if (qualityResponse === 0) {
    // Для "Снова" возвращаем слово в начало процесса обучения
    simulatedWord.inLearningMode = true;
    simulatedWord.studied = false;
    simulatedWord.learningStep = 0;
    simulatedWord.repetitionLevel = 0;
  } else if (qualityResponse === 1 && simulatedWord.repetitionLevel === 0) {
    // Для "Трудно" слово возвращается в начало процесса обучения, если оно там было
    simulatedWord.inLearningMode = true;
    simulatedWord.studied = false;
  }

  // Устанавливаем следующую дату пересмотра
  let intervalInMilliseconds =
    simulatedWord.reviewInterval * 24 * 60 * 60 * 1000;
  simulatedWord.nextReviewDate = new Date(Date.now() + intervalInMilliseconds);

  console.log(
    `Simulated next review date for qualityResponse ${qualityResponse}:, simulatedWord.nextReviewDate`
  );

  return simulatedWord.nextReviewDate;
}

function markWordAsLearned(wordId) {
  wordList = wordList.filter((word) => word._id !== wordId);
  updateProgressBar(); // Обновляем прогресс-бар перед увеличением счетчика
  learnedWordsCount++; // Теперь увеличиваем счетчик изученных слов
  loadNextWord();
}

function loadNextWord() {
  if (currentWordIndex >= wordList.length - 1) {
    handleLastWord();
  } else {
    currentWordIndex++;
    loadWord(wordList[currentWordIndex], currentContext);
  }
}

function initializeUserSession() {
  localStorage.setItem("isAuthenticated", "true");

  updateDailyTasks()
    .then(() => {
      // Обновляем лимит только если элемент существует
      const dailyNewWordLimitElement =
        document.getElementById("dailyNewWordLimit");
      if (dailyNewWordLimitElement) {
        return initializeDailyNewWordLimit();
      } else {
        return Promise.resolve();
      }
    })
    .then(() => {
      updateNewWordsCount();
      const deckSelect = document.getElementById("deckSelect");
      const deckSelectImport = document.getElementById("deck-select");
      if (deckSelect) getDecks("deckSelect");
      if (deckSelectImport) getDecks("deck-select");
      loadDecks(); // Предположим, что loadDecks синхронная или не критична для порядка выполнения
    })
    .catch((error) => {
      console.error("Ошибка инициализации сессии:", error);
    });
}

// Закрытие модального окна по клику на крестик
const closeButtons = document.querySelectorAll(".close");
closeButtons.forEach((button) => {
  button.addEventListener("click", function () {
    document.getElementById("studyModal").style.display = "none";
    document.getElementById("wordsToReviewModal").style.display = "none";
  });
});

const closeBtn = document.querySelector("#newDeckModal .close");
if (closeBtn) {
  closeBtn.addEventListener("click", function () {
    document.getElementById("newDeckModal").style.display = "none";
    document.getElementById("newDeckName").value = "";
  });
}

function resetStudyModal() {
  const modalContent = document
    .getElementById("studyModal")
    .querySelector(".modal-content");
  const message = modalContent.querySelector("#endOfStudyMessage");

  // Удаление класса, который центрирует содержимое модального окна
  modalContent.classList.remove("modal-content-center");

  // Показать скрытые элементы и сбросить состояние прогресс-бара и сообщения
  modalContent
    .querySelectorAll(
      "#reviewStudyWord, .modal-footer, .modal-footer *, #progressBarContainer, #studyWord, #wordInEnglish, #wordTranscription, #showDefinition, .defenitionButtonContainer"
    )
    .forEach((element) => {
      element.style.display = "";
    });

  const progressBar = modalContent.querySelector("#newWordsProgressBar");
  if (progressBar) {
    progressBar.style.visibility = "visible";
    progressBar.innerHTML = ""; // Сброс прогресс-бара, если необходимо
  }
  if (message) {
    message.style.display = "none"; // Скрыть сообщение "На сегодня это все"
  }
  learnedWordsCount = 0;
}

window.addEventListener("click", function (event) {
  const studyModal = document.getElementById("studyModal");
  const wordsToReviewModal = document.getElementById("wordsToReviewModal");

  if (event.target === studyModal) {
    console.log("Закрытие studyModal. Состояние до сброса:");
    console.log(`learnedWordsCount: ${learnedWordsCount}`);
    console.log(`wordList: `, wordList);
    console.log(`currentWordIndex: ${currentWordIndex}`);

    studyModal.style.display = "none";
    resetStudyModal(); // Сбросить состояние модального окна

    console.log("Состояние после сброса:");
    console.log(`learnedWordsCount: ${learnedWordsCount}`);
    console.log(`wordList: `, wordList);
    console.log(`currentWordIndex: ${currentWordIndex}`);

    updateDailyTasks();
    updateNewWordsCount(); // Обновление счетчика новых слов
  } else if (event.target === wordsToReviewModal) {
    console.log("Закрытие wordsToReviewModal. Состояние до сброса:");
    console.log(`learnedWordsCount: ${learnedWordsCount}`);
    console.log(`wordList: `, wordList);
    console.log(`currentWordIndex: ${currentWordIndex}`);

    wordsToReviewModal.style.display = "none";
    // resetWordsToReviewModal(); // Восстановление исходного состояния модального окна для повторения слов

    console.log("Состояние после сброса:");
    console.log(`learnedWordsCount: ${learnedWordsCount}`);
    console.log(`wordList: `, wordList);
    console.log(`currentWordIndex: ${currentWordIndex}`);

    updateDailyTasks();
    updateNewWordsCount(); // Обновление счетчиков для повторения слов
  }
});

window.addEventListener("click", function (event) {
  const modal = document.getElementById("newDeckModal");
  if (event.target === modal) {
    modal.style.display = "none";
  }
});

function toggleInputFields(enabled) {
  document.getElementById("wordInput").disabled = !enabled;
  document.getElementById("transcription").disabled = !enabled;
  document.getElementById("translation").disabled = !enabled;
  document.getElementById("addWordButton").disabled = !enabled;
}

function onWordInputChange(container) {
  const id = container.getAttribute("data-id");
  const termElement = container.querySelector(".term");
  const transcriptionElement = container.querySelector(".transcription");
  const translationElement = container.querySelector(".translation");

  // Логирование для отладки
  console.log("Изменение слова с ID:", id);

  wordChanges[id] = {
    id: id,
    term: termElement.textContent,
    transcription: transcriptionElement.textContent,
    translation: translationElement.textContent,
  };
  // Логирование текущего состояния объекта wordChanges
  console.log("Текущее состояние wordChanges:", wordChanges);
  console.log("Изменение слова с ID:", id);
  console.log(wordChanges[id]);
}
const confirmDeleteButton = document.getElementById("confirmDelete");

if (confirmDeleteButton) {
  confirmDeleteButton.addEventListener("click", async (event) => {
    // Получаем ID колоды из URL
    const urlParams = new URLSearchParams(window.location.search);
    const deckId = urlParams.get("deckId");

    if (deckId) {
      try {
        const response = await fetch("/delete-deck", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deckId: deckId }),
        });

        const result = await response.json();
        if (result.success) {
          // Удаление прошло успешно
          deleteConfirmationModal.style.display = "none"; // Сначала закрываем модальное окно

          // Отображаем уведомление
          showNotification("Колода успешно удалена.");

          // Задержка перед переадресацией
          setTimeout(() => {
            window.location.href = "/main.html";
          }, 2000); // Задержка в 3 секунды
        } else {
          // Сервер вернул ошибку
          showNotification("Ошибка при удалении колоды: " + result.message);
        }
      } catch (error) {
        // Обработка ошибок сети/запроса
        showNotification("Ошибка сети: " + error.message);
      }
    } else {
      showNotification("ID колоды не найден.");
    }
  });
}

document.addEventListener("DOMContentLoaded", (event) => {
  const wordInput = document.getElementById("wordInput");
  if (wordInput) {
    wordInput.disabled = true;
  }

  const transcription = document.getElementById("transcription");
  if (transcription) {
    transcription.disabled = true;
  }

  const translation = document.getElementById("translation");
  if (translation) {
    translation.disabled = true;
  }

  const addWordButton = document.getElementById("addWordButton");
  if (addWordButton) {
    addWordButton.disabled = true;
  }

  const deckSelectElement = document.getElementById("deckSelect");
  if (deckSelectElement) {
    const selectedDeckId = localStorage.getItem("selectedDeckId");
    if (
      selectedDeckId &&
      Array.from(deckSelectElement.options).some(
        (option) => option.value === selectedDeckId
      )
    ) {
      deckSelectElement.value = selectedDeckId;
      toggleInputFields(true); // Активируем поля
    } else {
      localStorage.removeItem("selectedDeckId"); // Удаляем невалидное значение из localStorage
      toggleInputFields(false); // Деактивируем поля
    }
  }

  const saveSubmitButton = document.getElementById("saveSubmitButton");
  const deckNameTitle = document.getElementById("deckNameTitle");
  const editableFields = document.querySelectorAll(
    ".term, .transcription, .translation"
  );
  let isEdited = false;

  // Функция для переключения режима редактирования
  function toggleEditMode() {
    // Переключаем состояние редактирования для заголовка колоды
    deckNameTitle.contentEditable = !(deckNameTitle.contentEditable === "true");

    // Переключаем состояние редактирования для всех полей
    const fields = document.querySelectorAll(
      ".term, .transcription, .translation"
    );
    fields.forEach((field) => {
      const isEditable = field.contentEditable === "true";
      field.contentEditable = !isEditable;
    });

    // Переключаем видимость кнопки "Сохранить и отправить"
    saveSubmitButton.classList.toggle("hidden");
    isEdited = !isEdited; // Переключаем флаг редактирования

    // Переключение видимости кнопок удаления
    const deleteButtons = document.querySelectorAll(".delete-btn");
    deleteButtons.forEach((button) => {
      button.style.display = isEdited ? "block" : "none";
    });

    isEdited = !isEdited; // Переключаем флаг редактирования
  }

  // Событие нажатия на кнопку Редактировать
  const editButton = document.getElementById("editButton");
  if (editButton) {
    editButton.addEventListener("click", function () {
      console.log("Кнопка 'Редактировать' нажата");
      toggleEditMode();
      isEdited = true; // Отметить, что были внесены изменения
    });
  }

  // Событие нажатия на кнопку Сохранить и отправить
  if (saveSubmitButton && deckNameTitle && editableFields.length > 0) {
    saveSubmitButton.addEventListener("click", function () {
      // Фильтруем и отправляем только измененные слова
      const updatedWords = Object.values(wordChanges);

      // Логирование отправляемых данных
      console.log("Отправка на сервер следующих слов:", updatedWords);

      // Получение deckId из URL или другого источника
      const urlParams = new URLSearchParams(window.location.search);
      const deckId = urlParams.get("deckId");

      if (!deckId) {
        console.error("Deck ID is not found.");
        return;
      }

      // Отправка данных на сервер
      fetch(`/update-deck/${deckId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deckName: deckNameTitle.textContent,
          words: updatedWords,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok.");
          }
          return response.json();
        })
        .then((data) => {
          console.log("Success:", data);
          // Сбросить объект с изменениями после успешной отправки
          wordChanges = {}; // <-- Обнуление объекта wordChanges происходит здесь
          toggleEditMode(); // Выйти из режима редактирования
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    });
  }
  const wordContainers = document.querySelectorAll(".words-container");
  wordContainers.forEach((container) => {
    ["term", "transcription", "translation"].forEach((className) => {
      const element = container.querySelector(`.${className}`);
      element.addEventListener("input", () => {
        console.log(`Изменение в классе ${className}`);
        onWordInputChange(container);
      });
    });
  });
  // Получаем элементы
  const deleteDeckButton = document.querySelector("#deleteDeckButton");
  const deleteConfirmationModal = document.getElementById(
    "deleteConfirmationModal"
  );
  const deckNameToDelete = document.getElementById("deckNameToDelete");
  const cancelDeleteButton = document.getElementById("cancelDelete");
  const confirmDeleteButton = document.getElementById("confirmDelete");

  // Убедитесь, что все элементы существуют, прежде чем добавлять обработчики событий
  if (
    deleteDeckButton &&
    deleteConfirmationModal &&
    deckNameToDelete &&
    cancelDeleteButton &&
    confirmDeleteButton &&
    deckNameTitle
  ) {
    deleteDeckButton.addEventListener("click", (event) => {
      event.stopPropagation(); // Предотвращение всплытия события
      // if (confirm("Вы уверены, что хотите удалить эту колоду?")) {
      //   console.log("Колода будет удалена");
      // }
    });

    // Настройка и показ модального окна при клике на кнопку удаления
    deleteDeckButton.addEventListener("click", (event) => {
      deckNameToDelete.textContent = deckNameTitle.textContent;
      deleteConfirmationModal.style.display = "flex";
    });

    // Закрытие модального окна без удаления
    cancelDeleteButton.addEventListener("click", (event) => {
      deleteConfirmationModal.style.display = "none";
    });

    // Подтверждение удаления и закрытие модального окна
    confirmDeleteButton.addEventListener("click", (event) => {
      console.log(`Колода "${deckNameTitle.textContent}" будет удалена`);
      deleteConfirmationModal.style.display = "none";
    });
  }

  // Обработчик для формы регистрации
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const email = this.email.value;
      const password = this.password.value;
      registerUser(email, password);
    });
  }

  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      fetch("/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Тело запроса не требуется, так как мы просто уничтожаем сессию на сервере
      })
        .then((response) => {
          if (response.ok) {
            // Очищаем localStorage после успешного выхода
            localStorage.removeItem("isAuthenticated");
            // Успешный выход, перенаправляем на страницу входа
            window.location.href = "/login.html";
          } else {
            throw new Error("Logout failed");
          }
        })
        .catch((error) => {
          console.error("There was an error logging out:", error);
        });
    });
  }

  if (localStorage.getItem("isAuthenticated") === "true") {
    // Проверяем, находимся ли мы на главной странице
    if (
      window.location.pathname === "/" ||
      window.location.pathname === "/main.html"
    ) {
      // Вызываем функции, которые должны работать на главной странице для авторизованного пользователя
      updateNewWordsCount();
      updateDailyTasks();
      getDecks("deckSelect");
      getDecks("deck-select");
      loadDecks();
    }
  }
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const email = this.email.value;
      const password = this.password.value;
      const rememberMe = this.rememberMe.checked;

      loginUser(email, password, rememberMe);
    });
  }
  const importButton = document.getElementById("import-button");
  if (importButton) {
    importButton.addEventListener("click", function () {
      console.log("Import button clicked"); // Для дебага
      const selectedDeckId = document.getElementById("deck-select").value;
      if (selectedDeckId && parsedWords.length) {
        importWords(selectedDeckId, parsedWords);
      } else {
        alert("Выберите колоду и/или загрузите файл для импорта");
      }
    });
  }

  const dropArea = document.getElementById("drop-area");

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight(e) {
    dropArea.classList.add("highlight");
  }

  function unhighlight(e) {
    dropArea.classList.remove("highlight");
  }

  function handleDrop(e) {
    preventDefaults(e);
    unhighlight(e);

    let dt = e.dataTransfer;
    let files = dt.files;

    handleFiles(files); // Обработка файлов для отображения
    updateFileName(null, files[0]); // Обновление имени файла для отображения
    displayPreviewContainer(); // Показываем контейнер для предпросмотра
  }

  if (dropArea) {
    // Добавление слушателей событий для области drop
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(eventName, preventDefaults, false);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropArea.addEventListener(eventName, highlight, false);
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(eventName, unhighlight, false);
    });

    dropArea.addEventListener("drop", handleDrop, false);
  }

  // initializeUserSession();
});

const deckSelectElement = document.getElementById("deckSelect");
if (deckSelectElement) {
  deckSelectElement.addEventListener("change", (event) => {
    const hasDecks = event.target.value; // Получаем значение выбранного option
    const isDisabled = !hasDecks;
    // Включаем или отключаем поля ввода
    const wordInput = document.getElementById("wordInput");
    if (wordInput) {
      wordInput.disabled = isDisabled;
    }

    const transcription = document.getElementById("transcription");
    if (transcription) {
      transcription.disabled = isDisabled;
    }

    const translation = document.getElementById("translation");
    if (translation) {
      translation.disabled = isDisabled;
    }

    // Если у вас есть кнопка добавления слова, ее тоже можно включить или отключить
    const addWordButton = document.getElementById("addWordButton");
    if (addWordButton) {
      addWordButton.disabled = isDisabled;
    }

    // Сохраняем выбранную колоду в localStorage
    saveSelectedDeck();
  });
}

// Corrected showDefinition function
function showDefinition() {
  let wordToFetch;

  if (currentContext === "newWord") {
    wordToFetch = document.getElementById("studyWord").textContent;
  } else if (currentContext === "reviewWord") {
    wordToFetch = document.getElementById("reviewStudyWord").textContent;
  }

  if (wordToFetch) {
    fetch(`/get-word-definition?word=${encodeURIComponent(wordToFetch)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        // Обновляем элементы UI в зависимости от контекста
        if (currentContext === "newWord") {
          document.getElementById("wordInEnglish").textContent = data.term;
          document.getElementById("wordTranscription").textContent =
            data.transcription;
          document.getElementById("wordDefinition").style.visibility =
            "visible";
          document.getElementById("wordDefinition").style.height = "90px";
        } else if (currentContext === "reviewWord") {
          document.getElementById("reviewWordInEnglish").textContent =
            data.term;
          document.getElementById("reviewWordTranscription").textContent =
            data.transcription;
          document.getElementById("reviewWordDefinition").style.visibility =
            "visible";
          document.getElementById("reviewWordDefinition").style.height = "90px";
        }
      })
      .catch((error) => {
        console.error("Error fetching word definition:", error);
      });
    // Обновляем отображение элементов в зависимости от контекста
    if (currentContext === "newWord") {
      document.getElementById("wordInEnglish").style.display = "block";
      document.getElementById("wordTranscription").style.display = "block";
      document.getElementById("showDefinition").style.display = "none";
    } else if (currentContext === "reviewWord") {
      document.getElementById("reviewWordInEnglish").style.display = "block";
      document.getElementById("reviewWordTranscription").style.display =
        "block";
      // document.getElementById("reviewWordDefinition").style.display = "none";
    }
  }
}

function handleLastWord() {
  if (wordList.length === 0) {
    // Определение модального окна в зависимости от текущего контекста
    let modalContent;
    if (currentContext === "newWord") {
      modalContent = document
        .getElementById("studyModal")
        .getElementsByClassName("modal-content")[0];
    } else if (currentContext === "reviewWord") {
      modalContent = document
        .getElementById("wordsToReviewModal")
        .getElementsByClassName("modal-content")[0];
    }

    // Скрываем все элементы управления и контейнеры внутри модального окна
    let elementsToHide = modalContent.querySelectorAll(
      "#reviewStudyWord,.modal-footer, #progressBarContainer, #studyWord, #wordInEnglish, #wordTranscription, #showDefinition, .defenitionButtonContainer"
    );
    elementsToHide.forEach(function (element) {
      element.style.display = "none";
    });

    // Добавляем класс для центрирования содержимого модального окна
    modalContent.classList.add("modal-content-center");

    // Проверяем, существует ли уже сообщение о завершении изучения
    let endOfStudyMessage = modalContent.querySelector("#endOfStudyMessage");
    if (!endOfStudyMessage) {
      endOfStudyMessage = document.createElement("p");
      endOfStudyMessage.id = "endOfStudyMessage";
      endOfStudyMessage.textContent =
        "На сегодня это все, вы хорошо позанимались!!!";
      endOfStudyMessage.style.textAlign = "center";
      endOfStudyMessage.style.marginTop = "0"; // Убираем верхний отступ
      endOfStudyMessage.style.fontSize = "20px";
      endOfStudyMessage.style.width = "100%"; // Если нужно, чтобы занимал всю ширину
      modalContent.appendChild(endOfStudyMessage);
    }
    endOfStudyMessage.style.display = "block"; // Показываем сообщение
  } else {
    // Если в списке остались слова, продолжаем изучение
    currentWordIndex = (currentWordIndex + 1) % wordList.length;
    loadWord(wordList[currentWordIndex], currentContext);
  }
}

// Добавление прослушивателя для кнопки "Показать определение"
const showDefinitionButton = document.getElementById("showDefinition");
if (showDefinitionButton) {
  showDefinitionButton.addEventListener("click", function () {
    const wordDefinition = document.getElementById("wordDefinition");
    if (wordDefinition.classList.contains("hidden")) {
      wordDefinition.classList.remove("hidden");
      wordDefinition.classList.add("visible");
    } else {
      wordDefinition.classList.add("hidden");
      wordDefinition.classList.remove("visible");
    }
    this.style.display = "none"; // Скрываем кнопку "Показать определение"
  });
}

const showReviewDefinitionButton = document.getElementById(
  "showReviewDefinition"
);
if (showReviewDefinitionButton) {
  showReviewDefinitionButton.addEventListener("click", function () {
    const reviewWordDefinition = document.getElementById(
      "reviewWordDefinition"
    );
    if (reviewWordDefinition.classList.contains("hidden")) {
      reviewWordDefinition.classList.remove("hidden");
      reviewWordDefinition.classList.add("visible");
    } else {
      reviewWordDefinition.classList.add("hidden");
      reviewWordDefinition.classList.remove("visible");
    }
    this.style.display = "none"; // Скрываем кнопку "Показать определение" в модальном окне повторения
  });
}

const createDeckButton = document.getElementById("createDeckButton");
if (createDeckButton) {
  createDeckButton.addEventListener("click", function () {
    const newDeckModal = document.getElementById("newDeckModal");
    if (newDeckModal) {
      newDeckModal.style.display = "block";
    }
  });
}

const closeModalButton = document.querySelector(".modal .close");
if (closeModalButton) {
  closeModalButton.addEventListener("click", function () {
    // Закрытие модального окна
    const modal = this.parentElement.parentElement;
    modal.style.display = "none";

    // Проверяем, является ли это модальное окно тем, где отображаются новые слова
    if (modal.id === "studyModal") {
      // Замените 'idOfNewWordsModal' на ID вашего модального окна с новыми словами
      // Вызов функции обновления списка слов
      closeModalAndUpdateWords();
    }

    // Обновление UI счетчика новых слов и ежедневных задач
    updateNewWordsCount();
    // updateDailyTasks();
  });
}

// Функция для обновления списка слов после закрытия модального окна
function closeModalAndUpdateWords() {
  fetch("/api/new-words")
    .then((response) => response.json())
    .then((updatedWordList) => {
      // Обновляем sessionStorage и UI
      sessionStorage.setItem("wordList", JSON.stringify(updatedWordList));
    })
    .catch((error) => {
      console.error("Ошибка при получении обновленного списка слов: ", error);
    });
}

function toggleDefinitionVisibility() {
  const wordDefinition = document.getElementById("wordDefinition");
  const reviewWordDefinition = document.getElementById("reviewWordDefinition");
  const showDefinitionBtn = document.getElementById("showDefinition");
  const showReviewDefinitionBtn = document.getElementById(
    "showReviewDefinition"
  );

  // Логика для wordDefinition
  if (wordDefinition.classList.contains("hidden-content")) {
    wordDefinition.classList.remove("hidden-content");
    wordDefinition.classList.add("visible-content");
    showDefinitionBtn.style.display = "none"; // Скрываем кнопку
  } else {
    wordDefinition.classList.add("hidden-content");
    wordDefinition.classList.remove("visible-content");
    showDefinitionBtn.style.display = "block"; // Показываем кнопку
  }

  // Логика для reviewWordDefinition
  if (
    reviewWordDefinition &&
    reviewWordDefinition.classList.contains("hidden-content")
  ) {
    reviewWordDefinition.classList.remove("hidden-content");
    reviewWordDefinition.classList.add("visible-content");
    showReviewDefinitionBtn.style.display = "none"; // Скрываем кнопку
  } else if (reviewWordDefinition) {
    reviewWordDefinition.classList.add("hidden-content");
    reviewWordDefinition.classList.remove("visible-content");
    showReviewDefinitionBtn.style.display = "block"; // Показываем кнопку
  }
}

// Добавление новой колоды
function createDeck(deckName) {
  fetch("/decks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: deckName }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Deck created:", data);
      getDecks("deckSelect"); // Обновление списка колод
      getDecks("deck-select");
      loadDecks();
      document.getElementById("newDeckModal").style.display = "none"; // Закрытие модального окна
      document.getElementById("newDeckName").value = ""; // Очистка поля ввода названия колоды
    })
    .catch((error) => {
      console.error("Error creating deck:", error);
    });
}

const newDeckForm = document.getElementById("newDeckForm");
if (newDeckForm) {
  newDeckForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const deckNameInput = document.getElementById("newDeckName");
    if (deckNameInput) {
      const deckName = deckNameInput.value;
      createDeck(deckName);

      // Очистка поля ввода названия колоды после отправки
      deckNameInput.value = "";
    }
  });
}

// Получение списка колод
function getDecks(selectId) {
  return fetch("/decks") // Возвращаем промис из fetch
    .then((response) => response.json())
    .then((data) => {
      const deckSelect = document.getElementById(selectId);
      if (deckSelect) {
        deckSelect.innerHTML = '<option value="">Выберите колоду</option>';
        data.forEach((deck) => {
          const option = document.createElement("option");
          option.value = deck._id;
          option.textContent = deck.name;
          deckSelect.appendChild(option);
        });
      }
    })
    .catch((error) => {
      console.error("Ошибка при получении колод:", error);
      throw error; // Передача ошибки дальше по цепочке промисов
    });
}

// Добавление слова в колоду
function addWordToDeck(wordId, deckId) {
  fetch(`/decks/${deckId}/words`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wordId }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Word added to deck:", data);
    })
    .catch((error) => {
      console.error("Error adding word to deck:", error);
    });
}

// Функция для загрузки и отображения колод
function loadDecks() {
  console.log("Загрузка колод...");
  // Проверяем, существует ли элемент на странице
  const container = document.getElementById("decksContainer");
  if (container) {
    // Получаем данные о последних обновлениях
    fetch("/decks/last-updated")
      .then((response) => response.json())
      .then((lastUpdates) => {
        // Получаем группированные данные о колодах
        fetch("/decks/grouped")
          .then((response) => response.json())
          .then((groups) => {
            if (!Array.isArray(groups)) {
              throw new Error("Received data is not an array");
            }
            container.innerHTML = ""; // Очищаем контейнер перед отображением новых данных

            // Объединяем данные о колодах с информацией о последних обновлениях
            groups.forEach((group) => {
              group.decks.forEach((deck) => {
                // Находим информацию о последнем обновлении для данной колоды
                const lastUpdateInfo = lastUpdates.find(
                  (update) => update.deckId === deck._id
                );
                const lastUpdateMonth = lastUpdateInfo
                  ? formatMonthYear(lastUpdateInfo.lastUpdate)
                  : "Дата неизвестна";

                // Находим или создаем группу для этого месяца обновления
                let monthGroup = container.querySelector(
                  `.deck-group[data-month="${lastUpdateMonth}"]`
                );
                if (!monthGroup) {
                  monthGroup = document.createElement("div");
                  monthGroup.className = "deck-group";
                  monthGroup.setAttribute("data-month", lastUpdateMonth);
                  const monthTitle = document.createElement("h3");
                  monthTitle.textContent = lastUpdateMonth;
                  monthGroup.appendChild(monthTitle);
                  container.appendChild(monthGroup);
                }

                // Создаем элемент колоды
                const deckDiv = document.createElement("div");
                deckDiv.className = "deck";

                const termsCountSpan = document.createElement("span");
                termsCountSpan.className = "deck-terms-count";
                termsCountSpan.textContent = `${
                  deck.termCount || "0"
                } терминов`;

                const titleSpan = document.createElement("span");
                titleSpan.className = "deck-title";
                titleSpan.textContent = deck.name;

                deckDiv.appendChild(termsCountSpan);
                deckDiv.appendChild(titleSpan);
                monthGroup.appendChild(deckDiv); // Добавляем колоду в соответствующую группу

                deckDiv.addEventListener("click", () => {
                  window.location.href = `deck.html?deckId=${deck._id}`;
                });
              });
            });
          })
          .catch((error) => {
            console.error("Error loading decks:", error);
          });
      })
      .catch((error) => {
        console.error("Error loading last updates:", error);
      });
  }

  // Загрузка выбранной колоды из localStorage
  const selectedDeckId = localStorage.getItem("selectedDeckId");
  if (selectedDeckId) {
    const deckSelectElement = document.getElementById("deckSelect");
    if (deckSelectElement) {
      deckSelectElement.value = selectedDeckId;

      // Также обновляем доступность полей ввода
      document.getElementById("wordInput").disabled = false;
      document.getElementById("transcription").disabled = false;
      document.getElementById("translation").disabled = false;
      document.getElementById("addWordButton").disabled = false;
    }
  }
}

function createDeckElement(deck) {
  const deckDiv = document.createElement("div");
  deckDiv.className = "deck";

  const termsCountSpan = document.createElement("span");
  termsCountSpan.className = "deck-terms-count";
  termsCountSpan.textContent = `${deck.termCount || "0"} терминов`;

  const titleSpan = document.createElement("span");
  titleSpan.className = "deck-title";
  titleSpan.textContent = deck.name;

  deckDiv.appendChild(termsCountSpan);
  deckDiv.appendChild(titleSpan);

  deckDiv.addEventListener("click", () => {
    window.location.href = `deck.html?deckId=${deck._id}`;
  });

  return deckDiv;
}

function formatMonthYear(date) {
  const currentDate = new Date();
  const dateToFormat = new Date(date);

  // Проверяем, является ли дата обновления текущим месяцем
  if (
    currentDate.getFullYear() === dateToFormat.getFullYear() &&
    currentDate.getMonth() === dateToFormat.getMonth()
  ) {
    return "В этом месяце";
  } else {
    return dateToFormat.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
    });
  }
}

// Функция для поиска колод
function searchDecks() {
  const query = document.getElementById("searchInput").value;

  // Если строка поиска пуста, загружаем исходный список колод
  if (query.trim() === "") {
    loadDecks();
    return;
  }

  // Если строка поиска не пуста, выполняем поиск
  fetch(`/decks/search?q=${encodeURIComponent(query)}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          "Server responded with an error: " + response.statusText
        );
      }
      return response.json();
    })
    .then((decks) => {
      // Проверяем, является ли ответ массивом
      if (!Array.isArray(decks)) {
        throw new Error("Error: Expected an array of decks, but got:", decks);
      }

      const container = document.getElementById("decksContainer");
      container.innerHTML = ""; // Очищаем контейнер перед отображением результатов поиска

      decks.forEach((deck) => {
        const deckDiv = document.createElement("div");
        deckDiv.className = "deck";
        deckDiv.innerHTML = `
          <span class="deck-terms-count">${
            deck.termCount || "0"
          } терминов</span>
          <span class="deck-title">${deck.name}</span>
        `;
        // Добавляем обработчик событий на клик, если это необходимо
        deckDiv.addEventListener("click", () => {
          // Действие при клике на колоду, например:
          window.location.href = `/deck/${deck._id}`;
        });
        container.appendChild(deckDiv);
      });
    })
    .catch((error) => {
      console.error("Error searching decks:", error);
      // Здесь вы можете обновить UI, чтобы сообщить пользователю об ошибке
    });
}

// Функция для сохранения выбранной колоды в localStorage
function saveSelectedDeck() {
  const selectedDeckId = document.getElementById("deckSelect").value;
  localStorage.setItem("selectedDeckId", selectedDeckId);
}

function openDeckPage(deckId) {
  window.location.href = `deck.html?deckId=${deckId}`;
}

// Функция для добавления слушателей событий
function addInputListeners(container) {
  // Добавляем обработчик события на каждое поле ввода в контейнере
  ["term", "transcription", "translation"].forEach((className) => {
    const element = container.querySelector(`.${className}`);
    element.addEventListener("input", () => onWordInputChange(container));
  });
}

function loadDeckWords() {
  const urlParams = new URLSearchParams(window.location.search);
  const deckId = urlParams.get("deckId");
  if (deckId) {
    fetch(`/decks/${deckId}/words`)
      .then((response) => response.json())
      .then((data) => {
        document.getElementById("deckNameTitle").textContent = data.deckName;
        const wordsList = document.getElementById("deckWordsList");
        wordsList.innerHTML = ""; // Очищаем список, если там были предыдущие слова

        data.words.forEach((word) => {
          // Создание контейнера для слова
          const wordContainer = document.createElement("div");
          wordContainer.className = "words-container";
          wordContainer.setAttribute("data-id", word._id);

          const termElement = document.createElement("div");
          termElement.className = "term";
          termElement.textContent = word.term;

          const transcriptionElement = document.createElement("div");
          transcriptionElement.className = "transcription";
          transcriptionElement.textContent = word.transcription;

          const translationElement = document.createElement("div");
          translationElement.className = "translation";
          translationElement.textContent = word.translation;
          const deleteBtn = document.createElement("button");
          deleteBtn.classList.add("delete-btn");
          deleteBtn.innerHTML = '<i class="fa-solid fa-minus"></i>'; // Иконка крестика FontAwesome

          deleteBtn.style.display = "none"; // изначально скрыта
          deleteBtn.onclick = function () {
            // Измените этот вызов, чтобы передать идентификатор слова
            const wordId = wordContainer.getAttribute("data-id");
            confirmDeletion(wordId, wordContainer);
          };

          wordContainer.appendChild(deleteBtn);

          wordContainer.appendChild(termElement);
          wordContainer.appendChild(transcriptionElement);
          wordContainer.appendChild(translationElement);

          wordsList.appendChild(wordContainer);

          addInputListeners(wordContainer);
        });
      })
      .catch((error) => {
        console.error("Ошибка при получении слов из колоды: ", error);
      });
  }
}

// Функция для показа кнопки удаления
function showDeleteButtons() {
  const deleteButtons = document.querySelectorAll(".delete-btn");
  deleteButtons.forEach((button) => {
    button.style.display = "inline-block";
    button.addEventListener("click", function (event) {
      const wordContainer = event.target.closest(".words-container");
      const wordId = wordContainer.dataset.id; // Используйте dataset.id для получения идентификатора слова
      confirmDeletion(wordId, wordContainer);
    });
  });
}

// Функция для подтверждения удаления
function confirmDeletion(wordId, wordContainer) {
  if (confirm(`Вы действительно хотите удалить это слово?`)) {
    deleteWord(wordId, wordContainer);
  }
}

async function deleteWord(wordId, wordContainer) {
  try {
    const response = await fetch("/delete-word", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ wordId: wordId }), // Убедитесь, что здесь передается идентификатор слова
    });
    const data = await response.json();
    if (data.success) {
      wordContainer.remove(); // Удалите элемент из DOM, если запрос успешен
    } else {
      alert("Ошибка при удалении слова: " + data.message);
    }
  } catch (error) {
    console.error("Ошибка при запросе на сервер:", error);
  }
}

function onWordInputChange(container) {
  // Получаем ID, term, transcription и translation из контейнера
  const id = container.getAttribute("data-id");
  const term = container.querySelector(".term").textContent;
  const transcription = container.querySelector(".transcription").textContent;
  const translation = container.querySelector(".translation").textContent;

  // Обновляем объект wordChanges для этого конкретного слова
  wordChanges[id] = { id, term, transcription, translation };
}

function registerUser(email, password) {
  // Отправляем запрос на маршрут регистрации
  fetch("/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Регистрация прошла успешно, инициализация сессии пользователя
        initializeUserSession();

        // Переадресация на страницу входа или другую страницу, где пользователь сможет войти
        window.location.href = "/main.html";
      } else {
        // Обработка ошибок регистрации
        showNotification(data.message);
      }
    })
    .catch((error) => {
      // Обработка сетевых ошибок
      showNotification("Ошибка сети: " + error.message);
    });
}

function loginUser(email, password, rememberMe) {
  // Отправляем запрос на маршрут входа
  fetch("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, rememberMe }),
  })
    .then((response) => {
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Неверный логин или пароль. Пожалуйста, попробуйте снова."
          );
        } else {
          throw new Error("Произошла ошибка на сервере. Попробуйте позже.");
        }
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        // Вход прошел успешно, инициализация сессии пользователя
        initializeUserSession();

        // Переадресация на главную страницу
        window.location.href = "/main.html";
      } else {
        // Обработка ошибок входа
        showNotification(data.message);
      }
    })
    .catch((error) => {
      // Обработка сетевых ошибок
      showNotification("Ошибка сети: " + error.message);
    });
}

// Эта функция вызывается, когда файл выбран
function handleFiles(event) {
  const files = event.target.files;
  if (files.length) {
    const file = files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      const contents = e.target.result;
      parsedWords = parseCSV(contents); // Парсинг CSV и сохранение в parsedWords
      displayPreview(parsedWords); // Отображение предпросмотра данных
    };
    reader.readAsText(file);
  }
}

function parseCSV(contents) {
  // Парсинг CSV файла
  const lines = contents.split("\n").slice(1); // Убираем первую строку с заголовками
  const words = lines.map((line) => {
    // Разбиваем строку с учетом кавычек и запятых внутри полей
    const parts = line
      .match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
      .map((part) =>
        part.startsWith('"') && part.endsWith('"') ? part.slice(1, -1) : part
      );
    return {
      term: parts[0],
      transcription: parts[1] || "", // Если есть транскрипция, то берем её, иначе пустая строка
      translation: parts[2] || parts[1], // Перевод берем из последней части
    };
  });
  return words; // Возвращаем массив слов
}

function displayPreview(words) {
  const previewTable = document.getElementById("preview-table");

  // Очищаем таблицу и создаем заголовки
  previewTable.innerHTML = `
    <tr>
      <th>Term</th>
      <th>Transcription</th>
      <th>Translation</th>
    </tr>`;

  // Добавляем строки для каждого слова
  words.forEach((word) => {
    const row = document.createElement("tr");

    const termCell = document.createElement("td");
    termCell.textContent = word.term;

    const transcriptionCell = document.createElement("td");
    transcriptionCell.textContent = word.transcription;

    const translationCell = document.createElement("td");
    translationCell.textContent = word.translation;

    row.appendChild(termCell);
    row.appendChild(transcriptionCell);
    row.appendChild(translationCell);

    previewTable.appendChild(row);
  });
}

function importWords(deckId, words) {
  fetch("/import-words", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ deckId, words }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        showNotification("Слова успешно добавлены в колоду.");
        loadDecks(); // Обновляем колоды после успешного импорта
      } else {
        showNotification("Произошла ошибка: " + data.message);
      }
    })
    .catch((error) => {
      console.error("Ошибка при импорте слов:", error);
      showNotification("Ошибка при импорте слов: " + error.message);
    });
}

const dropArea = document.getElementById("drop-area");

if (dropArea) {
  dropArea.addEventListener("dragover", (event) => {
    event.preventDefault(); // Это событие необходимо для того, чтобы разрешить drop
  });

  dropArea.addEventListener("drop", (event) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    handleFiles(files);
  });
}

// Нет необходимости в else блоке, если вы не хотите логировать отсутствие элемента.

// Функция для обновления названия файла
function updateFileName(event, file = null) {
  let fileName;
  const fileLabelSpan = document.getElementById("file-name");

  // Проверяем, вызвана ли функция из события 'change' или 'drop'
  if (file) {
    // Если вызвана из 'drop'
    fileName = file.name;
  } else if (event && event.target.files.length > 0) {
    // Если вызвана из 'change'
    fileName = event.target.files[0].name;
  } else {
    fileLabelSpan.textContent = "Выберите файл"; // Если файл не выбран
    return;
  }

  fileLabelSpan.textContent = fileName; // Обновляем имя файла
}

// document.getElementById("fileElem").addEventListener("change", handleFiles);

// Эта функция будет вызвана когда пользователь выбирает файл через input или перетаскиванием
function handleFiles(files) {
  const file = files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const contents = e.target.result;
      parsedWords = parseCSV(contents); // Парсинг CSV и сохранение в parsedWords
      displayPreview(parsedWords); // Отображение предпросмотра данных
      displayPreviewContainer();
      // Показываем кнопку "Импортировать" и выпадающий список
      document.getElementById("import-button").style.display = "block";
      document.getElementById("deck-select").style.display = "block";
    };
    reader.readAsText(file);
  }
}

//уточнение, нужно ли
function handleFileUpload(file) {
  const formData = new FormData();
  formData.append("file", file); // Добавляем файл
  formData.append("deckId", selectedDeckId); // Добавляем ID колоды

  fetch("/upload-csv", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      // Обработка ответа от сервера

      // Показываем кнопку "Импортировать" и выпадающий список, если файл успешно обработан
      document.getElementById("import-button").style.display = "block";
      document.getElementById("deck-select").style.display = "block";
    })
    .catch((error) => {
      console.error("Ошибка при отправке файла:", error);
    });
  loadDecks();
}

document.addEventListener("DOMContentLoaded", function () {
  // if (!checkAuthentication()) {
  //   return; // Если пользователь не аутентифицирован, дальнейший код не должен выполняться
  // }
  // Вызов функции инициализации пользовательской сессии
  // initializeUserSession();
  initializeDailyNewWordLimit();

  const fileElem = document.getElementById("fileElem");

  if (fileElem) {
    // Отслеживание изменений в input type="file"
    fileElem.addEventListener("change", function (event) {
      handleFiles(event.target.files); // Обработка файлов для отображения
      updateFileName(event); // Обновление имени файла для отображения
    });
  }
});

// Функция, которая отображает preview контейнер и обновляет подсказку
function displayPreviewContainer() {
  const previewContainer = document.getElementById("preview-container");
  const dropArea = document.getElementById("drop-area");
  previewContainer.style.display = "block"; // Показываем контейнер
  dropArea.querySelector("p").textContent =
    "Файл загружен. Проверьте предпросмотр перед импортом."; // Обновляем подсказку
}

// Функция для открытия модального окна изменения лимита
function openEditLimitModal(event) {
  event.stopPropagation(); // Предотвращаем всплытие события, чтобы не открыть модальное окно новых слов
  document.getElementById("editLimitModal").style.display = "block";
}

// Функция для закрытия любого модального окна
function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

// Функция для установки нового лимита, вызывается в ответ на действие пользователя
function setDailyNewWordLimit(limit) {
  fetch("/api/user/dailyWordLimit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dailyWordLimit: limit }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.dailyWordLimit) {
        dailyWordLimit = data.dailyWordLimit;
        updateDailyNewWordLimitElement();
        updateNewWordsCount();
        closeModal("editLimitModal");
      }
    })
    .catch((error) => {
      console.error("Ошибка при установке нового лимита слов:", error);
    });
}

// Функция для инициализации лимита новых слов
function initializeDailyNewWordLimit() {
  // Проверяем, аутентифицирован ли пользователь, перед тем как делать запрос к API
  if (localStorage.getItem("isAuthenticated") === "true") {
    fetch("/api/user/dailyWordLimit")
      .then((response) => {
        // Обработка неуспешного ответа, например, если пользователь не аутентифицирован
        if (!response.ok) {
          throw new Error("Unauthorized: User is not authenticated");
        }
        return response.json();
      })
      .then((data) => {
        if (data.dailyWordLimit) {
          dailyWordLimit = data.dailyWordLimit;
          updateDailyNewWordLimitElement();
        }
      })
      .catch((error) => {
        console.error("Ошибка при получении лимита слов:", error);
      });
  }
}

function updateDailyNewWordLimitElement() {
  const dailyNewWordLimitElement = document.getElementById("dailyNewWordLimit");
  if (dailyNewWordLimitElement) {
    dailyNewWordLimitElement.innerText = dailyWordLimit;
  } else {
    setTimeout(updateDailyNewWordLimitElement, 100); // Повторная попытка через 100 мс
  }
}

function updateNewWordsCount() {
  fetch("/api/new-words")
    .then((response) => response.json())
    .then((newWords) => {
      const now = new Date(); // Получаем текущее время
      const unlearnedWordsCount = newWords.filter((word) => {
        // Фильтруем слова, которые еще не изучены и время которых пришло для изучения
        return !word.studied && new Date(word.nextReviewDate) <= now;
      }).length;

      // Обновляем UI
      const newWordsCountElement = document.getElementById("newWordsCount");
      const dailyNewWordLimitElement =
        document.getElementById("dailyNewWordLimit");

      if (newWordsCountElement) {
        newWordsCountElement.textContent = `${unlearnedWordsCount} из ${dailyWordLimit}`;
      }
      if (dailyNewWordLimitElement) {
        dailyNewWordLimitElement.textContent = dailyWordLimit;
      }
    })
    .catch((error) => {
      console.error("Ошибка при получении списка новых слов:", error);
    });
}

// Вызывайте эту функцию через заданные интервалы для обновления списка слов
setInterval(function () {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  if (isAuthenticated) {
    updateNewWordsCount();
  }
}, 2 * 60 * 250); // Обновлять каждые 10 минут

// Функция для закрытия модального окна по клику вне его остается неизменной
window.onclick = function (event) {
  if (event.target.classList.contains("modal")) {
    // Проверяем, относится ли идентификатор модального окна к тому, которое мы хотим закрыть
    if (event.target.id === "editLimitModal") {
      closeModal(event.target.id);
    }
  }
};

function focusInput() {
  var input = document.getElementById("customLimit");
  var pencilIcon = document.querySelector(".fa-pencil");

  if (input && pencilIcon) {
    // При фокусе на поле ввода скрываем иконку карандаша
    input.addEventListener("focus", function () {
      pencilIcon.style.display = "none";
    });

    // Когда поле ввода теряет фокус, показываем иконку карандаша, если поле пустое
    input.addEventListener("blur", function () {
      if (input.value === "") {
        pencilIcon.style.display = "block";
      }
    });
  }
}

// Вызываем функцию при загрузке страницы
document.addEventListener("DOMContentLoaded", focusInput);

const resetPasswordRequestForm = document.getElementById(
  "resetPasswordRequestForm"
);
if (resetPasswordRequestForm) {
  resetPasswordRequestForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const email = document.getElementById("emailReset").value;
    fetch("/request-reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email }),
    })
      .then((response) => {
        if (!response.ok) {
          // Если ответ сервера не "OK", пытаемся получить текст ошибки
          return response.text().then((text) => {
            throw new Error(text || "Произошла ошибка на сервере");
          });
        }
        // Проверяем, является ли ответ JSON, чтобы правильно его обработать
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return response.json();
        }
        // Если ответ успешный, но не JSON, предполагаем, что письмо отправлено
        return response.text().then((text) => {
          showNotification(
            "Инструкции по сбросу пароля отправлены на вашу электронную почту."
          );
          return text; // Возвращаем текст, чтобы следующий .then() сработал без ошибок
        });
      })
      .then((data) => {
        // Если ответ был в формате JSON, показываем соответствующее сообщение
        if (data && data.message) {
          showNotification(data.message);
        }
      })
      .catch((error) => {
        // Показываем уведомление с текстом ошибки
        showNotification(error.toString());
        console.error("Ошибка:", error);
      });
  });
}
