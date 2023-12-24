const mongoose = require("mongoose");

const wordSchema = new mongoose.Schema({
  term: { type: String, required: true },
  transcription: { type: String, required: false },
  translation: { type: String, required: true },
  nextReviewDate: { type: Date, default: Date.now }, // Переименовано для ясности
  reviewInterval: { type: Number, default: 1 }, // Интервал повторения
  repetitionLevel: { type: Number, default: 0 }, // Уровень повторения слова
  efactor: { type: Number, default: 2.5 }, // Фактор усвоения слова, начальное значение 2.5 для SM-2
  studied: { type: Boolean, default: false },
});

const Word = mongoose.model("Word", wordSchema);

module.exports = Word;
