const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    dailyWordLimit: { type: Number, default: 10 }, // Добавлено новое поле с дефолтным значением 10
    lastNewWordsRequest: { type: Date },
    dailyWordsList: [{ type: mongoose.Schema.Types.ObjectId, ref: "Word" }],
  },
  {
    timestamps: true, // Добавляет поля createdAt и updatedAt
  }
);

userSchema.methods.isValidPassword = async function (password) {
  return await bcrypt.compare(password, this.passwordHash);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
