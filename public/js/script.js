let currentWordIndex = 0; // Индекс текущего слова
let wordList = []; // Список слов
let currentContext = ""; // "newWord" или "reviewWord"
let wordChanges = {}; // Ключ - это ID слова, значение - объект с изменениями
let parsedWords = []; // Глобальная переменная для хранения разобранных слов

if (window.location.pathname.includes("/deck.html")) {
  loadDeckWords();
}

function showNotification(message) {
  const notification = document.getElementById("notification");
  if (notification) {
    notification.textContent = message;
    notification.style.display = "block";

    // Скрыть уведомление через 3 секунды
    setTimeout(() => {
      notification.style.display = "none";
    }, 3000);
  }
}

function updateDailyTasks() {
  const dailyLimit = getDailyNewWordLimit(); // Получаем лимит из localStorage или значение по умолчанию

  fetch("/daily-tasks")
    .then((response) => response.json())
    .then((data) => {
      const now = new Date();

      // Определяем количество новых слов, готовых к изучению
      const newWordsReady = data.newWords.filter((word) => {
        const reviewDate = new Date(word.nextReviewDate);
        return reviewDate <= now;
      }).length;

      // Ограничиваем количество новых слов на основе лимита пользователя
      const newWordsCount = Math.min(newWordsReady, parseInt(dailyLimit));

      // Определяем количество слов для повторения
      const wordsToReviewCount = data.wordsToReview.filter((word) => {
        const reviewDate = new Date(word.nextReviewDate);
        return reviewDate <= now;
      }).length;

      // Обновляем отображение на странице
      const newWordsCountElement = document.getElementById("newWordsCount");
      if (newWordsCountElement) {
        newWordsCountElement.textContent = `${newWordsCount} из ${dailyLimit}`;
      }

      const wordsToReviewCountElement =
        document.getElementById("wordsToReviewCount");
      if (wordsToReviewCountElement) {
        wordsToReviewCountElement.textContent = wordsToReviewCount;
      }
    })
    .catch((error) => {
      console.error("Ошибка при получении ежедневных задач: ", error);
    });
}

function updateNewWordsCount() {
  fetch("/new-words-count")
    .then((response) => response.json())
    .then((data) => {
      const newWordsCountElement = document.getElementById("newWordsCount");
      if (newWordsCountElement) {
        newWordsCountElement.textContent = `0 из ${data.newWordsCount}`;
      }
    })
    .catch((error) =>
      console.error("Ошибка при получении количества новых слов: ", error)
    );
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
  console.log("loadWord called for", word.term);
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
  updateNextReviewDateDisplay(word);
  console.log("loadWord finished for", word.term);
}

function initializeProgressBar(wordCount, progressBarId) {
  const progressBar = document.getElementById(progressBarId);
  console.log("Initializing progress bar with wordCount:", wordCount);
  progressBar.innerHTML = "";

  for (let i = 0; i < wordCount; i++) {
    const progressItem = document.createElement("div");
    progressItem.classList.add("progress-item");
    console.log("Adding progress item:", progressItem);
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
      console.log("Word updated", data);
    })
    .catch((error) => {
      console.error("Error updating word status:", error);
    });
}

// Обработка открытия модального окна для новых слов
function openNewWordsModal() {
  currentContext = "newWord";
  fetch("/api/new-words")
    .then((response) => response.json())
    .then((data) => {
      wordList = data;
      currentWordIndex = 0;
      console.log("wordList.length:", wordList.length);
      learnedWordsCount = 0; // Сброс счетчика изученных слов
      initializeProgressBar(wordList.length, "newWordsProgressBar");
      if (wordList.length > 0) {
        const firstWord = wordList[currentWordIndex]; // Получаем первое слово
        loadWord(firstWord, currentContext); // Загружаем первое слово в модальное окно для новых слов
      }
    })
    .catch((error) => {
      console.error("Error updating word status:", error);
    });
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

let learnedWordsCount = 0; // Счетчик изученных слов

function handleAgainWordClick() {
  const wordId = this.dataset.wordId;
  updateWordStatus(wordId, 0).then(() => {
    moveToWordEnd(wordId);
    loadNextWord();
  });
}

function handleHardWordClick() {
  const wordId = this.dataset.wordId;
  updateWordStatus(wordId, 1).then(() => {
    moveToWordEnd(wordId);
    loadNextWord();
  });
}

function handleGoodWordClick() {
  const wordId = this.dataset.wordId;
  updateWordStatus(wordId, 3).then(() => {
    markWordAsLearned(wordId);
  });
}

function handleEasyWordClick() {
  const wordId = this.dataset.wordId;
  updateWordStatus(wordId, 5).then(() => {
    markWordAsLearned(wordId);
  });
}

function moveToWordEnd(wordId) {
  const index = wordList.findIndex((word) => word._id === wordId);
  if (index !== -1) {
    const wordToMove = wordList.splice(index, 1)[0];
    wordList.push(wordToMove);

    // Если перемещаемое слово было текущим, обновляем currentWordIndex
    if (currentWordIndex === index) {
      currentWordIndex = wordList.length - 1;
    } else if (currentWordIndex > index) {
      // Если перемещаемое слово было перед текущим, уменьшаем currentWordIndex
      currentWordIndex--;
    }
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

const learningSteps = [1, 10]; // Шаги в минутах

function simulateNextReviewDate(word, qualityResponse) {
  let simulatedWord = { ...word }; // Создаем копию слова для имитации изменений

  if (simulatedWord.inLearningMode) {
    // Логика для изучаемых слов
    if (qualityResponse === 0) {
      simulatedWord.learningStep = 0;
    } else {
      if (simulatedWord.learningStep < learningSteps.length - 1) {
        simulatedWord.learningStep += 1;
      }
      if (simulatedWord.learningStep >= learningSteps.length - 1) {
        simulatedWord.repetitionLevel = 1;
        simulatedWord.efactor = 2.5;
        simulatedWord.reviewInterval = 1;
        simulatedWord.inLearningMode = false;
      }
    }
    const stepInterval = learningSteps[simulatedWord.learningStep] || 1;
    console.log({
      step: simulatedWord.learningStep,
      interval: learningSteps[simulatedWord.learningStep],
      reviewInterval: simulatedWord.reviewInterval,
      efactor: simulatedWord.efactor,
      repetitionLevel: simulatedWord.repetitionLevel,
    });

    simulatedWord.nextReviewDate = new Date(
      Date.now() + stepInterval * 60 * 1000
    );
  } else {
    // Логика для повторяемых слов
    if (qualityResponse === 0) {
      simulatedWord.repetitionLevel = 0;
      simulatedWord.reviewInterval = 1;
      simulatedWord.inLearningMode = true;
      simulatedWord.learningStep = 0;
    } else {
      simulatedWord.repetitionLevel += 1;
      simulatedWord.efactor = calculateEFactor(
        simulatedWord.efactor,
        qualityResponse
      );
      simulatedWord.reviewInterval = calculateInterval(
        simulatedWord.reviewInterval,
        simulatedWord.efactor,
        simulatedWord.repetitionLevel
      );
    }
    console.log({
      step: simulatedWord.learningStep,
      interval: learningSteps[simulatedWord.learningStep],
      reviewInterval: simulatedWord.reviewInterval,
      efactor: simulatedWord.efactor,
      repetitionLevel: simulatedWord.repetitionLevel,
    });

    simulatedWord.nextReviewDate = new Date(
      Date.now() + simulatedWord.reviewInterval * 24 * 60 * 60 * 1000
    );
  }

  return simulatedWord.nextReviewDate;
}

function updateNextReviewDateDisplay(word) {
  const nextReviewDates = {
    again: simulateNextReviewDate(word, 0),
    hard: simulateNextReviewDate(word, 1),
    good: simulateNextReviewDate(word, 3),
    easy: simulateNextReviewDate(word, 5),
  };

  // Предполагаем, что у вас есть элементы на странице для отображения дат
  document.getElementById("againNextReviewDate").textContent = formatDate(
    nextReviewDates.again
  );
  document.getElementById("hardNextReviewDate").textContent = formatDate(
    nextReviewDates.hard
  );
  document.getElementById("goodNextReviewDate").textContent = formatDate(
    nextReviewDates.good
  );
  document.getElementById("easyNextReviewDate").textContent = formatDate(
    nextReviewDates.easy
  );
}

function formatDate(date) {
  // Проверяем, что аргумент date является объектом Date и он содержит валидную дату
  if (date instanceof Date && !isNaN(date.getTime())) {
    // Форматируем дату для отображения
    return date.toLocaleDateString(); // Или любой другой формат, который вам нравится
  } else {
    // Если дата невалидна, возвращаем запасное значение
    return "Дата не определена";
  }
}

function markWordAsLearned(wordId) {
  wordList = wordList.filter((word) => word._id !== wordId);
  updateProgressBar(); // Обновляем прогресс-бар перед увеличением счетчика
  learnedWordsCount++; // Теперь увеличиваем счетчик изученных слов
  loadNextWord();
}

function loadNextWord() {
  console.log(
    "Loading next word. Current index before update:",
    currentWordIndex
  );

  // Если достигли конца списка, вызываем handleLastWord
  if (currentWordIndex >= wordList.length - 1) {
    handleLastWord();
  } else {
    // Иначе переходим к следующему слову
    currentWordIndex = (currentWordIndex + 1) % wordList.length;
    console.log("Updated currentWordIndex:", currentWordIndex);
    loadWord(wordList[currentWordIndex], currentContext);
  }
}

function initializeUserSession() {
  console.log("Инициализация сессии пользователя...");
  localStorage.setItem("isAuthenticated", "true");
  // Здесь можно добавить любую логику инициализации, которая должна происходить после входа пользователя
  updateDailyTasks();
  updateNewWordsCount();
  getDecks("deckSelect"); // Идентификатор для существующего select
  getDecks("deck-select"); // Идентификатор для нового select
  loadDecks();
  // ... любые другие функции инициализации
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

window.addEventListener("click", function (event) {
  const studyModal = document.getElementById("studyModal");
  const wordsToReviewModal = document.getElementById("wordsToReviewModal");

  if (event.target === studyModal) {
    studyModal.style.display = "none";
    updateDailyTasks();
    updateNewWordsCount(); // Обновление счетчика новых слов
  } else if (event.target === wordsToReviewModal) {
    wordsToReviewModal.style.display = "none";
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
  confirmDeleteButton.addEventListener("click", async () => {
    // Получаем ID колоды из URL
    const urlParams = new URLSearchParams(window.location.search);
    const deckId = urlParams.get("deckId");

    if (deckId) {
      try {
        // Отправляем запрос на сервер для удаления колоды с помощью метода POST
        const response = await fetch("/delete-deck", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deckId: deckId }),
        });

        // Обрабатываем ответ сервера
        const result = await response.json();
        if (result.success) {
          // Удаление прошло успешно
          alert("Колода успешно удалена.");
          // Переадресация на главную страницу или обновление интерфейса
          window.location.href = "/main.html";
        } else {
          // Сервер вернул ошибку
          alert("Ошибка при удалении колоды: " + result.message);
        }
      } catch (error) {
        // Обработка ошибок сети/запроса
        alert("Ошибка сети: " + error.message);
      }
    } else {
      alert("ID колоды не найден.");
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
  document
    .getElementById("import-button")
    .addEventListener("click", function () {
      console.log("Import button clicked"); // Добавьте это для дебага
      const selectedDeckId = document.getElementById("deck-select").value;
      if (selectedDeckId && parsedWords.length) {
        importWords(selectedDeckId, parsedWords);
      } else {
        alert("Выберите колоду и/или загрузите файл для импорта");
      }
    });
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
    // Определяем модальное окно в зависимости от текущего контекста
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

    // Скрыть все элементы управления внутри модального окна
    let elementsToHide = modalContent
      .getElementsByClassName("modal-footer")[0]
      .getElementsByTagName("button");
    for (let i = 0; i < elementsToHide.length; i++) {
      elementsToHide[i].style.display = "none";
    }

    // Скрыть элементы отображения слова и транскрипции
    let reviewElements = [
      "wordInEnglish",
      "wordTranscription",
      "reviewWordInEnglish",
      "reviewWordTranscription",
    ];
    reviewElements.forEach(function (id) {
      let element = document.getElementById(id);
      if (element) {
        element.style.display = "none";
      }
    });

    // Отобразить сообщение "На сегодня это все"
    const message = document.createElement("p");
    message.textContent = "На сегодня это все, вы хорошо позанимались!!!";
    message.style.textAlign = "center";
    message.style.marginTop = "20px";
    message.style.fontSize = "20px";

    // Очищаем содержимое modal-content и добавляем сообщение
    while (modalContent.firstChild) {
      modalContent.removeChild(modalContent.firstChild);
    }
    modalContent.appendChild(message);
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
    this.parentElement.parentElement.style.display = "none";
    updateNewWordsCount();
    updateDailyTasks();
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
  fetch("/decks")
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

// document.getElementById("fileElem").addEventListener("change", handleFiles);

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
    // Путь должен соответствовать серверному маршруту, который вы определите
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Убедитесь, что вы добавили необходимые заголовки для авторизации, если это требуется
    },
    body: JSON.stringify({ deckId, words }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("Слова успешно добавлены в колоду.");
      } else {
        alert("Произошла ошибка: " + data.message);
      }
    })
    .catch((error) => {
      console.error("Ошибка при импорте слов:", error);
      alert("Ошибка при импорте слов.");
    });
}

const dropArea = document.getElementById("drop-area");

dropArea.addEventListener("drop", (event) => {
  event.preventDefault();
  const files = event.dataTransfer.files;
  handleFiles(files);
});

// function handleFiles(files) {
//   const formData = new FormData();
//   formData.append("file", files[0]);
//   formData.append("deckId", document.getElementById("deck-select").value);

//   fetch("/upload-csv", {
//     method: "POST",
//     body: formData,
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       console.log(data);
//       // Обработка успешной загрузки
//     })
//     .catch((error) => {
//       console.error("Error:", error);
//     });
// }

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
}

document.addEventListener("DOMContentLoaded", function () {
  // Отслеживание изменений в input type="file"
  // Обработчик для 'change' события input type="file"
  document
    .getElementById("fileElem")
    .addEventListener("change", function (event) {
      handleFiles(event.target.files); // Обработка файлов для отображения
      updateFileName(event); // Обновление имени файла для отображения
    });
  initializeDailyNewWordLimit();
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Функции подсветки и убирания подсветки области drop
function highlight(e) {
  dropArea.classList.add("highlight");
}

function unhighlight(e) {
  dropArea.classList.remove("highlight");
}

// Обработчик события drop
function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  dropArea.classList.remove("highlight"); // Убрать выделение с drop area

  let dt = e.dataTransfer;
  let files = dt.files;

  handleFiles(files); // Обработка файлов для отображения
  updateFileName(null, files[0]); // Обновление имени файла для отображения
  displayPreviewContainer(); // Показываем контейнер для предпросмотра
}

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

// Функция, которая отображает preview контейнер и обновляет подсказку
function displayPreviewContainer() {
  const previewContainer = document.getElementById("preview-container");
  const dropArea = document.getElementById("drop-area");
  previewContainer.style.display = "block"; // Показываем контейнер
  dropArea.querySelector("p").textContent =
    "Файл загружен. Проверьте предпросмотр перед импортом."; // Обновляем подсказку
}

function saveDailyNewWordLimit(limit) {
  localStorage.setItem("dailyNewWordLimit", limit);
}

function getDailyNewWordLimit() {
  return localStorage.getItem("dailyNewWordLimit") || "10"; // Значение по умолчанию - 10
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
  // Проверяем и обновляем лимит
  localStorage.setItem("dailyNewWordLimit", limit);
  const dailyNewWordLimitElement = document.getElementById("dailyNewWordLimit");
  if (dailyNewWordLimitElement) {
    dailyNewWordLimitElement.textContent = limit;
  }
  closeModal("editLimitModal"); // Закрываем модальное окно
  updateDailyTasks(); // Обновляем задачи после изменения лимита
}
// Функция для закрытия модального окна по клику вне его
window.onclick = function (event) {
  if (event.target.classList.contains("modal-edit-limit")) {
    closeModal(event.target.id);
  }
};

// Функция для инициализации лимита новых слов
function initializeDailyNewWordLimit() {
  const dailyLimit = getDailyNewWordLimit(); // Используем уже существующую функцию
  const dailyNewWordLimitElement = document.getElementById("dailyNewWordLimit");
  if (dailyNewWordLimitElement) {
    dailyNewWordLimitElement.textContent = dailyLimit;
  }
}

function focusInput() {
  var input = document.getElementById("customLimit");
  var pencilIcon = document.querySelector(".fa-pencil");

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

// Вызываем функцию при загрузке страницы
document.addEventListener("DOMContentLoaded", focusInput);
