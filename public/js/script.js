let currentWordIndex = 0; // Индекс текущего слова
let wordList = []; // Список слов
let currentContext = ""; // "newWord" или "reviewWord"
let wordChanges = {}; // Ключ - это ID слова, значение - объект с изменениями

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
  fetch("/daily-tasks")
    .then((response) => response.json())
    .then((data) => {
      const newWordsCountElement = document.getElementById("newWordsCount");
      if (newWordsCountElement) {
        newWordsCountElement.textContent = `${data.newWords} из 10`;
      }

      const wordsToReviewCountElement =
        document.getElementById("wordsToReviewCount");
      if (wordsToReviewCountElement) {
        wordsToReviewCountElement.textContent = data.wordsToReview;
      }
    })
    .catch((error) =>
      console.error("Ошибка при получении ежедневных задач: ", error)
    );
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
  const selectedDeckId = document.getElementById("deckSelect").value; // Убедитесь, что это правильный id вашего элемента выбора колоды

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
        body: JSON.stringify({ wordId: createdWord._id }), // Отправляем ObjectID созданного слова
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
  let knowWordButton, learnWordButton;

  // Получаем элементы для контекста "newWord"
  if (context === "newWord") {
    modal = document.getElementById("studyModal");
    studyWord = document.getElementById("studyWord");
    wordInEnglish = document.getElementById("wordInEnglish");
    wordTranscription = document.getElementById("wordTranscription");
    wordDefinition = document.getElementById("wordDefinition");
    knowWordButton = document.getElementById("knowWordButton");
    learnWordButton = document.getElementById("learnWordButton");
  }
  // Получаем элементы для контекста "reviewWord"
  else if (context === "reviewWord") {
    modal = document.getElementById("wordsToReviewModal");
    studyWord = document.getElementById("reviewStudyWord");
    wordInEnglish = document.getElementById("reviewWordInEnglish");
    wordTranscription = document.getElementById("reviewWordTranscription");
    wordDefinition = document.getElementById("reviewWordDefinition");
    knowWordButton = document.getElementById("knowReviewWordButton");
    learnWordButton = document.getElementById("learnReviewWordButton");
  }

  // Проверяем, существуют ли элементы, прежде чем изменять их свойства
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

  // Проверяем, существует ли модальное окно, прежде чем изменять его стиль
  if (modal) modal.style.display = "block";

  // Показываем кнопку "Показать определение", если это необходимо
  const showDefinitionButton =
    context === "newWord" ? "showDefinition" : "showReviewDefinition";
  const showDefinitionElem = document.getElementById(showDefinitionButton);
  if (showDefinitionElem) showDefinitionElem.style.display = "block";

  // Добавляем обработчики событий, если кнопки существуют
  if (knowWordButton) {
    knowWordButton.removeEventListener("click", handleKnowWordClick);
    knowWordButton.addEventListener("click", handleKnowWordClick);
    knowWordButton.dataset.wordId = word._id;
  }

  if (learnWordButton) {
    learnWordButton.removeEventListener("click", handleLearnWordClick);
    learnWordButton.addEventListener("click", handleLearnWordClick);
    learnWordButton.dataset.wordId = word._id;
  }
}

// Функция для отправки статуса слова на сервер
function updateWordStatus(wordId, knowsWord) {
  fetch("/update-word-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wordId, knowsWord }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      console.log("Word updated", data);
      // Move to the next word
      if (currentWordIndex < wordList.length - 1) {
        currentWordIndex++;
        console.log(currentWordIndex);
        loadWord(wordList[currentWordIndex], currentContext);
      } else {
        // Handle the scenario when no more words are left
        handleLastWord();
      }
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
        loadWord(wordList[currentWordIndex], currentContext);
      }
    })
    .catch((error) => console.error("Ошибка: ", error));
}

function handleKnowWordClick() {
  const wordId = this.dataset.wordId;
  updateWordStatus(wordId, true);
}

function handleLearnWordClick() {
  const wordId = this.dataset.wordId;
  updateWordStatus(wordId, false);
}

function addEventListeners(button, wordId, knowsWord) {
  // Удаляем существующие обработчики событий
  button.removeEventListener("click", handleKnowWordClick);
  button.removeEventListener("click", handleLearnWordClick);

  // Добавляем новый обработчик событий
  const handler = knowsWord ? handleKnowWordClick : handleLearnWordClick;
  button.addEventListener("click", handler);
  button.dataset.wordId = wordId; // Устанавливаем wordId как данные элемента для доступа в обработчике
}

function initializeUserSession() {
  console.log("Инициализация сессии пользователя...");
  localStorage.setItem("isAuthenticated", "true");
  // Здесь можно добавить любую логику инициализации, которая должна происходить после входа пользователя
  updateDailyTasks();
  updateNewWordsCount();
  getDecks();
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

// Закрытие модального окна по клику вне окна
window.addEventListener("click", function (event) {
  const studyModal = document.getElementById("studyModal");
  const wordsToReviewModal = document.getElementById("wordsToReviewModal");

  if (event.target === studyModal) {
    studyModal.style.display = "none";
  } else if (event.target === wordsToReviewModal) {
    wordsToReviewModal.style.display = "none";
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
      getDecks();
      updateNewWordsCount();
      updateDailyTasks();
      getDecks();
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
          document.getElementById("wordDefinition").style.display = "block";
        } else if (currentContext === "reviewWord") {
          document.getElementById("reviewWordInEnglish").textContent =
            data.term;
          document.getElementById("reviewWordTranscription").textContent =
            data.transcription;
          document.getElementById("reviewWordDefinition").style.display =
            "block";
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
      document.getElementById("reviewWordDefinition").style.display = "none";
    }
  }
}

function handleLastWord() {
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

  // Проверяем, является ли текущее слово последним в списке
  if (currentWordIndex === wordList.length - 1) {
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

    // Отобразить сообщение
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
    // Логика для загрузки следующего слова, если это не последнее слово
    currentWordIndex++; // Переходим к следующему слову
    loadWord(wordList[currentWordIndex], currentContext);
  }
}

// Добавление прослушивателя для кнопки "Показать определение"
const showDefinitionButton = document.getElementById("showDefinition");
if (showDefinitionButton) {
  showDefinitionButton.addEventListener("click", showDefinition);
  showDefinitionButton.addEventListener("click", function () {
    var wordDefinition = document.getElementById("wordDefinition");
    if (wordDefinition) {
      wordDefinition.classList.toggle("hidden");
      wordDefinition.classList.toggle("visible");
      this.style.display = "none"; // Скрываем кнопку "Показать определение"
    }
  });
}
const showReviewDefinitionButton = document.getElementById(
  "showReviewDefinition"
);
if (showReviewDefinitionButton) {
  showReviewDefinitionButton.addEventListener("click", showDefinition);
  showReviewDefinitionButton.addEventListener("click", function () {
    var reviewWordDefinition = document.getElementById("reviewWordDefinition");
    if (reviewWordDefinition) {
      reviewWordDefinition.classList.toggle("hidden");
      reviewWordDefinition.classList.toggle("visible");
      this.style.display = "none"; // Скрываем кнопку "Показать определение" в модальном окне повторения
    }
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
      getDecks(); // Обновление списка колод
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
function getDecks() {
  console.log("Начало функции getDecks");
  fetch("/decks")
    .then((response) => {
      console.log("Получен ответ от сервера");
      return response.json();
    })
    .then((data) => {
      console.log("Колоды получены:", data);
      const deckSelect = document.getElementById("deckSelect");
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
