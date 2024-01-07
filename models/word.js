const mongoose = require("mongoose");

const wordSchema = new mongoose.Schema(
  {
    term: { type: String, required: true },
    transcription: { type: String, required: false },
    translation: { type: String, required: true },
    nextReviewDate: { type: Date, default: Date.now }, // Переименовано для ясности
    reviewInterval: { type: Number, default: 1 }, // Интервал повторения
    repetitionLevel: { type: Number, default: 0 }, // Уровень повторения слова
    efactor: { type: Number, default: 2.5 }, // Фактор усвоения слова, начальное значение 2.5 для SM-2
    studied: { type: Boolean, default: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    learningStep: { type: Number, default: 0 },
    inLearningMode: { type: Boolean, default: true },
  },
  {
    timestamps: true, // Добавляем эту строку для автоматического создания полей createdAt и updatedAt
  }
);

const Word = mongoose.model("Word", wordSchema);

module.exports = Word;
