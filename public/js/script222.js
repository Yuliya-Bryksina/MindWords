let currentWordIndex = 0; // Индекс текущего слова
let wordList = []; // Список слов

function showNotification(message) {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.style.display = "block";

  // Скрыть уведомление через 3 секунды
  setTimeout(() => {
    notification.style.display = "none";
  }, 3000);
}

function updateDailyTasks() {
  fetch("/daily-tasks")
    .then((response) => response.json())
    .then((data) => {
      document.getElementById(
        "newWordsCount"
      ).textContent = `${data.newWords} из 10`;
      document.getElementById("wordsToReviewCount").textContent =
        data.wordsToReview;
    })
    .catch((error) =>
      console.error("Ошибка при получении ежедневных задач: ", error)
    );
}

function updateNewWordsCount() {
  fetch("/new-words-count")
    .then((response) => response.json())
    .then((data) => {
      document.getElementById(
        "newWordsCount"
      ).textContent = `0 из ${data.newWordsCount}`;
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

// Обработка открытия модального окна для новых слов
function openNewWordsModal() {
  fetch("/api/new-words")
    .then((response) => response.json())
    .then((data) => {
      wordList = data;
      currentWordIndex = 0;

      if (wordList.length > 0) {
        const firstWord = wordList[currentWordIndex]; // Получаем первое слово
        loadWord(firstWord); // Загружаем первое слово в модальное окно
      } else {
        console.error("Нет новых слов для изучения");
      }
    })
    .catch((error) => console.error("Ошибка: ", error));
}

function loadWord(word) {
  const modal = document.getElementById("studyModal");
  const studyWord = document.getElementById("studyWord");

  // Скрываем транскрипцию и английское слово
  document.getElementById("wordInEnglish").style.display = "none";
  document.getElementById("wordTranscription").style.display = "none";

  studyWord.textContent = word.translation; // Устанавливаем перевод
  document.getElementById("wordInEnglish").textContent = word.term; // Устанавливаем английское слово
  document.getElementById("wordTranscription").textContent = word.transcription; // Устанавливаем транскрипцию

  document.getElementById("knowWordButton").dataset.wordId = word._id;
  document.getElementById("learnWordButton").dataset.wordId = word._id;

  var wordDefinition = document.getElementById("wordDefinition");
  wordDefinition.classList.add("hidden");
  wordDefinition.classList.remove("visible");

  modal.style.display = "block";
  document.getElementById("showDefinition").style.display = "block"; // Показываем кнопку при загрузке нового слова
}

// Добавьте эти обработчики событий в ваш код, чтобы они были доступны после загрузки страницы

// document
//   .getElementById("knowWordButton")
//   .addEventListener("click", function () {
//     const wordId = this.dataset.wordId;
//     updateWordStatus(wordId, true); // Пользователь знает слово
//   });

// // Обработчик для кнопки "Начать учить это слово"
// document
//   .getElementById("learnWordButton")
//   .addEventListener("click", function () {
//     const wordId = this.dataset.wordId;
//     updateWordStatus(wordId, false); // Пользователь не знает слово и начинает учить
//   });

//тоже старые обработчики событий от updateWord функции
document
  .getElementById("knowWordButton")
  .addEventListener("click", function () {
    const wordId = this.dataset.wordId;
    updateWord(wordId, true); // Польз+ователь знает слово
  });

document
  .getElementById("learnWordButton")
  .addEventListener("click", function () {
    const wordId = this.dataset.wordId;
    updateWord(wordId, false); // Пользователь не знает слово и начинает учить
  });

// пока закомментировала, так как решили использовать updateWordStatus вместо нее
// Функция updateWord может быть реализована как отправка запроса на сервер для обновления статуса слова
function updateWord(wordId, knowsWord) {
  const qualityResponse = knowsWord ? 5 : 0;
  fetch("/update-word-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wordId: wordId, qualityResponse: qualityResponse }),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Word updated", data);
      // Перемещение логики `handleLastWord` сюда, чтобы избежать двойного инкремента
      if (currentWordIndex < wordList.length - 1) {
        currentWordIndex++; // Переход к следующему слову
        loadWord(wordList[currentWordIndex]);
      } else {
        // Вызов логики обработки последнего слова
        handleLastWord();
      }
    })
    .catch((error) => {
      console.error("Error updating word:", error);
    });
}

// Функция для отправки статуса слова на сервер
function updateWordStatus(wordId, knowsWord) {
  fetch("/update-word-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wordId: wordId, knowsWord: knowsWord }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      console.log("Word updated", data);
      // После обновления слова, обновите интерфейс или перейдите к следующему слову
    })
    .catch((error) => {
      console.error("Error updating word status:", error);
    });
}

function showEndOfStudyMessage() {
  const modalContent = document.querySelector(".modal-content");
  modalContent.innerHTML = "На сегодня это все, вы хорошо позанимались!";
  // Стили для сообщения
  modalContent.style.textAlign = "center";
  modalContent.style.paddingTop = "20px";
}

// Обработка открытия модального окна для слов на повторение
function openWordsToReviewModal() {
  fetch("/api/words-to-review")
    .then((response) => response.json())
    .then((data) => {
      const modal = document.getElementById("studyModal");
      const studyWord = document.getElementById("studyWord");

      if (data.length > 0) {
        const firstWord = data[0];
        studyWord.textContent = firstWord.translation; // Устанавливаем перевод

        // Непосредственно устанавливаем значения для элементов внутри wordDefinition
        console.log(firstWord.transcription);
        document.getElementById("wordInEnglish").textContent = firstWord.term; // Устанавливаем английское слово
        document.getElementById("wordTranscription").textContent =
          firstWord.transcription; // Устанавливаем транскрипцию
        console.log(firstWord.transcription);

        // Устанавливаем ID слова в атрибуты кнопок
        document
          .getElementById("knowWordButton")
          .addEventListener("click", function () {
            const wordId = this.dataset.wordId;
            updateWord(wordId, true); // Пользователь знает слово
          });

        document
          .getElementById("learnWordButton")
          .addEventListener("click", function () {
            const wordId = this.dataset.wordId;
            updateWord(wordId, false); // Пользователь не знает слово и начинает учить
          });
      }
      modal.style.display = "block";
    })
    .catch((error) => console.error("Ошибка: ", error));
}

// Обработка закрытия модального окна
document.getElementsByClassName("close")[0].onclick = function () {
  document.getElementById("studyModal").style.display = "none";
};

// Вызывайте эти функции при загрузке страницы или в соответствующих событиях
updateDailyTasks();
updateNewWordsCount();

// Закрытие модального окна по клику на крестик
document.querySelector(".close").addEventListener("click", function () {
  document.getElementById("studyModal").style.display = "none";
});

document
  .querySelector("#newDeckModal .close")
  .addEventListener("click", function () {
    document.getElementById("newDeckModal").style.display = "none";
  });

// Закрытие модального окна по клику вне окна
window.addEventListener("click", function (event) {
  const modal = document.getElementById("studyModal");
  if (event.target === modal) {
    modal.style.display = "none";
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

document.addEventListener("DOMContentLoaded", (event) => {
  document.getElementById("wordInput").disabled = true;
  document.getElementById("transcription").disabled = true;
  document.getElementById("translation").disabled = true;
  // Если у вас есть кнопка добавления слова, ее тоже можно отключить:
  document.getElementById("addWordButton").disabled = true;
  const deckSelectElement = document.getElementById("deckSelect");
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
});

document.getElementById("deckSelect").addEventListener("change", (event) => {
  const hasDecks = event.target.value; // Получаем значение выбранного option
  const isDisabled = !hasDecks; // Если значение не выбрано, поля остаются отключенными

  // Включаем или отключаем поля ввода
  document.getElementById("wordInput").disabled = isDisabled;
  document.getElementById("transcription").disabled = isDisabled;
  document.getElementById("translation").disabled = isDisabled;
  // Если у вас есть кнопка добавления слова, ее тоже можно включить или отключить
  document.getElementById("addWordButton").disabled = isDisabled;

  // Сохраняем выбранную колоду в localStorage
  saveSelectedDeck();
});
// Загрузка колод при загрузке страницы
document.addEventListener("DOMContentLoaded", loadDecks);

// Функция, которая вызывается при клике на кнопку "Показать определение"
// Функция для отображения определения слова
// Corrected showDefinition function
function showDefinition() {
  const studyWord = document.getElementById("studyWord").textContent;

  fetch(`/get-word-definition?word=${encodeURIComponent(studyWord)}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      document.getElementById("wordInEnglish").textContent = data.term; // Здесь должен быть английский термин из ответа сервера
      document.getElementById("wordTranscription").textContent =
        data.transcription; // Здесь - транскрипция из ответа сервера

      // Показываем блок с определением, если он был скрыт
      document.getElementById("wordDefinition").style.display = "block";
    })
    .catch((error) => {
      console.error("Error fetching word definition:", error);
    });
  // Отображаем транскрипцию и английское слово
  document.getElementById("wordInEnglish").style.display = "block";
  document.getElementById("wordTranscription").style.display = "block";
  document.getElementById("showDefinition").style.display = "none"; // Скрываем кнопку после показа определения
}

function handleLastWord() {
  // Проверяем, является ли текущее слово последним в списке
  if (currentWordIndex === wordList.length - 1) {
    // Скрыть все элементы
    document.getElementById("wordDefinition").style.display = "none";
    document.getElementById("showDefinition").style.display = "none";
    document.getElementById("knowWordButton").style.display = "none";
    document.getElementById("learnWordButton").style.display = "none";

    // Отобразить сообщение
    const message = document.createElement("p");
    message.textContent = "На сегодня это все, вы хорошо позанимались!";
    message.style.textAlign = "center";
    message.style.marginTop = "20px";
    message.style.fontSize = "20px"; // Установите размер шрифта по вашему усмотрению

    // Очищаем модальное окно перед добавлением сообщения
    const modalContent = document.querySelector(".modal-content");
    modalContent.innerHTML = "";
    modalContent.appendChild(message);

    // Закрываем модальное окно через некоторое время, если нужно
    // setTimeout(() => { document.getElementById("studyModal").style.display = "none"; }, 3000);
  } else {
    // Логика для загрузки следующего слова, если это не последнее слово
    // loadWord(wordList[currentWordIndex]);
  }
}

// Вызывайте эту функцию при нажатии на кнопки "Я уже знаю это слово" или "Начать учить это слово"
// document
//   .getElementById("knowWordButton")
//   .addEventListener("click", function () {
//     const wordId = wordList[currentWordIndex]._id;
//     updateWord(wordId, true); // Обновление статуса слова как изученного
//   });

// document
//   .getElementById("learnWordButton")
//   .addEventListener("click", function () {
//     const wordId = wordList[currentWordIndex]._id;
//     updateWord(wordId, false); // Обновление статуса слова как неизученного
//   });

// Добавление прослушивателя для кнопки "Показать определение"
document
  .getElementById("showDefinition")
  .addEventListener("click", showDefinition);

// Обработчик для кнопки "Показать определение"
document
  .getElementById("showDefinition")
  .addEventListener("click", function () {
    var wordDefinition = document.getElementById("wordDefinition");
    wordDefinition.classList.toggle("hidden");
    wordDefinition.classList.toggle("visible");
    this.style.display = "none"; // Скрываем кнопку "Показать определение"
  });

document
  .getElementById("createDeckButton")
  .addEventListener("click", function () {
    document.getElementById("newDeckModal").style.display = "block";
  });

document.querySelector(".modal .close").addEventListener("click", function () {
  this.parentElement.parentElement.style.display = "none";
});

function toggleDefinitionVisibility() {
  const wordDefinition = document.getElementById("wordDefinition");
  const showDefinitionBtn = document.getElementById("showDefinition");

  if (wordDefinition.classList.contains("hidden-content")) {
    wordDefinition.classList.remove("hidden-content");
    wordDefinition.classList.add("visible-content");
    showDefinitionBtn.style.display = "none"; // Скрываем кнопку
  } else {
    wordDefinition.classList.add("hidden-content");
    wordDefinition.classList.remove("visible-content");
    showDefinitionBtn.style.display = "block"; // Показываем кнопку
  }
}

//---Функционал создания коллод---//

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
    })
    .catch((error) => {
      console.error("Error creating deck:", error);
    });
}

document.getElementById("newDeckForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const deckName = document.getElementById("newDeckName").value;
  createDeck(deckName);
});

// Получение списка колод
function getDecks() {
  fetch("/decks")
    .then((response) => response.json())
    .then((data) => {
      const deckSelect = document.getElementById("deckSelect");
      deckSelect.innerHTML = '<option value="">Выберите колоду</option>';
      data.forEach((deck) => {
        const option = document.createElement("option");
        option.value = deck._id;
        option.textContent = deck.name;
        deckSelect.appendChild(option);
      });
    })
    .catch((error) => {
      console.error("Error getting decks:", error);
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

// Пример вызова: addWordToDeck('wordIdHere', 'deckIdHere');

// Вызовите getDecks при инициализации приложения
getDecks();

// Функция для загрузки и отображения колод
function loadDecks() {
  fetch("/decks/grouped") // Используем новый маршрут '/decks/grouped'
    .then((response) => response.json())
    .then((groups) => {
      const container = document.getElementById("decksContainer");
      container.innerHTML = ""; // Очищаем контейнер перед отображением новых данных
      groups.forEach((group) => {
        // Создайте HTML для отображения колод, сгруппированных по месяцам
        const groupDiv = document.createElement("div");
        groupDiv.className = "deck-group";
        // groupDiv.innerHTML = `<h3>${group._id}</h3>`;
        // Получаем текущий месяц и год
        const currentDate = new Date();
        const currentYearMonth = `${currentDate.getFullYear()}-${String(
          currentDate.getMonth() + 1
        ).padStart(2, "0")}`;

        // Сравниваем с годом и месяцем группы
        const groupTitle =
          group._id === currentYearMonth ? "В этом месяце" : group._id;

        // Заменяем непосредственно содержимое заголовка
        const titleElement = document.createElement("h3");
        titleElement.textContent = groupTitle;
        groupDiv.appendChild(titleElement);

        // Создаем блоки для каждой колоды
        group.decks.forEach((deck) => {
          const deckDiv = document.createElement("div");
          deckDiv.className = "deck";
          // deckDiv.innerHTML = `<div>${deck.name} (${
          //   deck.termCount || "0"
          // } терминов)</div>`;
          // Элемент для количества терминов
          const termsCountSpan = document.createElement("span");
          termsCountSpan.className = "deck-terms-count";
          termsCountSpan.textContent = `${deck.termCount || "0"} терминов`;

          // Элемент для названия колоды
          const titleSpan = document.createElement("span");
          titleSpan.className = "deck-title";
          titleSpan.textContent = deck.name;

          // Сначала добавляем количество терминов, затем название
          deckDiv.appendChild(termsCountSpan);
          deckDiv.appendChild(titleSpan);

          deckDiv.addEventListener("click", () => {
            // Обработчик клика, который может например перенаправить пользователя на страницу колоды
            window.location.href = `/deck/${deck._id}`;
          });
          groupDiv.appendChild(deckDiv);
        });
        container.appendChild(groupDiv);
      });
    })

    .catch((error) => console.error("Error loading decks:", error));
  const selectedDeckId = localStorage.getItem("selectedDeckId");
  if (selectedDeckId) {
    document.getElementById("deckSelect").value = selectedDeckId;
    // Также обновляем доступность полей ввода
    document.getElementById("wordInput").disabled = false;
    document.getElementById("transcription").disabled = false;
    document.getElementById("translation").disabled = false;
    document.getElementById("addWordButton").disabled = false;
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
    .then((response) => response.json())
    .then((decks) => {
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
    .catch((error) => console.error("Error searching decks:", error));
}

// Загрузить колоды при загрузке страницы
document.addEventListener("DOMContentLoaded", loadDecks);

// Функция для сохранения выбранной колоды в localStorage
function saveSelectedDeck() {
  const selectedDeckId = document.getElementById("deckSelect").value;
  localStorage.setItem("selectedDeckId", selectedDeckId);
}
