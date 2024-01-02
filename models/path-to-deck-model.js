const mongoose = require("mongoose");

const deckSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    words: [{ type: mongoose.Schema.Types.ObjectId, ref: "Word" }],
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true, // Добавляем эту строку для автоматического создания полей createdAt и updatedAt
  }
);

const Deck = mongoose.model("Deck", deckSchema);

module.exports = Deck;
